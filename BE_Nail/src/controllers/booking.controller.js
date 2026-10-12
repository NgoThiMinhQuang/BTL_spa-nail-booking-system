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
import { freeSlotsForAnyStaff, freeSlotsForStaff } from '../lib/staff-availability.js';
import {
  checkStaffAvailable, lockStaffBookings,
} from '../lib/staff-availability.js';
import { settleCancelPayment } from '../lib/payment-transactions.js';
import { cleanEmail, resolveCustomerEmail, sendBookingConfirmation } from '../lib/customer-mail.js';
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
    /* Bỏ trống staffId nghĩa là "bất kỳ chuyên viên" — backend hợp nhất
       khung giờ của mọi người làm được dịch vụ (freeSlotsForAnyStaff),
       còn người cụ thể thì giữ nguyên đường cũ. Phải phân biệt trước
       khi Number(): Number(undefined) ra NaN. */
    const rawStaffId = req.query.staffId;
    const staffId = rawStaffId === undefined || rawStaffId === null || rawStaffId === ''
      ? null
      : Number(rawStaffId);
    const date = String(req.query.date ?? '');

    if (!Number.isInteger(serviceId) || !isDate(date)) {
      return res.status(400).json({ message: 'Dịch vụ hoặc ngày không hợp lệ.' });
    }
    if (staffId !== null && !Number.isInteger(staffId)) {
      return res.status(400).json({ message: 'Mã chuyên viên không hợp lệ.' });
    }

    let svc;
    let slots;
    if (staffId !== null) {
      [[svc]] = await pool.query(
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
      slots = await freeSlotsForStaff({
        staffId, serviceId, day: date, duration: Number(svc.duration), bufferTime: Number(svc.bufferTime ?? 0),
      });
    } else {
      [[svc]] = await pool.query(
        `SELECT s.service_name, s.duration, s.buffer_time AS bufferTime
           FROM services s
          WHERE s.service_id = ? AND s.status = 'ACTIVE' LIMIT 1`,
        [serviceId],
      );
      if (!svc) return res.status(404).json({ message: 'Dịch vụ không tồn tại hoặc đã ngừng hoạt động.' });
      ({ slots } = await freeSlotsForAnyStaff({
        serviceId, day: date, duration: Number(svc.duration), bufferTime: Number(svc.bufferTime ?? 0),
      }));
    }

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
  /* Email nhận xác nhận/hóa đơn: tùy chọn, sai định dạng thì báo ngay để
     khách sửa chứ không lặng lẽ bỏ qua (sai một chữ là mất mail). */
  const emailInput = cleanEmail(req.body?.email);
  if (emailInput === undefined) {
    return res.status(400).json({ message: 'Địa chỉ email không đúng định dạng.' });
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

    /* Mail xác nhận cho khách để lại mail (kênh thêm — không có mail thì
       mọi thứ vẫn như cũ, lỗi gửi không chặn đặt lịch). */
    let confirmationEmail = 'skipped';
    try {
      const address = await resolveCustomerEmail(pool, req.user.customerId, emailInput);
      if (address) {
        const [[info]] = await pool.query(
          `SELECT s.service_name AS serviceName, u.full_name AS staffName
             FROM services s
             LEFT JOIN staff st ON st.staff_id = ?
             LEFT JOIN users u ON u.user_id = st.user_id
            WHERE s.service_id = ? LIMIT 1`,
          [record.staffId, serviceId],
        );
        const emailed = await sendBookingConfirmation({
          to: address,
          booking: {
            id: record.bookingId,
            customerName: req.user.name,
            serviceName: info?.serviceName ?? 'Dịch vụ NailHouse',
            staffName: info?.staffName ?? null,
            slot: `${time} ngày ${date.split('-').reverse().join('/')} (dự kiến ${service.duration} phút)`,
            price: `${Number(service.price).toLocaleString('vi-VN')} đ`,
          },
        });
        if (emailed) confirmationEmail = 'sent';
      }
    } catch {
      /* Mail là phụ — lịch đã commit, không rollback vì gửi lỗi. */
    }

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
        confirmationEmail,
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

    /* Khách hủy: chỉ mất CỌC, phần đã trả thừa được hoàn lại.
       VD đã trả đủ 500.000 (cọc 150.000) rồi hủy đúng luật thì giữ 150.000,
       hoàn 350.000. Không có cọc nào được ghi thì hoàn toàn bộ. */
    const settled = await settleCancelPayment(connection, id, {
      mode: 'DEPOSIT_ONLY', createdBy: req.user.customerId ?? null,
    });
    const forfeited = settled.forfeited;

    await logEvent({
      bookingId: id,
      type: 'CANCELLED',
      detail: `Khách hủy lịch. Lý do: ${reason}.`
        + (forfeited > 0 ? ` Tiền cọc giữ lại (${forfeited.toLocaleString('vi-VN')} đ).` : '')
        + (settled.refunded > 0 ? ` Đã hoàn ${settled.refunded.toLocaleString('vi-VN')} đ.` : ''),
      actorRole: 'CUSTOMER',
      actorName: req.user.name,
      connection,
    });

    await connection.commit();
    res.json({
      data: {
        id: String(id), status: 'CANCELLED', cancelReason: reason,
        forfeited,
        refunded: settled.refunded,
        forfeitMessage: forfeited > 0
          ? `Tiền cọc (${forfeited.toLocaleString('vi-VN')} đ) không được hoàn lại.`
          : null,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   Khách tự đổi ngày/giờ lịch hẹn
   ---------------------------------------------------------------
   Không cho tự ý đổi sang giờ bất kỳ mà không kiểm tra: giữ nguyên
   nhân viên và dịch vụ, chạy lại đúng bộ luật khả dụng (ca, nghỉ,
   trùng lịch) rồi mới lưu. Tiền cọc/thanh toán giữ nguyên theo lịch.
   Chỉ PENDING/CONFIRMED được đổi; CONFIRMED phải còn trên 2 giờ như
   luật hủy (cùng CANCEL_WINDOW_HOURS).
   ================================================================ */
export async function rescheduleBooking(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const date = String(req.body?.date ?? '').trim();
    const time = String(req.body?.time ?? '').trim();
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });
    }
    if (!isDate(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: 'Ngày (YYYY-MM-DD) hoặc giờ (HH:mm) không hợp lệ.' });
    }

    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.booking_id, b.customer_id AS customerId, b.status,
              b.start_time AS startsAt, b.staff_id AS staffId, b.service_id AS serviceId,
              COALESCE(b.service_duration, s.duration) AS duration,
              COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime
          FROM booking b JOIN services s ON s.service_id = b.service_id
         WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [id],
    );
    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }
    if (booking.customerId !== req.user.customerId) {
      await connection.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền đổi lịch hẹn này.' });
    }
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      await connection.rollback();
      return res.status(409).json({
        message: `Lịch đang ở trạng thái "${booking.status}" nên không đổi giờ được.`,
      });
    }
    if (booking.status === 'CONFIRMED' && !isCancelWindowOpen(booking.startsAt)) {
      await connection.rollback();
      return res.status(409).json({
        message: `Lịch đã xác nhận chỉ còn dưới ${CANCEL_WINDOW_HOURS} giờ `
          + 'nên không tự đổi được. Vui lòng liên hệ cửa hàng.',
      });
    }

    const startsAt = momentOf(date, time);
    if (!startsAt || startsAt.getTime() <= Date.now()) {
      await connection.rollback();
      return res.status(400).json({ message: 'Giờ mới phải trong tương lai.' });
    }
    const endsAt = new Date(
      startsAt.getTime() + (Number(booking.duration) + Number(booking.bufferTime ?? 0)) * 60000);

    /* Đổi về đúng giờ cũ thì không cần làm gì thêm. */
    if (new Date(booking.startsAt).getTime() === startsAt.getTime()) {
      await connection.rollback();
      return res.json({
        data: {
          id: String(id), startsAt, endsAt, unchanged: true,
          message: 'Giờ mới trùng giờ cũ nên giữ nguyên.',
        },
      });
    }

    /* Khoá rồi kiểm tra lại trong giao dịch để hai khách không cùng
       chen vào một khung giờ (giống đường tạo lịch). */
    if (booking.staffId) {
      await lockStaffBookings({ connection, staffId: booking.staffId, startsAt, endsAt });
      const check = await checkStaffAvailable({
        bookingId: id, staffId: booking.staffId, serviceId: booking.serviceId,
        startsAt, endsAt, runner: connection, forUpdate: true,
      });
      if (!check.ok) {
        await connection.rollback();
        return res.status(409).json({
          message: `Không đổi được: ${check.reason}`,
          reason: check.reason,
          conflict: check.conflict ?? null,
        });
      }
    }

    await connection.query(
      'UPDATE booking SET start_time = ?, end_time = ? WHERE booking_id = ?',
      [startsAt, endsAt, id],
    );
    await logEvent({
      bookingId: id,
      type: 'RESCHEDULED',
      detail: `Khách tự đổi giờ sang ${date} lúc ${time}. Tiền cọc/thanh toán giữ nguyên.`,
      actorRole: 'CUSTOMER',
      actorName: req.user.name,
      connection,
    });

    await connection.commit();
    res.json({ data: { id: String(id), startsAt, endsAt } });
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
   Biên nhận thanh toán của khách — GET /api/bookings/:id/receipt
   ---------------------------------------------------------------
   Chỉ chủ lịch xem được. Liệt kê dịch vụ + add-on (snapshot), từng
   giao dịch đã thu/hoàn và số còn phải thu — cùng một nguồn số với
   biên nhận Admin in, nên hai bên không bao giờ lệch nhau.
   ================================================================ */
