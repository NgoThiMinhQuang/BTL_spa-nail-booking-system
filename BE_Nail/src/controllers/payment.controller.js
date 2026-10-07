/* ===== API thanh toán =====

   Trạng thái thanh toán nằm ở bảng `payment`, tách khỏi trạng thái lịch
   hẹn: một lịch có thể đã hoàn thành nhưng chưa thu tiền, hoặc đã đặt
   cọc nhưng còn phần chưa trả. Trước đây hệ thống chỉ có API đọc,
   không có đường ghi — nên mọi khoản thu đều phải sửa tay ngoài database.

   Số tiền lấy từ snapshot trên chính lịch hẹn, không lấy `services.price`
   hiện tại: nếu lấy giá hiện tại thì sau khi Admin đổi giá, lịch cũ
   sẽ đổi số tiền khách phải trả. */

import { pool } from '../config/database.js';
import { logEvent } from '../lib/booking-events.js';
import { canPaymentTransition, finalAmount, resolvePaymentAmount } from '../lib/payment-state.js';
import { recordCashFlow } from '../lib/payment-transactions.js';
import { SETTLED_STATUSES } from '../lib/booking-state.js';

const METHODS = ['CASH', 'BANK_TRANSFER', 'ONLINE'];

/**
 * Tính số tiền phải thu của một lịch.
 *
 *   service_price (snapshot lúc đặt) + Σ(giá dịch vụ phát sinh × số lượng)
 *
 * Không đọc `services.price` hiện tại — đó là điểm khác biệt giữa một
 * lịch hẹn và một dịch vụ trong danh mục.
 *
 * Nhận `runner` để khi gọi trong giao dịch (savePayment) thì đọc cùng
 * snapshot với các câu FOR UPDATE — đọc bằng pool riêng có thể thấy
 * tổng cũ trong lúc một add-on vừa được thêm.
 */
export async function amountDue(runner, bookingId) {
  const [[booking]] = await runner.query(
    `SELECT COALESCE(b.service_price, s.price) AS price,
            COALESCE(b.service_duration, s.duration) AS duration,
            COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime,
            s.service_name
       FROM booking b JOIN services s ON s.service_id = b.service_id
      WHERE b.booking_id = ? LIMIT 1`, [bookingId],
  );
  if (!booking) return null;

  const [addons] = await runner.query(
    `SELECT price, quantity FROM booking_addon WHERE booking_id = ?`, [bookingId],
  );

  const total = finalAmount({ servicePrice: booking.price, addons });
  return {
    servicePrice: Number(booking.price),
    addonTotal: total - Number(booking.price),
    total,
    serviceName: booking.service_name,
  };
}

/**
 * Ghi nhận hoặc cập nhật thanh toán cho một lịch.
 *
 * Bảng payment.booking_id là UNIQUE nên mỗi lịch có đúng một dòng
 * thanh toán: ghi lần đầu thì INSERT, các lần sau là UPDATE. Không có
 * chuyện một lịch có hai dòng rồi cộng tiền hai lần.
 */
