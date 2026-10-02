/* ===== API lịch hẹn phía khách hàng (ứng dụng Mobile) =====

   Trước đây các lệnh này tin hoàn toàn vào request: `customerId ?? 1`,
   `staffId` lấy từ body. Bất kỳ ai cũng có thể gửi customerId của
   người khác để xem lịch của họ. Nay mọi id đều lấy từ token:

     customerId  ← req.user.customerId  (không nhận từ body)
     staffId     ← req.user.staffId     (nhân viên đang đăng nhập)

   Ngoài ra hai điểm nghiệp vụ đã được sửa ở đây:
     - Lịch chụp lại giá / thời lượng / buffer lúc đặt. Nếu không, sau
       này Admin đổi giá dịch vụ thì lịch cũ hiện sai số tiền khách
       đã trả.
     - end_time = start + thời lượng + buffer, và khi hiển thị thì tách
       rõ mốc kết thúc dịch vụ (trừ buffer) với mốc nhân viên rảnh
       lại (giữ nguyên end_time). */

import { pool } from '../config/database.js';
import { logEvent } from '../lib/booking-events.js';
import { canStaffTransition, canTransition } from '../lib/booking-state.js';
import {
  createBooking as createBookingRecord, isDate, loadActiveService, momentOf,
} from '../lib/booking-service.js';
import { freeSlotsForStaff } from '../lib/staff-availability.js';

/** Điểm hủy lịch: khách được hủy lịch còn trên 2 giờ nếu đã xác nhận. */
export const CANCEL_WINDOW_HOURS = 2;

/** Đường dẫn ảnh trong DB là dạng tương đối, cần ghép thành URL đầy đủ. */
function imageUrl(req, value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${req.protocol}://${req.get('host')}${path}`;
}

