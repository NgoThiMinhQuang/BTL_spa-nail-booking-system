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
import {
  checkStaffAvailable, freeSlotsForStaff, listAvailableStaff,
} from '../lib/staff-availability.js';
import { logEvent, listEvents } from '../lib/booking-events.js';

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

    if (term) {
      where.push('(u.full_name LIKE ? OR u.phone LIKE ? OR s.service_name LIKE ? OR b.booking_id = ?)');
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
        c.customer_id AS customerId, u.full_name AS customerName, u.phone AS customerPhone,
        u.avatar AS customerAvatarUrl,
        st.staff_id AS staffId, su.full_name AS staffName, su.avatar AS staffAvatarUrl,
        pay.payment_status AS paymentStatus, pay.payment_method AS paymentMethod,
        pay.amount AS paidAmount,
        COALESCE(addon.total, 0) AS addonTotal,
        COALESCE(addon.count, 0) AS addonCount
      FROM booking b
      JOIN services s ON s.service_id = b.service_id
      JOIN customer c ON c.customer_id = b.customer_id
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      LEFT JOIN (
        SELECT booking_id, SUM(price) AS total, COUNT(*) AS count
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
        COALESCE(b.service_price, s.price) AS price,
        COALESCE(b.service_duration, s.duration) AS duration,
        COALESCE(b.buffer_time, s.buffer_time) AS bufferTime,
        s.service_id AS serviceId, s.service_name AS serviceName,
        s.image AS serviceImage, s.status AS serviceStatus,
        s.description AS serviceDescription,
        cat.category_name AS serviceCategory,
        c.customer_id AS customerId, u.full_name AS customerName,
        u.phone AS customerPhone, u.email AS customerEmail,
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
   ================================================================ */
export async function patchBooking(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã lịch không hợp lệ.' });

    const [[current]] = await pool.query(`SELECT b.start_time AS startsAt, b.end_time AS endsAt,
        b.status, b.staff_id AS staffId, b.service_id AS serviceId,
        s.duration, s.buffer_time AS bufferTime
      FROM booking b JOIN services s ON s.service_id = b.service_id
      WHERE b.booking_id = ? LIMIT 1`, [id]);
    if (!current) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });

    const body = req.body ?? {};
    const set = [];
    const params = [];

    /* ---- Trạng thái ---- */
    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      const allowed = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái lịch hẹn không hợp lệ.' });
      }

      /* Đã bắt đầu rồi thì không được quay ngược hay bỏ hủy. */
      if (current.status === 'PROCESSING'
        && !['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(status)) {
        return res.status(409).json({
          message: 'Dịch vụ đang thực hiện. Chỉ có thể chuyển sang Hoàn thành, Không đến hoặc Hủy.',
        });
      }
      if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(current.status)
        && status !== current.status) {
        return res.status(409).json({
          message: `Lịch đã ở trạng thái "${STATUS_TEXT[current.status]}", không chuyển được nữa.`,
        });
      }

      /* Chuyển sang Confirmed thì bắt buộc phải có nhân viên còn nhận lịch. */
      if (status === 'CONFIRMED' && !body.staffId && !current.staffId) {
        return res.status(409).json({ message: 'Chưa phân công nhân viên thì không xác nhận được lịch.' });
      }

      set.push('b.status = ?'); params.push(status);
      if (status === 'CANCELLED') {
        const reason = String(body.cancelReason ?? '').trim().slice(0, 255);
        if (!reason) return res.status(400).json({ message: 'Vui lòng nhập lý do hủy lịch.' });
        set.push('b.cancel_reason = ?', 'b.cancelled_at = NOW()');
        params.push(reason);
      }
    }

    /* ---- Ai còn được sửa lịch ----
       Lịch đã xong / đã hủy / khách không đến là dữ liệu lịch sử: sửa người
       hoặc giờ của nó sẽ làm sai báo cáo doanh thu và lịch làm việc. Lịch đang
       thực hiện thì dịch vụ đã bắt đầu, đổi giờ không còn ý nghĩa. Chặn ở
       backend để không đường nào lọt, không phụ thuộc menu frontend. */
    const movingSchedule = body.staffId !== undefined || body.date !== undefined || body.time !== undefined;
    if (movingSchedule) {
      if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(current.status)) {
        return res.status(409).json({
          message: `Lịch đã ở trạng thái "${STATUS_TEXT[current.status]}" nên không đổi được người hoặc giờ.`,
        });
      }
      if (current.status === 'PROCESSING') {
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

    /* ---- Thời gian ---- */
    let startsAt = current.startsAt;
    let endsAt = current.endsAt;
    if (body.date !== undefined || body.time !== undefined) {
      const base = toDate(current.startsAt);
      const [hour, minute] = String(body.time ?? clock(current.startsAt)).split(':').map(Number);
      const year = body.date ? Number(body.date.slice(0, 4)) : base.getFullYear();
      const month = body.date ? Number(body.date.slice(5, 7)) : base.getMonth() + 1;
      const date = body.date ? Number(body.date.slice(8, 10)) : base.getDate();
      startsAt = new Date(year, month - 1, date, hour, minute, 0);
      const span = (Number(current.duration) + Number(current.bufferTime ?? 0)) * 60000;
      endsAt = new Date(startsAt.getTime() + span);
      set.push('b.start_time = ?', 'b.end_time = ?');
      params.push(startsAt, endsAt);
    }

    /* ---- Kiểm tra khả dụng trước khi lưu ----
       Chỉ kiểm tra khi lịch sắp chạy hoặc đã có nhân viên; lịch CANCELLED /
       NO_SHOW thì không còn ý nghĩa với ca làm việc. */
    const willRun = !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(
      body.status ? String(body.status).toUpperCase() : current.status);

    if (willRun && staffId) {
      const check = await checkStaffAvailable({
        bookingId: id,
        staffId,
        serviceId: current.serviceId,
        startsAt,
        endsAt,
      });
      if (!check.ok) {
        return res.status(409).json({
          message: `Không thể lưu: ${check.reason}`,
          reason: check.reason,
          conflict: check.conflict ?? null,
        });
      }
    }

    if (!set.length) return res.json({ data: { id: String(id), unchanged: true } });

    params.push(id);
    await pool.query(`UPDATE booking b SET ${set.join(', ')} WHERE b.booking_id = ?`, params);

    /* Ghi lại từng thay đổi vào lịch sử. Chỉ ghi những gì đã thật sự xảy ra,
       và mô tả bằng tiếng Việt có số liệu cụ thể để đọc lại là hiểu ngay. */
    const actorName = String(req.body.actorName ?? 'Quản trị viên');
    const day = dayOf(startsAt);
    const slot = `${clockOf(startsAt)}–${clockOf(endsAt)}`;

    if (body.staffId !== undefined && staffId !== current.staffId) {
      const [[oldStaff]] = await pool.query(
        'SELECT full_name FROM users WHERE user_id = (SELECT user_id FROM staff WHERE staff_id = ?)',
        [current.staffId]);
      const [[newStaff]] = await pool.query(
        'SELECT full_name FROM users WHERE user_id = (SELECT user_id FROM staff WHERE staff_id = ?)',
        [staffId]);
      await logEvent({
        bookingId: id,
        type: 'STAFF_CHANGED',
        detail: `Đổi nhân viên từ ${oldStaff?.full_name ?? 'chưa phân công'} `
          + `sang ${newStaff?.full_name ?? 'chưa phân công'}.`,
        actorName,
      });
    }

    if ((body.date !== undefined || body.time !== undefined) && set.some((s) => s.includes('start_time'))) {
      await logEvent({
        bookingId: id,
        type: 'RESCHEDULED',
        detail: `Đổi thời gian sang ${day} ${slot}.`,
        actorName,
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
        await logEvent({ bookingId: id, type: EVENT[0], detail: EVENT[1], actorName });
      }
    }

    res.json({ data: { id: String(id), startsAt, endsAt, staffId: staffId == null ? null : String(staffId) } });
  } catch (error) {
    next(error);
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

/** Các khung giờ còn trống, để đổ vào hộp chọn giờ. */
export async function getFreeSlots(req, res, next) {
  try {
    const staffId = Number(req.query.staffId);
    const serviceId = Number(req.query.serviceId);
    const day = String(req.query.day ?? '');

    if (!Number.isInteger(staffId) || !Number.isInteger(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({ message: 'Thiếu nhân viên, dịch vụ hoặc ngày.' });
    }

    const slots = await freeSlotsForStaff({ staffId, serviceId, day });
    res.json({ data: slots, meta: { count: slots.length } });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Tạo lịch tại quầy cho khách walk-in
   ================================================================ */
export async function createBooking(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const serviceId = Number(req.body.serviceId);
    const day = String(req.body.day ?? '').trim();
    const time = String(req.body.time ?? '').trim();
    const note = String(req.body.note ?? '').trim().slice(0, 1000) || null;
    const staffId = req.body.staffId === null || req.body.staffId === ''
      ? null : Number(req.body.staffId);

    if (!Number.isInteger(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: 'Thiếu dịch vụ, ngày hoặc giờ.' });
    }

    await connection.beginTransaction();

    let customerId = Number(req.body.customerId) || null;
    if (!customerId && req.body.newCustomer) {
      const { name, phone } = req.body.newCustomer;
      if (!String(name ?? '').trim() || !String(phone ?? '').trim()) {
        await connection.rollback();
        return res.status(400).json({ message: 'Khách mới cần có tên và số điện thoại.' });
      }
      const [[found]] = await connection.query('SELECT customer_id FROM customer WHERE user_id = (SELECT user_id FROM users WHERE phone = ?) LIMIT 1', [phone]);
      if (found) {
        customerId = found.customer_id;
      } else {
        const [user] = await connection.query(
          `INSERT INTO users (full_name, phone, role, status) VALUES (?,?,'CUSTOMER','ACTIVE')`,
          [String(name).trim().slice(0, 100), String(phone).trim()]);
        const [cust] = await connection.query(
          'INSERT INTO customer (user_id) VALUES (?)', [user.insertId]);
        customerId = cust.insertId;
      }
    }
    if (!customerId) {
      await connection.rollback();
      return res.status(400).json({ message: 'Vui lòng chọn khách hàng.' });
    }

    const [[svc]] = await connection.query(
      `SELECT duration, buffer_time AS bufferTime, price
         FROM services WHERE service_id = ? LIMIT 1`, [serviceId]);
    if (!svc) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ.' });
    }

    const [hour, minute] = time.split(':').map(Number);
    const [year, month, date] = day.split('-').map(Number);
    const startsAt = new Date(year, month - 1, date, hour, minute, 0);
    const endsAt = new Date(
      startsAt.getTime() + (Number(svc.duration) + Number(svc.bufferTime ?? 0)) * 60000);

    if (staffId) {
      const check = await checkStaffAvailable({ staffId, serviceId, startsAt, endsAt });
      if (!check.ok) {
        await connection.rollback();
        return res.status(409).json({ message: `Không thể tạo lịch: ${check.reason}`, reason: check.reason });
      }
    }

    /* Chụp lại giá, thời gian và buffer ngay lúc đặt. Sau này Admin đổi giá
       dịch vụ thì lịch này vẫn hiện đúng số tiền khách đã trả. */
    const [result] = await connection.query(
      `INSERT INTO booking
         (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
          start_time, end_time, status, note, source)
       VALUES (?,?,?,?,?,?,?,?,'PENDING',?,'WALK_IN')`,
      [customerId, staffId, serviceId, svc.price, svc.duration, svc.bufferTime ?? 0,
        startsAt, endsAt, note]);

    await logEvent({
      bookingId: result.insertId,
      type: 'CREATED',
      detail: 'Lịch được tạo tại quầy.',
      actorRole: 'ADMIN',
      actorName: String(req.body.actorName ?? 'Quản trị viên'),
      connection,
    });

    await connection.commit();

    res.status(201).json({ data: { id: String(result.insertId), code: bookingCode(result.insertId) } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   Dịch vụ phát sinh (add-on)
   ================================================================ */
export async function addAddon(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const serviceId = Number(req.body.serviceId);

    const [[booking]] = await pool.query(
      `SELECT b.status FROM booking b WHERE b.booking_id = ? LIMIT 1`, [bookingId]);
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
      return res.status(409).json({ message: `Lịch đã ${STATUS_TEXT[booking.status].toLowerCase()} nên không thêm được dịch vụ phát sinh.` });
    }

    const [[svc]] = await pool.query(
      'SELECT service_name, price FROM services WHERE service_id = ? LIMIT 1', [serviceId]);
    if (!svc) return res.status(404).json({ message: 'Không tìm thấy dịch vụ.' });

    try {
      await pool.query(
        'INSERT INTO booking_addon (booking_id, service_id, quantity, price) VALUES (?,?,1,?)',
        [bookingId, serviceId, svc.price]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: `Lịch này đã có "${svc.service_name}" rồi.` });
      }
      throw error;
    }

    await logEvent({
      bookingId,
      type: 'ADDON_ADDED',
      detail: `Thêm dịch vụ phát sinh: ${svc.service_name} - ${Number(svc.price).toLocaleString('vi-VN')} đ.`,
      actorName: String(req.body.actorName ?? 'Quản trị viên'),
    });

    res.status(201).json({ data: { serviceId: String(serviceId), name: svc.service_name, price: Number(svc.price) } });
  } catch (error) {
    next(error);
  }
}

export async function removeAddon(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const addonId = Number(req.params.addonId);

    const [[addon]] = await pool.query(
      `SELECT s.service_name AS name, ba.price FROM booking_addon ba
         JOIN services s ON s.service_id = ba.service_id
        WHERE ba.addon_id = ? AND ba.booking_id = ? LIMIT 1`, [addonId, bookingId]);

    const [result] = await pool.query(
      'DELETE FROM booking_addon WHERE addon_id = ? AND booking_id = ?', [addonId, bookingId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy dịch vụ phát sinh.' });

    if (addon) {
      await logEvent({
        bookingId,
        type: 'ADDON_REMOVED',
        detail: `Bỏ dịch vụ phát sinh: ${addon.name} - ${Number(addon.price).toLocaleString('vi-VN')} đ.`,
        actorName: String(req.body?.actorName ?? 'Quản trị viên'),
      });
    }

    res.json({ data: { removed: true } });
  } catch (error) {
    next(error);
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