export async function savePayment(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });

    const status = String(req.body?.status ?? '').toUpperCase();
    const method = String(req.body?.method ?? '').toUpperCase();
    const note = String(req.body?.note ?? '').trim().slice(0, 255) || null;

    /* Giao dịch từ đây: FOR UPDATE, chốt tiền và ghi payment phải là một
       khối nguyên tử. Trước đây không có beginTransaction nên mỗi câu tự
       commit riêng — khoá FOR UPDATE nhả ngay, hai lần thu tiền cùng lúc
       race nhau, và rollback() trong catch cũng không có tác dụng. */
    await connection.beginTransaction();

    const [[booking]] = await connection.query(
      `SELECT b.booking_id, b.status, b.staff_id AS staffId,
              COALESCE(u.full_name, b.guest_name, 'khách vãng lai') AS customerName,
              pay.payment_status AS currentStatus, pay.amount AS currentAmount
         FROM booking b
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
         LEFT JOIN customer c ON c.customer_id = b.customer_id
         LEFT JOIN users u ON u.user_id = c.user_id
        WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [bookingId],
    );

    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }

    /* Lịch đã hủy hoặc khách không đến thì không có gì để thu. */
    if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
      await connection.rollback();
      return res.status(409).json({
        message: `Lịch đang ở trạng thái "${booking.status}" nên không thu được tiền.`,
      });
    }

    const transition = canPaymentTransition(booking.currentStatus ?? 'UNPAID', status);
    if (!transition.ok) {
      await connection.rollback();
      return res.status(409).json({ message: transition.reason });
    }

    if (method && !METHODS.includes(method)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Hình thức thanh toán không hợp lệ.' });
    }

    const due = await amountDue(connection, bookingId);

    /* Đặt cọc phải nhỏ hơn tổng tiền và lớn hơn 0 — cọc bằng đúng tổng
       thì là trả đủ, tức là PAID chứ không phải DEPOSITED. */
    if (status === 'DEPOSITED') {
      const deposit = Number(req.body?.amount ?? 0);
      if (!Number.isFinite(deposit) || deposit <= 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Vui lòng nhập số tiền đặt cọc.' });
      }
      if (deposit >= due.total) {
        await connection.rollback();
        return res.status(400).json({
          message: `Số tiền đặt cọc (${deposit.toLocaleString('vi-VN')} đ) `
            + `không nhỏ hơn tổng tiền (${due.total.toLocaleString('vi-VN')} đ). `
            + 'Trả đủ thì ghi trạng thái Đã thanh toán.',
        });
      }
    }

    /* Số tiền: PAID thì backend tự đặt đúng tổng phải thu, không tin con số
       frontend gửi lên (xem resolvePaymentAmount). Đặt cọc thì lấy số nhập. */
    const resolved = resolvePaymentAmount(
      status, status === 'PAID' ? due.total : (req.body?.amount ?? due.total), due.total);
    if (!resolved.ok) {
      await connection.rollback();
      return res.status(400).json({ message: resolved.reason });
    }
    const amount = resolved.amount;

    /* PAID thì mốc thời gian là thời điểm nhận tiền; DEPOSITED cũng có
       mốc vì khách đã trả một phần. UNPAID thì không có. */
    const paidAt = ['PAID', 'DEPOSITED'].includes(status) ? new Date() : null;
    const previousAmount = booking.currentStatus == null ? 0 : Number(booking.currentAmount ?? 0);

    if (booking.currentStatus == null) {
      await connection.query(
        `INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
         VALUES (?,?,?,?,?)`,
        [bookingId, amount, method || 'CASH', status, paidAt],
      );
    } else {
      await connection.query(
        `UPDATE payment
            SET amount = ?, payment_method = ?, payment_status = ?,
                payment_date = COALESCE(?, payment_date)
          WHERE booking_id = ?`,
        [amount, method || 'CASH', status, paidAt, bookingId],
      );
    }

    /* Sổ tiền vào két: chỉ ghi phần thu THÊM so với dòng payment cũ.
       Cọc 150k tháng 9 + trả nốt 350k tháng 10 thành hai giao dịch riêng
       nên báo cáo tiền thu đúng tháng; ghi đè cùng số tiền thì không ghi. */
    if (status === 'DEPOSITED' || status === 'PAID') {
      await recordCashFlow(connection, {
        bookingId,
        type: status === 'DEPOSITED' ? 'DEPOSIT' : 'FINAL',
        amount: amount - previousAmount,
        method: method || 'CASH',
        paidAt,
        createdBy: req.user?.userId ?? null,
      });
    }

    await logEvent({
      bookingId,
      type: 'PAYMENT',
      detail: `Thanh toán ${note ? `${note}. ` : ''}`
        + `Số tiền: ${amount.toLocaleString('vi-VN')} đ (${status.toLowerCase()}).`,
      actorRole: 'ADMIN',
      actorName: req.user?.name ?? 'Quản trị viên',
      connection,
    });

    await connection.commit();
    res.json({
      data: {
        bookingId: String(bookingId),
        status,
        method: method || 'CASH',
        amount,
        servicePrice: due.servicePrice,
        addonTotal: due.addonTotal,
        total: due.total,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/** Cập nhật trạng thái thanh toán từ khu quản trị: PATCH /api/admin/payments/:id */
export async function patchPayment(req, res, next) {
  try {
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId)) {
      return res.status(400).json({ message: 'Mã thanh toán không hợp lệ.' });
    }

    const [[payment]] = await pool.query(
      `SELECT p.payment_id, p.booking_id AS bookingId, p.amount,
              p.payment_status AS status, b.status AS bookingStatus
         FROM payment p JOIN booking b ON b.booking_id = p.booking_id
        WHERE p.payment_id = ? LIMIT 1`, [paymentId],
    );
    if (!payment) return res.status(404).json({ message: 'Không tìm thấy khoản thanh toán.' });

    /* Gán trạng thái thanh toán vào một lịch đã kết thúc sẽ làm sai báo
       cáo doanh thu, nên chặn ở backend chứ không chỉ ẩn nút. */
    if (SETTLED_STATUSES.includes(payment.bookingStatus) && payment.bookingStatus !== 'COMPLETED') {
      return res.status(409).json({
        message: `Lịch đã ở trạng thái "${payment.bookingStatus}" nên không thu được tiền.`,
      });
    }

    /* Giữ số tiền cũ khi body không gửi amount — gán lại vào req.body vì
       savePayment đọc từ đó. Trước đây tạo object mới rồi bỏ đi nên
       DEPOSITED không amount luôn 400 dù khoản cũ đã có số tiền. */
    req.body = { ...req.body, amount: req.body?.amount ?? payment.amount };
    req.params.id = payment.bookingId;
    return savePayment(req, res, next);
  } catch (error) {
    next(error);
  }
}

/**
 * Khách tự xem lịch của mình đã thanh toán tới đâu.
 * Trả kèm số tiền còn phải trả để khách biết mình còn nợ bao nhiêu.
 */
export async function getMyPayments(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT p.payment_id AS id, p.booking_id AS bookingId, p.amount,
              p.payment_status AS status, p.payment_method AS method,
              p.payment_date AS paidAt,
              b.start_time AS startsAt, b.status AS bookingStatus,
              s.service_name AS serviceName,
              COALESCE(b.service_price, s.price) AS servicePrice,
              COALESCE(addon.total, 0) AS addonTotal
         FROM payment p
         JOIN booking b ON b.booking_id = p.booking_id
         JOIN services s ON s.service_id = b.service_id
         LEFT JOIN (
           SELECT booking_id, SUM(price * quantity) AS total FROM booking_addon GROUP BY booking_id
         ) addon ON addon.booking_id = p.booking_id
        WHERE b.customer_id = ?
        ORDER BY COALESCE(p.payment_date, b.start_time) DESC LIMIT 60`,
      [req.user.customerId],
    );

    res.json({
      data: rows.map((row) => {
        const total = Number(row.servicePrice) + Number(row.addonTotal);
        return {
          ...row,
          id: String(row.id),
          bookingId: String(row.bookingId),
          amount: Number(row.amount),
          servicePrice: Number(row.servicePrice),
          addonTotal: Number(row.addonTotal),
          total,
          /* Chỉ thu được tiền khi trạng thái là PAID — tiền cọc không
             tính vào tiền khách đã trả hết. */
          remaining: row.status === 'PAID' ? 0 : Math.max(0, total - Number(row.amount)),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}