/* ===== API Quản lý lịch hẹn (khu vực quản trị) =====

   Trang "Quản lý lịch hẹn" là nơi Admin xử lý nghiệp vụ hằng ngày, nên các
   thao tác ở đây đều phải kiểm tra lại điều kiện thật thay vì tin vào dữ
   liệu lúc hiển thị: nhân viên có còn làm không, ca có còn mở không, khung
   giờ có bị trùng không. Bộ luật đó nằm trong lib/staff-availability.js và
   dùng chung cho cả tạo lịch lẫn sửa lịch. */

import { pool } from '../config/database.js';
import {
  METHOD_TEXT, PAYMENT_TEXT, SOURCE_TEXT, STATUS_TEXT,
  bookingCode, clockOf, dayOf,
} from '../lib/booking-labels.js';
import { canTransition, SETTLED_STATUSES } from '../lib/booking-state.js';
import { checkStaffAvailable, freeSlotsForStaff, listAvailableStaff } from '../lib/staff-availability.js';
import {
  actualServiceMinutes, createBooking as createBookingRecord, isDate, loadActiveService, momentOf, recheckAfterMove,
} from '../lib/booking-service.js';
import { logEvent, listEvents } from '../lib/booking-events.js';
import { normalisePhone } from './walkin.controller.js';

const clock = clockOf;

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ================================================================
   Danh sách lịch hẹn
   ---------------------------------------------------------------
   Một câu trả về đủ cột của bảng: khách, dịch vụ, nhân viên, nguồn, tổng
   tiền (đã cộng dịch vụ phát sinh), trạng thái và thanh toán.
   ================================================================ */
