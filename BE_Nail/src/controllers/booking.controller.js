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
import { canStaffTransition, canTransition, isCancelWindowOpen } from '../lib/booking-state.js';
import {
  actualServiceMinutes, createBooking as createBookingRecord, isDate, loadActiveService, momentOf,
} from '../lib/booking-service.js';
import { freeSlotsForStaff } from '../lib/staff-availability.js';
import fs from 'node:fs';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/uploads');

/* Upload file ảnh mẫu thật (multipart) — khác đường JSON chỉ nhận URL.
   File nằm dưới public/uploads/references/<bookingId>/ nên phục vụ được
   ngay qua static /uploads có sẵn, không cần thêm hạ tầng. */
const referenceStorage = multer.diskStorage({
  destination(req, file, done) {
    const dir = path.join(uploadsRoot, 'references', String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    done(null, dir);
  },
  filename(req, file, done) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    done(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const uploadReferences = multer({
  storage: referenceStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter(req, file, done) {
    if (/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.mimetype)) done(null, true);
    else done(new Error('Chỉ nhận file ảnh (JPEG/PNG/WebP).'));
  },
}).array('images', 6);

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
  const serviceId = Number(req.body.serviceId);
  /* Bỏ trống / null / '' nghĩa là "bất kỳ nhân viên" — backend tự chọn.
     Phải phân biệt trước khi Number(): Number(undefined) ra NaN, mà NaN
     khác undefined nên điều kiện kiểm tra cũ luôn 400, giết chết luồng
     auto-claim khi client không gửi staffId. */
  const rawStaffId = req.body?.staffId;
  const staffId = rawStaffId === undefined || rawStaffId === null || rawStaffId === ''
    ? null
    : Number(rawStaffId);
  const date = String(req.body.date ?? '');
  const time = String(req.body.time ?? '');
  const note = String(req.body.note ?? '').trim().slice(0, 1000) || null;

  if (!Number.isInteger(serviceId) || !isDate(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ message: 'Thông tin đặt lịch không hợp lệ.' });
  }
  /* Không chỉ định nhân viên thì để backend tự chọn người phù hợp. */
  if (staffId !== null && !Number.isInteger(staffId)) {
    return res.status(400).json({ message: 'Mã chuyên viên không hợp lệ.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const service = await loadActiveService(connection, serviceId);
    const record = await createBookingRecord(connection, {
      serviceId,
      staffId,
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
       thời gian sắp xếp lại nhân viên. Đúng 2:00:00 cũng không (xem
       isCancelWindowOpen). */
    if (booking.status === 'CONFIRMED' && !isCancelWindowOpen(booking.startsAt)) {
      await connection.rollback();
      return res.status(409).json({
        message: `Lịch đã xác nhận chỉ còn dưới ${CANCEL_WINDOW_HOURS} giờ `
          + `nên không thể tự hủy. Vui lòng liên hệ cửa hàng.`,
      });
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
   Ảnh mẫu khách gửi kèm lịch hẹn
   ---------------------------------------------------------------
   Mobile gọi POST /api/bookings/:id/images ngay sau khi đặt lịch.
   Trước đây backend không có đường này cho khách (ảnh chỉ có ở
   /api/admin), mà Mobile lại `.catch(() => null)` nên lỗi bị nuốt:
   khách tưởng ảnh đã gửi thành công nhưng thật ra mất âm thầm.

   Chỉ chủ lịch gửi được, và chỉ khi lịch còn "sống" — lịch đã hủy,
   khách không đến hoặc đã xong thì ảnh mẫu không còn ý nghĩa.
   Mỗi lịch tối đa 6 ảnh, giống giới hạn ảnh đánh giá.
   ================================================================ */
export async function addCustomerImage(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const url = String(req.body?.url ?? '').trim().slice(0, 255);
    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (!url) return res.status(400).json({ message: 'Cần đường dẫn ảnh.' });

    const [[booking]] = await pool.query(
      `SELECT booking_id, customer_id AS customerId, status
         FROM booking WHERE booking_id = ? LIMIT 1`, [bookingId]);
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    if (booking.customerId !== req.user.customerId) {
      return res.status(403).json({ message: 'Bạn không có quyền gửi ảnh cho lịch hẹn này.' });
    }
    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(booking.status)) {
      return res.status(409).json({
        message: 'Lịch đã kết thúc nên không gửi thêm được ảnh mẫu.',
      });
    }

    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS n FROM booking_image WHERE booking_id = ?', [bookingId]);
    if (Number(count.n) >= 6) {
      return res.status(409).json({ message: 'Mỗi lịch hẹn chỉ gửi được tối đa 6 ảnh mẫu.' });
    }

    const [result] = await pool.query(
      'INSERT INTO booking_image (booking_id, image_url) VALUES (?,?)', [bookingId, url]);
    res.status(201).json({ data: { id: String(result.insertId), url } });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Upload file ảnh mẫu (multipart) — POST /api/bookings/:id/images/upload
   ---------------------------------------------------------------
   Cùng luật với đường JSON: chỉ chủ lịch, lịch còn sống, tổng tối đa
   6 ảnh (cộng dồn cả ảnh URL đã gửi). Lỗi multer (quá 5MB, sai định
   dạng, quá 6 file) dịch thành 400 chứ không để rơi vào handler 500.
   File đã lưu mà guard fail thì xoá để không rác uploads.
   ================================================================ */
export async function addCustomerImageUpload(req, res, next) {
  uploadReferences(req, res, async (uploadError) => {
    const files = req.files ?? [];
    try {
      if (uploadError) {
        const message = uploadError.code === 'LIMIT_FILE_SIZE'
          ? 'Mỗi ảnh tối đa 5MB.'
          : uploadError.code === 'LIMIT_FILE_COUNT' || uploadError.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Mỗi lịch hẹn chỉ gửi được tối đa 6 ảnh mẫu.'
            : uploadError.message || 'File ảnh không hợp lệ.';
        return res.status(400).json({ message });
      }

      const bookingId = Number(req.params.id);
      if (!Number.isInteger(bookingId)) {
        return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });
      }
      if (!files.length) {
        return res.status(400).json({ message: 'Chưa chọn file ảnh nào.' });
      }

      const [[booking]] = await pool.query(
        `SELECT booking_id, customer_id AS customerId, status
           FROM booking WHERE booking_id = ? LIMIT 1`, [bookingId]);
      const fail = (status, message) => {
        for (const file of files) {
          try { fs.unlinkSync(file.path); } catch { /* bỏ qua */ }
        }
        return res.status(status).json({ message });
      };
      if (!booking) return fail(404, 'Không tìm thấy lịch hẹn.');
      if (booking.customerId !== req.user.customerId) {
        return fail(403, 'Bạn không có quyền gửi ảnh cho lịch hẹn này.');
      }
      if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(booking.status)) {
        return fail(409, 'Lịch đã kết thúc nên không gửi thêm được ảnh mẫu.');
      }

      const [[count]] = await pool.query(
        'SELECT COUNT(*) AS n FROM booking_image WHERE booking_id = ?', [bookingId]);
      if (Number(count.n) + files.length > 6) {
        return fail(409, 'Mỗi lịch hẹn chỉ gửi được tối đa 6 ảnh mẫu.');
      }

      const urls = [];
      for (const file of files) {
        const url = `/uploads/references/${bookingId}/${file.filename}`;
        const [result] = await pool.query(
          'INSERT INTO booking_image (booking_id, image_url) VALUES (?,?)', [bookingId, url]);
        urls.push({ id: String(result.insertId), url: imageUrl(req, url) });
      }
      res.status(201).json({ data: urls });
    } catch (error) {
      for (const file of files) {
        try { fs.unlinkSync(file.path); } catch { /* bỏ qua */ }
      }
      next(error);
    }
  });
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
    /* Thời gian phục vụ thật: từ lúc bấm "bắt đầu" đến lúc bấm "hoàn
       thành", không phải thời lượng dự kiến. */
    if (nextStatus === 'COMPLETED') {
      set.push('actual_duration = ?');
      params.push(await actualServiceMinutes(connection, id, booking.serviceDuration));
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