function isDateTime(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

/* ================================================================
   Lịch hẹn của khách đang đăng nhập
   ---------------------------------------------------------------
   Không nhận customerId từ query: chỉ có một khách hợp lệ là người
   đang đăng nhập. Trả kèm trạng thái thanh toán vì khách cần biết
   đã trả chưa, và tổng tiền đúng bằng giá lúc đặt + dịch vụ phát sinh.
   ================================================================ */
export async function getBookings(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT b.booking_id AS id, b.customer_id AS customerId,
        b.service_id AS serviceId, b.staff_id AS staffId,
        b.start_time AS startsAt, b.end_time AS endsAt,
        b.status, b.note, b.source, b.created_at AS createdAt,
        b.cancel_reason AS cancelReason, b.cancelled_at AS cancelledAt,
        COALESCE(b.service_price, s.price) AS price,
        COALESCE(b.service_duration, s.duration) AS duration,
        COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime,
        s.service_name AS serviceName, s.image AS serviceImage,
        u.full_name AS staffName, u.avatar AS staffAvatar,
        pay.payment_status AS paymentStatus, pay.payment_method AS paymentMethod,
        pay.amount AS paidAmount,
        COALESCE(addon.total, 0) AS addonTotal, COALESCE(addon.count, 0) AS addonCount
       FROM booking b
       JOIN services s ON s.service_id = b.service_id
       LEFT JOIN staff st ON st.staff_id = b.staff_id
       LEFT JOIN users u ON u.user_id = st.user_id
       LEFT JOIN payment pay ON pay.booking_id = b.booking_id
       LEFT JOIN (
         /* price * quantity: dịch vụ phát sinh có số lượng, cộng
            SUM(price) sẽ tính thiếu khi khách chọn từ 2 cái trở lên. */
         SELECT booking_id, SUM(price * quantity) AS total, COUNT(*) AS count
           FROM booking_addon GROUP BY booking_id
       ) addon ON addon.booking_id = b.booking_id
      WHERE b.customer_id = ?
      ORDER BY b.start_time DESC`,
      [req.user.customerId],
    );

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        customerId: String(row.customerId),
        serviceId: String(row.serviceId),
        staffId: row.staffId == null ? null : String(row.staffId),
        status: row.status.toLowerCase(),
        price: Number(row.price),
        duration: Number(row.duration),
        bufferTime: Number(row.bufferTime ?? 0),
        addonTotal: Number(row.addonTotal),
        addonCount: Number(row.addonCount),
        /* Tổng = giá dịch vụ lúc đặt + dịch vụ phát sinh. */
        total: Number(row.price) + Number(row.addonTotal),
        paidAmount: row.paidAmount == null ? null : Number(row.paidAmount),
        serviceImageUrl: imageUrl(req, row.serviceImage),
        staffAvatarUrl: imageUrl(req, row.staffAvatar),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Khung giờ còn trống
   ================================================================ */
export async function getAvailableSlots(req, res, next) {
  try {
    const serviceId = Number(req.query.serviceId);
    const staffId = Number(req.query.staffId);
    const date = String(req.query.date ?? '');

    if (!Number.isInteger(serviceId) || !Number.isInteger(staffId) || !isDate(date)) {
      return res.status(400).json({ message: 'Dịch vụ, chuyên viên hoặc ngày không hợp lệ.' });
    }

    const [[svc]] = await pool.query(
      `SELECT s.service_name, s.duration, s.buffer_time AS bufferTime
         FROM services s
         JOIN staff_service ss ON ss.service_id = s.service_id
        WHERE s.service_id = ? AND ss.staff_id = ? AND s.status = 'ACTIVE' LIMIT 1`,
      [serviceId, staffId],
    );
    if (!svc) return res.status(404).json({ message: 'Chuyên viên không thực hiện dịch vụ này.' });

    /* Gọi đúng hàm sinh khung giờ của hệ thống, không tự tính lại ở đây.
       Nếu ở đây có một cách tính riêng thì lúc này báo "còn trống" nhưng
       lúc đặt backend lại từ chối — đúng lỗi khách hài lòng nhất. */
    const slots = await freeSlotsForStaff({
      staffId, serviceId, day: date, duration: Number(svc.duration), bufferTime: Number(svc.bufferTime ?? 0),
    });

    /* Khung giờ đã qua trong ngày hôm nay thì không đặt được nữa. */
    const today = new Date();
    const isToday = date === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const nowMinute = isToday ? today.getHours() * 60 + today.getMinutes() : -1;

    res.json({
      data: slots.filter((slot) => {
        if (!isToday) return true;
        const [hour, minute] = slot.split(':').map(Number);
        return hour * 60 + minute > nowMinute;
      }),
      meta: { duration: Number(svc.duration), bufferTime: Number(svc.bufferTime ?? 0) },
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Khách đặt lịch
   ================================================================ */
export async function createBooking(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const serviceId = Number(req.body.serviceId);
    const staffId = Number(req.body.staffId);
    const date = String(req.body.date ?? '');
    const time = String(req.body.time ?? '');
    const note = String(req.body.note ?? '').trim().slice(0, 1000) || null;

    if (!Number.isInteger(serviceId) || !isDate(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: 'Thông tin đặt lịch không hợp lệ.' });
    }
    /* Không chỉ định nhân viên thì để backend tự chọn người phù hợp. */
    if (staffId !== undefined && staffId !== null && staffId !== '' && !Number.isInteger(Number(staffId))) {
      return res.status(400).json({ message: 'Mã chuyên viên không hợp lệ.' });
    }

    await connection.beginTransaction();

    const service = await loadActiveService(connection, serviceId);
    const record = await createBookingRecord(connection, {
      serviceId,
      staffId: Number(staffId) || null,
      customerId: req.user.customerId,
      startsAt: momentOf(date, time),
      /* Chụp lại ngay lúc đặt: giá, thời lượng và buffer của dịch vụ
         hôm nay. Lịch cũ giữ nguyên ba con số này về sau. */
      price: service.price,
      duration: service.duration,
      bufferTime: service.bufferTime,
      source: 'MOBILE',
      note,
      actorRole: 'CUSTOMER',
      actorName: req.user.name,
    });

    await connection.commit();

    res.status(201).json({
      data: {
        id: String(record.bookingId),
        customerId: String(req.user.customerId),
        serviceId: String(serviceId),
        staffId: String(record.staffId),
        startsAt: record.startsAt,
        endsAt: record.endsAt,
        status: 'pending',
        price: service.price,
        duration: service.duration,
        bufferTime: service.bufferTime,
        note,
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
   Khách hủy lịch
   ---------------------------------------------------------------
   Luật:
     PENDING   → hủy được ngay
     CONFIRMED → hủy được nếu còn trên 2 giờ
     PROCESSING / COMPLETED / CANCELLED / NO_SHOW → không hủy được

   Chỉ chính chủ lịch hủy được: so sánh booking.customer_id với
   req.user.customerId. Không dựa vào việc frontend ẩn nút.
   ================================================================ */
export async function cancelBooking(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });

    const reason = String(req.body?.reason ?? '').trim().slice(0, 255) || 'Khách hủy lịch';

    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.booking_id, b.customer_id AS customerId, b.status,
              b.start_time AS startsAt, s.service_name AS serviceName
         FROM booking b JOIN services s ON s.service_id = b.service_id
        WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [id],
    );

    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }

    /* Chỉ chủ lịch mới hủy được lịch của mình. */
    if (booking.customerId !== req.user.customerId) {
      await connection.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền hủy lịch hẹn này.' });
    }

    const transition = canTransition(booking.status, 'CANCELLED');
    if (!transition.ok) {
      await connection.rollback();
      return res.status(409).json({ message: transition.reason });
    }

    /* Đã xác nhận rồi thì phải còn trên 2 giờ mới hủy được — cửa hàng cần
       thời gian sắp xếp lại nhân viên. */
    if (booking.status === 'CONFIRMED') {
      const hoursLeft = (new Date(booking.startsAt).getTime() - Date.now()) / 3600000;
      if (hoursLeft < CANCEL_WINDOW_HOURS) {
        await connection.rollback();
        return res.status(409).json({
          message: `Lịch đã xác nhận chỉ còn dưới ${CANCEL_WINDOW_HOURS} giờ `
            + `nên không thể tự hủy. Vui lòng liên hệ cửa hàng.`,
        });
      }
    }

    await connection.query(
      `UPDATE booking
          SET status = 'CANCELLED', cancel_reason = ?, cancelled_at = NOW(),
              cancelled_by = 'CUSTOMER'
        WHERE booking_id = ?`,
      [reason, id],
    );

    await logEvent({
      bookingId: id,
      type: 'CANCELLED',
      detail: `Khách hủy lịch. Lý do: ${reason}.`,
      actorRole: 'CUSTOMER',
      actorName: req.user.name,
      connection,
    });

    await connection.commit();
    res.json({ data: { id: String(id), status: 'CANCELLED', cancelReason: reason } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   Nhân viên cập nhật tiến trình phục vụ
   ---------------------------------------------------------------
   Chỉ hai bước: CONFIRMED → PROCESSING và PROCESSING → COMPLETED,
   và chỉ trên lịch được phân công cho chính nhân viên đang đăng nhập.
   Không nhận staffId từ body — lấy từ token.
   ================================================================ */
const STAFF_STEP_TEXT = {
  PROCESSING: 'Bắt đầu thực hiện dịch vụ.',
  COMPLETED: 'Hoàn thành dịch vụ.',
};

export async function updateBookingStatus(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const nextStatus = String(req.body.status ?? '').toUpperCase();

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });
    }

    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.booking_id, b.status, b.staff_id AS staffId, su.full_name AS staffName,
              b.service_id AS serviceId, b.service_duration AS serviceDuration,
              s.service_name AS serviceName,
              pay.payment_status AS paymentStatus
         FROM booking b
         JOIN services s ON s.service_id = b.service_id
         LEFT JOIN staff st ON st.staff_id = b.staff_id
         LEFT JOIN users su ON su.user_id = st.user_id
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [id],
    );

    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }

    /* Lịch phải được phân công cho chính nhân viên đang đăng nhập. Trước
       đây lấy staffId từ body, nghĩa là chỉ cần gửi id của người khác là
       thao tác được lịch của họ. */
    if (booking.staffId !== req.user.staffId) {
      await connection.rollback();
      return res.status(403).json({ message: 'Lịch hẹn này không được phân công cho bạn.' });
    }

    const transition = canStaffTransition(booking.status, nextStatus);
    if (!transition.ok) {
      await connection.rollback();
      return res.status(409).json({ message: transition.reason });
    }

    const set = ['status = ?'];
    const params = [nextStatus];
    /* Ghi lại thời lượng thực tế khi hoàn thành để báo cáo "thời gian phục
       vụ trung bình" phản ánh đúng việc thực tế. */
    if (nextStatus === 'COMPLETED') {
      set.push('actual_duration = ?');
      params.push(booking.serviceDuration);
    }
    params.push(id);
    await connection.query(`UPDATE booking SET ${set.join(', ')} WHERE booking_id = ?`, params);

    await logEvent({
      bookingId: id,
      type: nextStatus === 'PROCESSING' ? 'SERVICE_STARTED' : 'SERVICE_COMPLETED',
      detail: `${STAFF_STEP_TEXT[nextStatus]} Dịch vụ: ${booking.serviceName}.`,
      actorRole: 'STAFF',
      actorName: req.user.name,
      connection,
    });

    await connection.commit();
    res.json({ data: { id: String(id), status: nextStatus } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   Khách đánh giá lịch hẹn
   ---------------------------------------------------------------
   Chỉ đánh giá được lịch của chính mình, đã hoàn thành, và mỗi lịch
   chỉ một lần. Backend kiểm tra lại dù database đã có UNIQUE, vì lỗi
   MySQL trả về (ER_DUP_ENTRY) không giải thích được cho khách hiểu.
   ================================================================ */
export async function createReview(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const bookingId = Number(req.params.bookingId);
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment ?? '').trim().slice(0, 2000) || null;
    const images = Array.isArray(req.body.images)
      ? req.body.images.map((item) => String(item).trim().slice(0, 255)).filter(Boolean).slice(0, 6)
      : [];

    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Vui lòng chấm điểm từ 1 đến 5 sao.' });
    }

    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.customer_id AS customerId, b.status, b.staff_id AS staffId,
              s.service_name AS serviceName
         FROM booking b JOIN services s ON s.service_id = b.service_id
        WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [bookingId],
    );

    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }
    if (booking.customerId !== req.user.customerId) {
      await connection.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền đánh giá lịch hẹn này.' });
    }
    if (booking.status !== 'COMPLETED') {
      await connection.rollback();
      return res.status(409).json({
        message: 'Chỉ đánh giá được lịch đã hoàn thành. '
          + `Lịch này hiện đang ở trạng thái "${booking.status}".`,
      });
    }

    const [[existing]] = await connection.query(
      'SELECT review_id FROM review WHERE booking_id = ? LIMIT 1', [bookingId]);
    if (existing) {
      await connection.rollback();
      return res.status(409).json({ message: 'Lịch này đã được đánh giá rồi.' });
    }

    const [result] = await connection.query(
      `INSERT INTO review (booking_id, customer_id, rating, comment)
       VALUES (?,?,?,?)`, [bookingId, req.user.customerId, rating, comment]);

    for (const url of images) {
      await connection.query(
        'INSERT INTO review_images (review_id, image_url) VALUES (?,?)', [result.insertId, url]);
    }

    await logEvent({
      bookingId,
      type: 'NOTE',
      detail: `Khách đánh giá ${rating}/5 cho dịch vụ ${booking.serviceName}.`,
      actorRole: 'CUSTOMER',
      actorName: req.user.name,
      connection,
    });

    await connection.commit();
    res.status(201).json({
      data: {
        id: String(result.insertId),
        bookingId: String(bookingId),
        rating,
        comment,
        images,
      },
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Lịch này đã được đánh giá rồi.' });
    }
    return next(error);
  } finally {
    connection.release();
  }
}

export { isDateTime };