export async function getBookingReceipt(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });
    }

    const [[booking]] = await pool.query(
      `SELECT b.booking_id, b.status, b.customer_id AS customerId,
              b.start_time AS startsAt,
              COALESCE(b.service_price, s.price) AS servicePrice,
              s.service_name AS serviceName,
              COALESCE(u.full_name, b.guest_name) AS customerName,
              su.full_name AS staffName,
              pay.payment_id AS paymentId, pay.payment_status AS paymentStatus,
              pay.payment_method AS paymentMethod, pay.amount AS paidAmount,
              pay.payment_date AS paymentDate
         FROM booking b
         JOIN services s ON s.service_id = b.service_id
         LEFT JOIN customer c ON c.customer_id = b.customer_id
         LEFT JOIN users u ON u.user_id = c.user_id
         LEFT JOIN staff st ON st.staff_id = b.staff_id
         LEFT JOIN users su ON su.user_id = st.user_id
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        WHERE b.booking_id = ? LIMIT 1`, [bookingId],
    );
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    if (booking.customerId !== req.user.customerId) {
      return res.status(403).json({ message: 'Bạn không có quyền xem biên nhận này.' });
    }

    const [addons] = await pool.query(
      `SELECT service_name AS name, quantity, price
         FROM booking_addon WHERE booking_id = ? ORDER BY addon_id`, [bookingId]);
    const [transactions] = await pool.query(
      `SELECT transaction_id AS id, type, amount, payment_method AS method, paid_at AS paidAt
         FROM payment_transaction WHERE booking_id = ?
         ORDER BY paid_at ASC, transaction_id ASC`, [bookingId]);

    const addonTotal = addons.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const total = Number(booking.servicePrice) + addonTotal;
    const collected = transactions
      .filter((t) => t.type !== 'REFUND')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const refunded = transactions
      .filter((t) => t.type === 'REFUND')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    res.json({
      data: {
        bookingId: String(bookingId),
        receiptNo: booking.paymentId == null ? null : `BN-${bookingId}-${booking.paymentId}`,
        status: booking.status,
        startsAt: booking.startsAt,
        customerName: booking.customerName,
        staffName: booking.staffName,
        service: {
          name: booking.serviceName,
          price: Number(booking.servicePrice),
        },
        addons: addons.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.price) * Number(item.quantity),
        })),
        total,
        collected,
        refunded,
        remaining: Math.max(0, total - collected),
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        transactions: transactions.map((t) => ({
          id: String(t.id),
          type: t.type,
          amount: Number(t.amount),
          method: t.method,
          paidAt: t.paidAt,
        })),
      },
    });
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
   Chi tiết một lịch hẹn của chính khách đang đăng nhập
   ---------------------------------------------------------------
   Không phải chủ lịch thì 404 (không tiết lộ lịch có tồn tại không).
   Trả đủ để màn hình chi tiết hiển thị mà không cần gọi thêm: dịch vụ
   (snapshot lúc đặt), nhân viên, thanh toán + còn lại, dịch vụ phát
   sinh, ảnh mẫu, đánh giá nếu có.
   ================================================================ */