export async function listBookings(req, res, next) {
  try {
    const status = String(req.query.status ?? '').trim().toUpperCase();
    const payment = String(req.query.payment ?? '').trim().toUpperCase();
    const source = String(req.query.source ?? '').trim().toUpperCase();
    const staffId = String(req.query.staffId ?? '').trim();
    const serviceId = String(req.query.serviceId ?? '').trim();
    const day = String(req.query.day ?? '').trim();
    const term = String(req.query.q ?? '').trim();
    const scope = ['today', 'tomorrow', 'week', 'upcoming', 'all'].includes(String(req.query.scope))
      ? String(req.query.scope) : 'all';

    const where = [];
    const params = [];

    if (status) { where.push('b.status = ?'); params.push(status); }
    if (source) { where.push('b.source = ?'); params.push(source); }
    if (staffId) { where.push('b.staff_id = ?'); params.push(Number(staffId)); }
    if (serviceId) { where.push('b.service_id = ?'); params.push(Number(serviceId)); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) { where.push('DATE(b.start_time) = ?'); params.push(day); }

    if (scope === 'today') where.push('DATE(b.start_time) = CURDATE()');
    if (scope === 'tomorrow') where.push('DATE(b.start_time) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
    if (scope === 'week') where.push('DATE(b.start_time) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY)');
    if (scope === 'upcoming') where.push('b.start_time >= NOW()');

    if (payment) {
      where.push(payment === 'NONE' ? 'pay.booking_id IS NULL' : 'pay.payment_status = ?');
      if (payment !== 'NONE') params.push(payment);
    }

    /* Tìm theo cả tên và số điện thoại nằm ngay trên lịch, không chỉ trong hồ sơ
       khách — nếu không thì lịch khách vãng lai không bao giờ tìm ra được,
       dù Admin nhìn thấy tên rõ ràng ngay trên bảng. */
    if (term) {
      where.push(`(COALESCE(u.full_name, b.guest_name) LIKE ?
        OR COALESCE(u.phone, b.guest_phone) LIKE ?
        OR s.service_name LIKE ? OR b.booking_id = ?)`);
      params.push(`%${term}%`, `%${term}%`, `%${term}%`, Number(term) || -1);
    }

    const [rows] = await pool.query(`SELECT
        b.booking_id AS id,
        b.start_time AS startsAt,
        b.end_time AS endsAt,
        b.status, b.note, b.source,
        b.cancel_reason AS cancelReason, b.cancelled_at AS cancelledAt,
        s.service_id AS serviceId, s.service_name AS serviceName,
        s.duration, s.price,
        b.guest_name, b.guest_phone,
        c.customer_id AS customerId,
        /* Lịch khách vãng lai không có hồ sơ: tên và số điện thoại nằm
           ngay trên lịch. COALESCE để bảng và mọi bộ lọc đều thấy một
           nguồn tên duy nhất, không phải xử lý riêng ở từng chỗ. */
        COALESCE(u.full_name, b.guest_name) AS customerName,
        COALESCE(u.phone, b.guest_phone) AS customerPhone,
        u.avatar AS customerAvatarUrl,
        st.staff_id AS staffId, su.full_name AS staffName, su.avatar AS staffAvatarUrl,
        pay.payment_status AS paymentStatus, pay.payment_method AS paymentMethod,
        pay.amount AS paidAmount,
        COALESCE(addon.total, 0) AS addonTotal,
        COALESCE(addon.count, 0) AS addonCount
      FROM booking b
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN customer c ON c.customer_id = b.customer_id
      LEFT JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      LEFT JOIN (
        /* price * quantity: dịch vụ phát sinh có số lượng. SUM(price)
           sẽ tính thiếu khi khách chọn từ 2 món trở lên cùng một dịch
           vụ — 3 lớp sơn 40.000 là 120.000 chứ không phải 40.000. */
        SELECT booking_id, SUM(price * quantity) AS total, COUNT(*) AS count
        FROM booking_addon GROUP BY booking_id
      ) addon ON addon.booking_id = b.booking_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY b.start_time ASC
      LIMIT 500`, params);

    res.json({
      data: rows.map((row) => ({
        ...row,
        code: bookingCode(row.id),
        id: String(row.id),
        serviceId: String(row.serviceId),
        customerId: String(row.customerId),
        staffId: row.staffId == null ? null : String(row.staffId),
        duration: Number(row.duration),
        price: Number(row.price),
        addonTotal: Number(row.addonTotal),
        addonCount: Number(row.addonCount),
        /* Tổng tiền = giá dịch vụ chính + các dịch vụ phát sinh. */
        total: Number(row.price) + Number(row.addonTotal),
        paidAmount: row.paidAmount == null ? null : Number(row.paidAmount),
        statusText: STATUS_TEXT[row.status] ?? row.status,
        sourceText: SOURCE_TEXT[row.source] ?? row.source,
        paymentText: row.paymentStatus ? PAYMENT_TEXT[row.paymentStatus] : null,
        methodText: row.paymentMethod ? METHOD_TEXT[row.paymentMethod] : null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/** Số đếm theo trạng thái để dựng tab lọc nhanh.
    Phải bám đúng khoảng đang xem như danh sách, nếu không tab sẽ hiện số
    toàn hệ thống trong khi bảng bên dưới chỉ có vài dòng của một ngày. */
export async function bookingCounts(req, res, next) {
  try {
    const scope = ['today', 'tomorrow', 'week', 'upcoming', 'all'].includes(String(req.query.scope))
      ? String(req.query.scope) : 'all';
    const day = String(req.query.day ?? '').trim();

    const where = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) where.push('DATE(b.start_time) = ?');
    else if (scope === 'today') where.push('DATE(b.start_time) = CURDATE()');
    else if (scope === 'tomorrow') where.push('DATE(b.start_time) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
    else if (scope === 'week') where.push('DATE(b.start_time) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY)');
    else if (scope === 'upcoming') where.push('b.start_time >= NOW()');

    const params = /^\d{4}-\d{2}-\d{2}$/.test(day) ? [day] : [];

    const [rows] = await pool.query(`SELECT b.status, COUNT(*) AS n
      FROM booking b ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY b.status`, params);

    const counts = { PENDING: 0, CONFIRMED: 0, PROCESSING: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 };
    for (const row of rows) counts[row.status] = Number(row.n);
    counts.ALL = Object.values(counts).reduce((sum, n) => sum + n, 0);

    res.json({ data: counts });
  } catch (error) {
    next(error);
  }
}

/** Chi tiết một lịch, kèm dịch vụ phát sinh và đánh giá nếu có. */
export async function getBooking(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã lịch không hợp lệ.' });

    /* Giá và thời gian lấy từ snapshot trên chính lịch hẹn, không lấy giá
       hiện tại của dịch vụ: sau này Admin đổi giá thì lịch cũ vẫn phải hiện
       đúng số tiền khách đã trả. COALESCE phòng trường hợp lịch tạo trước
       khi có migration 009. */
    const [[row]] = await pool.query(`SELECT
        b.booking_id AS id, b.start_time AS startsAt, b.end_time AS endsAt,
        b.status, b.note, b.source, b.created_at AS createdAt,
        b.cancel_reason AS cancelReason, b.cancelled_at AS cancelledAt,
        b.guest_name, b.guest_phone,
        COALESCE(b.service_price, s.price) AS price,
        COALESCE(b.service_duration, s.duration) AS duration,
        COALESCE(b.buffer_time, s.buffer_time) AS bufferTime,
        s.service_id AS serviceId, s.service_name AS serviceName,
        s.image AS serviceImage, s.status AS serviceStatus,
        s.description AS serviceDescription,
        cat.category_name AS serviceCategory,
        c.customer_id AS customerId,
        COALESCE(u.full_name, b.guest_name) AS customerName,
        COALESCE(u.phone, b.guest_phone) AS customerPhone, u.email AS customerEmail,
        u.avatar AS customerAvatarUrl, u.status AS customerStatus,
        st.staff_id AS staffId, su.full_name AS staffName,
        su.avatar AS staffAvatarUrl, su.status AS staffStatus,
        su.phone AS staffPhone, st.specialty, st.experience_year AS staffExperience,
        sc.start_time AS shiftStart, sc.end_time AS shiftEnd,
        sc.status AS shiftStatus,
        pay.payment_id AS paymentId, pay.payment_status AS paymentStatus,
        pay.payment_method AS paymentMethod, pay.amount AS paidAmount,
        pay.payment_date AS paymentDate
      FROM booking b
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN service_category cat ON cat.category_id = s.category_id
      LEFT JOIN customer c ON c.customer_id = b.customer_id
      LEFT JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      LEFT JOIN staff_schedule sc
             ON sc.staff_id = b.staff_id AND sc.work_date = DATE(b.start_time)
      WHERE b.booking_id = ? LIMIT 1`, [id]);

    if (!row) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });

    const [addons] = await pool.query(`SELECT ba.addon_id AS id, ba.quantity,
        ba.price, ba.created_at AS createdAt,
        s.service_name AS name, s.duration, s.image AS image
      FROM booking_addon ba JOIN services s ON s.service_id = ba.service_id
      WHERE ba.booking_id = ? ORDER BY s.service_name`, [id]);

    const [images] = await pool.query(
      'SELECT image_id AS id, image_url AS url FROM booking_image WHERE booking_id = ? ORDER BY image_id',
      [id]);

    const [[review]] = await pool.query(`SELECT r.review_id AS id, r.rating,
        r.comment, r.image, r.created_at AS createdAt
      FROM review r WHERE r.booking_id = ? LIMIT 1`, [id]);

    const events = await listEvents(id);

    const addonTotal = addons.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

    /* Kiểm tra nhân viên hiện tại còn nhận được lịch này không. Lịch đã xong
       hoặc đã hủy thì không còn ý nghĩa với ca làm việc nên không cảnh báo. */
    const settled = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(row.status);
    let availability = null;
    if (!settled && row.staffId) {
      const check = await checkStaffAvailable({
        bookingId: id,
        staffId: row.staffId,
        serviceId: row.serviceId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      });
      availability = { ok: check.ok, reason: check.reason ?? null, conflict: check.conflict ?? null };
    }

    /* Điểm trung bình và số đánh giá lấy từ review thật, không dùng cột
       staff.rating có sẵn vì cột đó không được cập nhật khi có đánh giá mới. */
    let staffRating = null;
    let staffReviewCount = 0;
    if (row.staffId) {
      const [[agg]] = await pool.query(
        `SELECT ROUND(AVG(r.rating), 1) AS rating, COUNT(*) AS n
           FROM review r JOIN booking b2 ON b2.booking_id = r.booking_id
          WHERE b2.staff_id = ?`, [row.staffId]);
      staffRating = agg?.rating == null ? null : Number(agg.rating);
      staffReviewCount = Number(agg?.n ?? 0);
    }

    res.json({
      data: {
        ...row,
        code: bookingCode(row.id),
        id: String(row.id),
        serviceId: String(row.serviceId),
        customerId: row.customerId == null ? null : String(row.customerId),
        staffId: row.staffId == null ? null : String(row.staffId),
        paymentId: row.paymentId == null ? null : String(row.paymentId),
        duration: Number(row.duration),
        bufferTime: Number(row.bufferTime ?? 0),
        price: Number(row.price),
        /* Tổng thời gian khách phải ngồi: dịch vụ + khoảng nghỉ giữa lịch. */
        totalMinutes: Number(row.duration) + Number(row.bufferTime ?? 0),
        /* Phân biệt hai mốc: dịch vụ kết thúc lúc nào, và nhân viên bị
           chiếm lịch đến lúc nào. end_time trong database đã cộng cả buffer
           vào, nên mốc kết thúc dịch vụ phải trừ lại buffer. */
        serviceEndsAt: new Date(new Date(row.endsAt).getTime()
          - Number(row.bufferTime ?? 0) * 60000),
        paidAmount: row.paidAmount == null ? null : Number(row.paidAmount),
        addonTotal,
        total: Number(row.price) + addonTotal,
        statusText: STATUS_TEXT[row.status] ?? row.status,
        sourceText: SOURCE_TEXT[row.source] ?? row.source,
        serviceStatusText: row.serviceStatus === 'ACTIVE'
          ? 'Đang hoạt động'
          : 'Đã ngừng hoạt động',
        paymentText: row.paymentStatus ? PAYMENT_TEXT[row.paymentStatus] : null,
        methodText: row.paymentMethod ? METHOD_TEXT[row.paymentMethod] : null,
        staffRating,
        staffReviewCount,
        availability,
        images: images.map((item) => ({ ...item, id: String(item.id) })),
        addons: addons.map((item) => ({
          ...item,
          id: String(item.id),
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
        events,
        review: review
          ? { ...review, id: String(review.id), rating: Number(review.rating) }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Sửa lịch: trạng thái / nhân viên / thời gian / lý do hủy
   ---------------------------------------------------------------
   Ba luật quan trọng nhất ở đây:

     1. Chuyển trạng thái đi qua `canTransition` — bảng luật duy nhất ở
        booking-state.js. Trước đây mỗi controller tự liệt kê, nên có cả
        những đường đi sai như PENDING → COMPLETED.

     2. Đổi giờ dùng THỜI LƯỢNG CHỤP TRÊN LỊCH (booking.service_duration,
        booking.buffer_time), không đọc services.duration hiện tại. Nếu
        đọc giá trị hiện tại thì sau khi Admin đổi thời lượng dịch vụ, một
        lịch cũ đổi giờ sẽ bị kéo dài theo thời lượng mới — khách đã đặt
        theo 60 phút thì không nên thành 90 phút.

     3. Xác nhận lịch (PENDING → CONFIRMED) phải kiểm tra lại khả dụng
        ngay lúc xác nhận, không chỉ lúc khách đặt. Giữa hai thời điểm
        đó nhân viên có thể đã nhận việc khác.
   ================================================================ */
export async function patchBooking(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã lịch không hợp lệ.' });

    await connection.beginTransaction();

    /* Đọc trong giao dịch kèm khoá dòng: hai Admin sửa cùng một lịch thì
       người sau phải chờ và thấy trạng thái mới nhất. */
    const [[current]] = await connection.query(
      `SELECT b.start_time AS startsAt, b.end_time AS endsAt,
              b.status, b.staff_id AS staffId, b.service_id AS serviceId,
              b.customer_id AS customerId,
              COALESCE(b.service_duration, s.duration) AS duration,
              COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime
         FROM booking b JOIN services s ON s.service_id = b.service_id
        WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [id],
    );
    if (!current) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }

    const body = req.body ?? {};
    const set = [];
    const params = [];

    /* ---- Trạng thái ---- */
    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();

      /* Hai bước CONFIRMED → PROCESSING và PROCESSING → COMPLETED thuộc về
         nhân viên đang phục vụ, không phải thao tác của quản trị: nhân viên mới
         là người bấm "bắt đầu" và "hoàn thành". Chặn ở backend chứ không chỉ
         ẩn nút ở giao diện.

         Kiểm tra quyền TRƯỚC kiểm tra luật chuyển trạng thái: nếu để sau thì
         PENDING → PROCESSING trả về 409 "không chuyển được" — đúng là đúng,
         nhưng thông báo sai nguyên nhân, và người đọc không biết mình thiếu
         quyền hay đi sai bước. */
      if ((current.status === 'CONFIRMED' && status === 'PROCESSING')
        || (current.status === 'PROCESSING' && status === 'COMPLETED')) {
        await connection.rollback();
        return res.status(403).json({
          message: `Chuyển sang "${STATUS_TEXT[status]}" do nhân viên thực hiện `
            + 'lúc phục vụ, không phải thao tác của quản trị.',
        });
      }

      const transition = canTransition(current.status, status);
      if (!transition.ok) {
        await connection.rollback();
        return res.status(409).json({ message: transition.reason });
      }

      /* Xác nhận lịch thì bắt buộc phải có nhân viên. */
      if (status === 'CONFIRMED' && !body.staffId && !current.staffId) {
        await connection.rollback();
        return res.status(409).json({ message: 'Chưa phân công nhân viên thì không xác nhận được lịch.' });
      }

      set.push('b.status = ?'); params.push(status);
      if (status === 'CANCELLED') {
        const reason = String(body.cancelReason ?? '').trim().slice(0, 255);
        if (!reason) {
          await connection.rollback();
          return res.status(400).json({ message: 'Vui lòng nhập lý do hủy lịch.' });
        }
        set.push('b.cancel_reason = ?', 'b.cancelled_at = NOW()', "b.cancelled_by = 'ADMIN'");
        params.push(reason);
      }
      if (status === 'NO_SHOW' && current.status === 'CONFIRMED') {
        /* Số lần khách không đến tăng lên — dùng để đánh giá độ tin cậy
           của một khách. */
        await connection.query(
          'UPDATE customer SET no_show_count = no_show_count + 1 WHERE customer_id = ?',
          [current.customerId]);
      }
      if (status === 'COMPLETED') {
        /* Thời gian phục vụ thật (xem actualServiceMinutes), không phải
           thời lượng dự kiến. */
        set.push('b.actual_duration = ?');
        params.push(await actualServiceMinutes(connection, id, current.duration));
      }
    }

    /* ---- Ai còn được sửa lịch ----
       Lịch đã xong / đã hủy / khách không đến là dữ liệu lịch sử: sửa người
       hoặc giờ của nó sẽ làm sai báo cáo doanh thu và lịch làm việc. Lịch đang
       thực hiện thì dịch vụ đã bắt đầu, đổi giờ không còn ý nghĩa. */
    const movingSchedule = body.staffId !== undefined
      || body.date !== undefined || body.time !== undefined;
    if (movingSchedule) {
      if (SETTLED_STATUSES.includes(current.status)) {
        await connection.rollback();
        return res.status(409).json({
          message: `Lịch đã ở trạng thái "${STATUS_TEXT[current.status]}" `
            + 'nên không đổi được người hoặc giờ.',
        });
      }
      if (current.status === 'PROCESSING') {
        await connection.rollback();
        return res.status(409).json({
          message: 'Dịch vụ đang thực hiện nên không đổi được người hoặc giờ.',
        });
      }
    }

    /* ---- Nhân viên ---- */
    let staffId = current.staffId;
    if (body.staffId !== undefined) {
      staffId = body.staffId === null || body.staffId === '' ? null : Number(body.staffId);
      if (staffId !== null) { set.push('b.staff_id = ?'); params.push(staffId); }
    }

    /* ---- Thời gian ----
       Dùng duration và buffer chụp trên chính lịch này, không đọc
       services.duration hiện tại: xem ghi chú đầu hàm. */
    let startsAt = current.startsAt;
    let endsAt = current.endsAt;
    if (body.date !== undefined || body.time !== undefined) {
      const day = body.date ?? dayOf(current.startsAt);
      const time = String(body.time ?? clock(current.startsAt)).slice(0, 5);
      startsAt = momentOf(day, time);
      endsAt = new Date(
        startsAt.getTime() + (Number(current.duration) + Number(current.bufferTime ?? 0)) * 60000,
      );
      set.push('b.start_time = ?', 'b.end_time = ?');
      params.push(startsAt, endsAt);
    }

    /* ---- Kiểm tra khả dụng trước khi lưu ----
       Chạy khi lịch còn "sống" (chưa hủy, chưa khách không đến, chưa xong)
       và đã có nhân viên. Lịch đã kết thúc thì không còn ý nghĩa với ca
       làm việc nên không kiểm tra.

       Vì đang trong giao dịch nên khoá dòng lịch của nhân viên trước rồi
       mới hỏi khả dụng — FOR UPDATE chỉ có tác dụng trong giao dịch. */
    const target = body.status ? String(body.status).toUpperCase() : current.status;
    const willRun = !SETTLED_STATUSES.includes(target);

    if (willRun && staffId) {
      const { check } = await recheckAfterMove(connection, {
        bookingId: id,
        staffId,
        serviceId: current.serviceId,
        startsAt,
        duration: Number(current.duration),
        bufferTime: Number(current.bufferTime ?? 0),
      });
      if (!check.ok) {
        await connection.rollback();
        return res.status(409).json({
          message: `Không thể lưu: ${check.reason}`,
          reason: check.reason,
          conflict: check.conflict ?? null,
        });
      }
    }

    if (!set.length) {
      await connection.rollback();
      return res.json({ data: { id: String(id), unchanged: true } });
    }

    params.push(id);
    await connection.query(`UPDATE booking b SET ${set.join(', ')} WHERE b.booking_id = ?`, params);

    /* Ghi lại từng thay đổi vào lịch sử. Chỉ ghi những gì đã thật sự xảy ra,
       và mô tả bằng tiếng Việt có số liệu cụ thể để đọc lại là hiểu ngay. */
    const actorName = req.user?.name ?? 'Quản trị viên';
    const day = dayOf(startsAt);
    const slot = `${clockOf(startsAt)}–${clockOf(endsAt)}`;

    if (body.staffId !== undefined && staffId !== current.staffId) {
      const [[oldStaff]] = await connection.query(
        'SELECT full_name FROM users WHERE user_id = (SELECT user_id FROM staff WHERE staff_id = ?)',
        [current.staffId]);
      const [[newStaff]] = await connection.query(
        'SELECT full_name FROM users WHERE user_id = (SELECT user_id FROM staff WHERE staff_id = ?)',
        [staffId]);
      await logEvent({
        bookingId: id,
        type: 'STAFF_CHANGED',
        detail: `Đổi nhân viên từ ${oldStaff?.full_name ?? 'chưa phân công'} `
          + `sang ${newStaff?.full_name ?? 'chưa phân công'}.`,
        actorRole: 'ADMIN',
        actorName,
        connection,
      });
    }

    if ((body.date !== undefined || body.time !== undefined)
      && set.some((item) => item.includes('start_time'))) {
      await logEvent({
        bookingId: id,
        type: 'RESCHEDULED',
        detail: `Đổi thời gian sang ${day} ${slot}.`,
        actorRole: 'ADMIN',
        actorName,
        connection,
      });
    }

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      const EVENT = {
        CONFIRMED: ['CONFIRMED', 'Xác nhận lịch hẹn.'],
        PROCESSING: ['SERVICE_STARTED', 'Bắt đầu thực hiện dịch vụ.'],
        COMPLETED: ['SERVICE_COMPLETED', 'Hoàn thành dịch vụ.'],
        CANCELLED: ['CANCELLED', `Hủy lịch. Lý do: ${body.cancelReason ?? 'không ghi nhận'}.`],
        NO_SHOW: ['NO_SHOW', 'Đánh dấu khách không đến.'],
      }[status];
      if (EVENT) {
        await logEvent({
          bookingId: id, type: EVENT[0], detail: EVENT[1], actorRole: 'ADMIN', actorName, connection,
        });
      }
    }

    await connection.commit();
    res.json({
      data: { id: String(id), startsAt, endsAt, staffId: staffId == null ? null : String(staffId) },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   Kiểm tra khả dụng — gọi trước khi mở hộp xác nhận hoặc hộp đổi người
   ================================================================ */
export async function postAvailability(req, res, next) {
  try {
    const bookingId = req.body.bookingId ? Number(req.body.bookingId) : null;
    const serviceId = Number(req.body.serviceId);
    const startsAt = toDate(req.body.startsAt);
    const endsAt = toDate(req.body.endsAt);

    if (!Number.isInteger(serviceId) || !startsAt || !endsAt) {
      return res.status(400).json({ message: 'Thiếu dịch vụ hoặc thời gian cần kiểm tra.' });
    }

    if (bookingId) {
      const [[row]] = await pool.query('SELECT staff_id AS staffId FROM booking WHERE booking_id = ?', [bookingId]);
      if (row?.staffId) {
        const check = await checkStaffAvailable({
          bookingId, staffId: row.staffId, serviceId, startsAt, endsAt,
        });
        return res.json({ data: { ok: check.ok, reason: check.reason ?? null, conflict: check.conflict ?? null } });
      }
    }

    const list = await listAvailableStaff({ bookingId, serviceId, startsAt, endsAt });
    res.json({ data: list });
  } catch (error) {
    next(error);
  }
}

/** Danh sách nhân viên, kèm lý do loại, để đổ vào hộp chọn người. */
export async function getAvailableStaff(req, res, next) {
  try {
    const bookingId = req.query.bookingId ? Number(req.query.bookingId) : null;
    const serviceId = Number(req.query.serviceId);
    const startsAt = toDate(req.query.startsAt);
    const endsAt = toDate(req.query.endsAt);

    if (!Number.isInteger(serviceId) || !startsAt || !endsAt) {
      return res.status(400).json({ message: 'Thiếu dịch vụ hoặc thời gian.' });
    }

    res.json({ data: await listAvailableStaff({ bookingId, serviceId, startsAt, endsAt }) });
  } catch (error) {
    next(error);
  }
}

/**
 * Các khung giờ còn trống, để đổ vào hộp chọn giờ.
 *
 * `bookingId` là lịch đang sửa: độ dài lấy từ snapshot trên chính lịch
 * đó (service_duration + buffer_time), không đọc services.duration hiện
 * tại. Nếu không, đổi giờ một lịch cũ sau khi dịch vụ đã đổi thời lượng
 * sẽ bị kéo theo thời lượng mới.
 */
export async function getFreeSlots(req, res, next) {
  try {
    const staffId = Number(req.query.staffId);
    const serviceId = Number(req.query.serviceId);
    const day = String(req.query.day ?? '');
    const bookingId = req.query.bookingId ? Number(req.query.bookingId) : null;

    if (!Number.isInteger(staffId) || !Number.isInteger(serviceId) || !isDate(day)) {
      return res.status(400).json({ message: 'Thiếu nhân viên, dịch vụ hoặc ngày.' });
    }

    let duration;
    let bufferTime;
    if (bookingId) {
      const [[row]] = await pool.query(
        `SELECT COALESCE(b.service_duration, s.duration) AS duration,
                COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime
           FROM booking b JOIN services s ON s.service_id = b.service_id
          WHERE b.booking_id = ? LIMIT 1`, [bookingId],
      );
      if (!row) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
      duration = Number(row.duration);
      bufferTime = Number(row.bufferTime ?? 0);
    }

    const slots = await freeSlotsForStaff({
      bookingId, staffId, serviceId, day, duration, bufferTime,
    });
    res.json({ data: slots, meta: { count: slots.length } });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Tạo lịch tại quầy cho khách walk-in
   ---------------------------------------------------------------
   Khác khách đặt trên Mobile ở đúng một chỗ: đường này không có
   customer_id bắt buộc. Khách chưa có tài khoản thì KHÔNG tạo tài
   khoản, KHÔNG tạo mật khẩu, mà lưu tên và số điện thoại ngay trên
   lịch (guest_name, guest_phone).

   Mọi phần còn lại — chống đặt trùng, kiểm tra ca làm việc, chụp giá —
   đi qua đúng hàm createBookingRecord mà Mobile dùng, nên không bao
   giờ có chuyện quầy cho phép cái mà ứng dụng chặn.
   ================================================================ */
export async function createBooking(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const serviceId = Number(req.body.serviceId);
    const day = String(req.body.day ?? '').trim();
    const time = String(req.body.time ?? '').trim();
    const note = String(req.body.note ?? '').trim().slice(0, 1000) || null;

    if (!Number.isInteger(serviceId) || !isDate(day) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: 'Thiếu dịch vụ, ngày hoặc giờ.' });
    }

    await connection.beginTransaction();

    /* ---- Khách ----
       Có customerId thì dùng lại hồ sơ đã có. Không có thì đây là khách
       walk-in chưa có tài khoản. */
    let customerId = Number(req.body.customerId) || null;
    let guestName = null;
    let guestPhone = null;

    if (!customerId) {
      guestName = String(req.body.guestName ?? '').trim().slice(0, 100);
      guestPhone = normalisePhone(req.body.guestPhone);
      if (!guestName) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Khách chưa có tài khoản thì cần nhập tên khách.',
        });
      }
      if (!guestPhone) {
        await connection.rollback();
        return res.status(400).json({ message: 'Cần nhập số điện thoại khách.' });
      }

      /* Số điện thoại đã có hồ sơ thì hỏi lại thay vì tạo trùng: tạo thêm
         một hồ sơ cùng số điện thoại sẽ làm vỡ lịch sử khách. */
      const [[existing]] = await connection.query(
        `SELECT c.customer_id FROM customer c JOIN users u ON u.user_id = c.user_id
          WHERE u.phone = ? LIMIT 1`, [guestPhone]);
      if (existing) {
        customerId = existing.customer_id;
        guestName = null;
        guestPhone = null;
      }
    }

    const service = await loadActiveService(connection, serviceId);

    const record = await createBookingRecord(connection, {
      serviceId,
      staffId: Number(req.body.staffId) || null,
      customerId,
      guestName,
      guestPhone,
      startsAt: momentOf(day, time),
      price: service.price,
      duration: service.duration,
      bufferTime: service.bufferTime,
      source: 'WALK_IN',
      note,
      actorRole: 'ADMIN',
      actorName: req.user?.name ?? 'Quản trị viên',
    });

    await connection.commit();

    res.status(201).json({
      data: {
        id: String(record.bookingId),
        code: bookingCode(record.bookingId),
        /* Khách có hồ sơ thì lưu tên vào đúng hồ sơ, không sinh tài khoản. */
        customerId: customerId ? String(customerId) : null,
        guestName,
        staffId: String(record.staffId),
      },
    });
  } catch (error) {
    await connection.rollback();
    if (error.status) {
      return res.status(error.status).json({
        message: error.message, reason: error.reason, conflict: error.conflict,
      });
    }
    return next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   Dịch vụ phát sinh (add-on)
   ---------------------------------------------------------------
   Luật nghiệp vụ:
     - Nhân viên chỉ thêm được khi lịch đang PROCESSING (khách đang ngồi,
       nhân viên mới thấy mình còn làm thêm được món gì).
     - Quản trị thêm được ở CONFIRMED / PROCESSING / COMPLETED, nhưng
       chỉ khi khách CHƯA thanh toán — đã PAID thì khoá lại, vì số tiền
       khách trả rồi mà thêm dịch vụ thì hoá đơn sai.
     - CANCELLED / NO_SHOW thì không thêm được.

   Tên và đơn giá được chụp lại lúc thêm, không đọc từ bảng services khi
   in hoá đơn: sau này đổi tên hoặc đổi giá thì các lịch cũ vẫn phải ra
   đúng số tiền khách đã trả.
   ================================================================ */
export async function addAddon(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const bookingId = Number(req.params.id);
    const serviceId = Number(req.body.serviceId);
    /* Giới hạn 1..20: một lịch có nhiều món phát sinh là bình thường,
       nhưng số lượng vô hạn là dấu hiệu gõ nhầm. */
    const quantity = Number(req.body.quantity ?? 1);
    const requested = Number.isInteger(quantity) && quantity >= 1 && quantity <= 20
      ? quantity : 1;

    if (!Number.isInteger(bookingId) || !Number.isInteger(serviceId)) {
      return res.status(400).json({ message: 'Mã lịch hẹn hoặc dịch vụ không hợp lệ.' });
    }

    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.status, b.staff_id AS staffId, pay.payment_status AS paymentStatus
         FROM booking b
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [bookingId],
    );
    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }

    const actorRole = req.user?.role ?? 'ADMIN';

    if (actorRole === 'STAFF') {
      if (booking.staffId !== req.user.staffId) {
        await connection.rollback();
        return res.status(403).json({ message: 'Lịch hẹn này không được phân công cho bạn.' });
      }
      if (booking.status !== 'PROCESSING') {
        await connection.rollback();
        return res.status(409).json({
          message: 'Chỉ thêm được dịch vụ phát sinh khi khách đang được phục vụ '
            + `(trạng thái "${STATUS_TEXT[booking.status]}").`,
        });
      }
    } else {
      if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
        await connection.rollback();
        return res.status(409).json({
          message: `Lịch đã ${STATUS_TEXT[booking.status].toLowerCase()} nên không thêm được dịch vụ phát sinh.`,
        });
      }
      if (booking.paymentStatus === 'PAID') {
        await connection.rollback();
        return res.status(409).json({
          message: 'Lịch đã thanh toán nên không thêm được dịch vụ phát sinh. '
            + 'Thêm rồi thì số tiền khách đã trả sẽ không còn khớp.',
        });
      }
    }

    const [[svc]] = await connection.query(
      `SELECT service_name, price FROM services
        WHERE service_id = ? AND status = 'ACTIVE' LIMIT 1`, [serviceId]);
    if (!svc) {
      await connection.rollback();
      return res.status(404).json({ message: 'Dịch vụ không tồn tại hoặc đã ngừng hoạt động.' });
    }

    try {
      await connection.query(
        `INSERT INTO booking_addon
           (booking_id, service_id, service_name, quantity, price, added_by_role)
         VALUES (?,?,?,?,?,?)`,
        [bookingId, serviceId, svc.service_name, requested, svc.price, actorRole],
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        await connection.rollback();
        return res.status(409).json({ message: `Lịch này đã có "${svc.service_name}" rồi.` });
      }
      throw error;
    }

    const total = Number(svc.price) * requested;
    await logEvent({
      bookingId,
      type: 'ADDON_ADDED',
      detail: `Thêm dịch vụ phát sinh: ${svc.service_name} ×${requested} `
        + `- ${total.toLocaleString('vi-VN')} đ.`,
      actorRole,
      actorName: req.user?.name ?? 'Quản trị viên',
      connection,
    });

    await connection.commit();
    res.status(201).json({
      data: {
        serviceId: String(serviceId),
        name: svc.service_name,
        quantity: requested,
        price: Number(svc.price),
        total,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* Bỏ một dịch vụ phát sinh khỏi lịch.
 *
 * Đối xứng với addAddon: đã PAID thì khoá lại — thu 500.000đ rồi mà
 * xoá món phát sinh thì tổng lịch giảm còn 400.000đ trong khi khoản
 * thanh toán vẫn 500.000đ. Lịch đã hủy / khách không đến cũng không
 * sửa được, vì đó là dữ liệu lịch sử. */
export async function removeAddon(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const bookingId = Number(req.params.id);
    const addonId = Number(req.params.addonId);
    if (!Number.isInteger(bookingId) || !Number.isInteger(addonId)) {
      return res.status(400).json({ message: 'Mã lịch hẹn hoặc dịch vụ phát sinh không hợp lệ.' });
    }

    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.status, pay.payment_status AS paymentStatus
         FROM booking b
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [bookingId]);
    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }
    if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Lịch đã kết thúc nên không sửa được dịch vụ phát sinh.',
      });
    }
    if (booking.paymentStatus === 'PAID') {
      await connection.rollback();
      return res.status(409).json({
        message: 'Lịch đã thanh toán nên không bỏ được dịch vụ phát sinh. '
          + 'Bỏ rồi thì số tiền khách đã trả sẽ không còn khớp.',
      });
    }

    const [[addon]] = await connection.query(
      `SELECT s.service_name AS name, ba.price, ba.quantity FROM booking_addon ba
         JOIN services s ON s.service_id = ba.service_id
        WHERE ba.addon_id = ? AND ba.booking_id = ? LIMIT 1`, [addonId, bookingId]);
    if (!addon) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ phát sinh.' });
    }

    await connection.query(
      'DELETE FROM booking_addon WHERE addon_id = ? AND booking_id = ?', [addonId, bookingId]);

    await logEvent({
      bookingId,
      type: 'ADDON_REMOVED',
      detail: `Bỏ dịch vụ phát sinh: ${addon.name} ×${addon.quantity} - `
        + `${(Number(addon.price) * Number(addon.quantity)).toLocaleString('vi-VN')} đ.`,
      actorRole: req.user?.role ?? 'ADMIN',
      actorName: req.user?.name ?? 'Quản trị viên',
      connection,
    });

    await connection.commit();
    res.json({ data: { removed: true } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* Ảnh mẫu khách gửi kèm lịch hẹn. */
export async function addImage(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const url = String(req.body.url ?? '').trim().slice(0, 255);
    if (!url) return res.status(400).json({ message: 'Cần đường dẫn ảnh.' });

    const [[booking]] = await pool.query(
      'SELECT booking_id FROM booking WHERE booking_id = ? LIMIT 1', [bookingId]);
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });

    const [result] = await pool.query(
      'INSERT INTO booking_image (booking_id, image_url) VALUES (?,?)', [bookingId, url]);
    res.status(201).json({ data: { id: String(result.insertId), url } });
  } catch (error) {
    next(error);
  }
}

export async function removeImage(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const [result] = await pool.query(
      'DELETE FROM booking_image WHERE image_id = ? AND booking_id = ?', [imageId, bookingId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy ảnh.' });
    res.json({ data: { removed: true } });
  } catch (error) {
    next(error);
  }
}