export async function getBookingDetail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });
    }

    const [[row]] = await pool.query(
      `SELECT b.booking_id AS id, b.customer_id AS customerId,
              b.service_id AS serviceId, b.staff_id AS staffId,
              b.start_time AS startsAt, b.end_time AS endsAt,
              b.status, b.note, b.source, b.created_at AS createdAt,
              b.cancel_reason AS cancelReason, b.cancelled_at AS cancelledAt,
              COALESCE(b.service_price, s.price) AS price,
              COALESCE(b.service_duration, s.duration) AS duration,
              COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime,
              s.service_name AS serviceName, s.image AS serviceImage,
              su.full_name AS staffName, su.avatar AS staffAvatar,
              su.phone AS staffPhone,
              pay.payment_status AS paymentStatus, pay.payment_method AS paymentMethod,
              pay.amount AS paidAmount, pay.payment_date AS paidAt
         FROM booking b
         JOIN services s ON s.service_id = b.service_id
         LEFT JOIN staff st ON st.staff_id = b.staff_id
         LEFT JOIN users su ON su.user_id = st.user_id
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        WHERE b.booking_id = ? LIMIT 1`, [id]);

    if (!row || row.customerId !== req.user.customerId) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }

    const [addons] = await pool.query(
      `SELECT ba.addon_id AS id, ba.quantity, ba.price, s.service_name AS name
         FROM booking_addon ba JOIN services s ON s.service_id = ba.service_id
        WHERE ba.booking_id = ? ORDER BY s.service_name`, [id]);

    const [images] = await pool.query(
      'SELECT image_id AS id, image_url AS url FROM booking_image WHERE booking_id = ? ORDER BY image_id',
      [id]);

    const [[review]] = await pool.query(
      'SELECT review_id AS id, rating, comment FROM review WHERE booking_id = ? LIMIT 1',
      [id]);

    const addonTotal = addons.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const total = Number(row.price) + addonTotal;

    res.json({
      data: {
        ...row,
        id: String(row.id),
        customerId: String(row.customerId),
        serviceId: String(row.serviceId),
        staffId: row.staffId == null ? null : String(row.staffId),
        status: row.status.toLowerCase(),
        price: Number(row.price),
        duration: Number(row.duration),
        bufferTime: Number(row.bufferTime ?? 0),
        paidAmount: row.paidAmount == null ? null : Number(row.paidAmount),
        serviceImageUrl: imageUrl(req, row.serviceImage),
        staffAvatarUrl: imageUrl(req, row.staffAvatar),
        addonTotal,
        total,
        remaining: row.paymentStatus === 'PAID' ? 0 : Math.max(0, total - Number(row.paidAmount ?? 0)),
        addons: addons.map((item) => ({
          ...item,
          id: String(item.id),
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
        images: images.map((item) => ({ ...item, id: String(item.id) })),
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
              b.start_time AS startsAt,
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

    /* Bắt đầu quá sớm: cho phép vào ca trước giờ hẹn tối đa 15 phút
       (chuẩn bị dụng cụ, đón khách tới sớm). Sớm hơn thì chặn — nếu không
       "thời gian phục vụ thật" tính từ lúc bấm sẽ đội lên vô lý và lịch
       tiếp theo của nhân viên bị dồn. */
    if (nextStatus === 'PROCESSING') {
      const earlyMs = new Date(booking.startsAt).getTime() - Date.now();
      if (earlyMs > 15 * 60 * 1000) {
        await connection.rollback();
        return res.status(409).json({
          message: 'Chưa tới giờ làm lịch này (được bắt đầu sớm tối đa 15 phút).',
        });
      }
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