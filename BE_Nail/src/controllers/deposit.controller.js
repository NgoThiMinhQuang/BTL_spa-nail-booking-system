/* ===== Đặt cọc giữ chỗ qua VNPay (khách Mobile) =====

   Mọi lịch đặt qua Mobile đều phải cọc 30% mới giữ chỗ chính thức:

     1. Khách tạo lịch → PENDING + UNPAID (giữ slot tối đa 15 phút).
     2. POST /:id/deposit-intent → backend trả URL thanh toán VNPay
        (hoặc trang cọc giả lập khi chưa cấu hình VNPay).
     3. Khách trả tiền → VNPay gọi về /vnpay-return và /vnpay-ipn →
        backend xác thực chữ ký, ghi DEPOSITED rồi tự động
        PENDING → CONFIRMED (lịch có sẵn nhân viên từ lúc đặt).
     4. Quá 15 phút chưa cọc → sweeper tự hủy, trả slot cho khách khác.
     5. Khách hủy sau khi đã cọc → cọc không hoàn lại (không có nghiệp
        vụ hoàn tiền): dòng payment giữ nguyên DEPOSITED.

   Không thêm trạng thái booking mới: "chờ cọc" = PENDING + UNPAID. */

import { pool } from '../config/database.js';
import { logEvent } from '../lib/booking-events.js';
import { canTransition } from '../lib/booking-state.js';
import {
  DEPOSIT_WINDOW_MINUTES, depositAmount, depositExpiresAt, isDepositExpired, remainingAmount,
} from '../lib/deposit.js';
import { canPaymentTransition } from '../lib/payment-state.js';
import { recordCashFlow } from '../lib/payment-transactions.js';
import { amountDue } from './payment.controller.js';
import {
  bookingIdFromTxnRef, buildPaymentUrl, depositTxnRef, verifyReturn, vnpayConfig,
} from '../lib/vnpay.js';

function baseUrl(req) {
  const proto = String(req.protocol ?? 'http');
  const host = String(req.get?.('host') ?? req.headers?.host ?? 'localhost:3000');
  return `${proto}://${host}`;
}

/**
 * POST /api/bookings/:id/deposit-intent — xin URL thanh toán đặt cọc.
 * Chỉ chủ lịch, lịch PENDING, chưa cọc và còn trong hạn 15 phút.
 */
export async function createDepositIntent(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã lịch hẹn không hợp lệ.' });

    const [[booking]] = await pool.query(
      `SELECT b.booking_id, b.customer_id AS customerId, b.status,
              b.created_at AS createdAt, b.staff_id AS staffId,
              pay.payment_status AS paymentStatus
         FROM booking b
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        WHERE b.booking_id = ? LIMIT 1`, [id],
    );
    if (!booking || booking.customerId !== req.user.customerId) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }
    if (booking.status !== 'PENDING') {
      return res.status(409).json({ message: 'Lịch này không còn ở trạng thái chờ đặt cọc.' });
    }
    if (booking.paymentStatus === 'DEPOSITED' || booking.paymentStatus === 'PAID') {
      return res.status(409).json({ message: 'Lịch này đã được thanh toán, không cần đặt cọc nữa.' });
    }

    /* Quá hạn 15 phút thì hủy ngay để trả slot, khỏi chờ sweeper. */
    if (isDepositExpired(booking.createdAt)) {
      await cancelExpiredBooking(id, 'Quá hạn thanh toán đặt cọc.');
      return res.status(410).json({
        message: 'Lịch đã quá 15 phút chờ đặt cọc nên bị hủy. Vui lòng đặt lịch mới.',
      });
    }

    const due = await amountDue(pool, id);
    if (!due) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    const deposit = depositAmount(due.total);
    const txnRef = depositTxnRef(id);

    const config = vnpayConfig();
    const returnUrl = config.returnUrl || `${baseUrl(req)}/api/payments/vnpay-return`;
    const paymentUrl = config.mock
      ? `${baseUrl(req)}/api/payments/mock-pay?ref=${encodeURIComponent(txnRef)}`
      : buildPaymentUrl({
        amountVnd: deposit,
        txnRef,
        orderInfo: `Dat coc lich hen #${id}`,
        ipAddr: String(req.ip ?? req.socket?.remoteAddress ?? '127.0.0.1'),
        returnUrl,
      });

    res.json({
      data: {
        bookingId: String(id),
        paymentUrl,
        mock: config.mock,
        deposit,
        total: due.total,
        remaining: remainingAmount(due.total, deposit),
        rate: 0.3,
        expiresAt: depositExpiresAt(booking.createdAt),
        windowMinutes: DEPOSIT_WINDOW_MINUTES,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Ghi DEPOSITED + tự động xác nhận lịch. Dùng chung cho return và IPN,
 * phải lũy đẳng: VNPay có thể gọi IPN nhiều lần cho một giao dịch.
 */
export async function confirmDepositPayment({ bookingId, amount }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.booking_id, b.status, b.staff_id AS staffId
         FROM booking b WHERE b.booking_id = ? LIMIT 1 FOR UPDATE`, [bookingId],
    );
    if (!booking) {
      await connection.rollback();
      return { status: 404, message: 'Không tìm thấy lịch hẹn.' };
    }
    const [[pay]] = await connection.query(
      'SELECT payment_status AS status FROM payment WHERE booking_id = ? LIMIT 1 FOR UPDATE',
      [bookingId],
    );
    const currentPay = pay?.status ?? 'UNPAID';

    /* Đã cọc / đã trả đủ từ lần gọi trước thì coi như thành công. */
    if (currentPay === 'DEPOSITED' || currentPay === 'PAID') {
      await connection.rollback();
      return { status: 200, already: true, bookingStatus: booking.status };
    }
    if (booking.status !== 'PENDING') {
      await connection.rollback();
      return { status: 409, message: 'Lịch không còn ở trạng thái chờ đặt cọc.' };
    }

    const due = await amountDue(connection, bookingId);
    const expected = depositAmount(due.total);
    if (Number(amount) < expected) {
      await connection.rollback();
      return {
        status: 409,
        message: `Số tiền cọc (${Number(amount).toLocaleString('vi-VN')} đ) `
          + `thấp hơn mức yêu cầu (${expected.toLocaleString('vi-VN')} đ).`,
      };
    }

    const transition = canPaymentTransition(currentPay, 'DEPOSITED');
    if (!transition.ok) {
      await connection.rollback();
      return { status: 409, message: transition.reason };
    }

    if (pay) {
      await connection.query(
        `UPDATE payment SET amount = ?, payment_method = 'ONLINE',
             payment_status = 'DEPOSITED', payment_date = NOW()
         WHERE booking_id = ?`,
        [Number(amount), bookingId],
      );
    } else {
      await connection.query(
        `INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
         VALUES (?,?,'ONLINE','DEPOSITED',NOW())`,
        [bookingId, Number(amount)],
      );
    }
    /* Tiền cọc vào két theo đúng ngày cọc (kể cả qua cổng online). */
    await recordCashFlow(connection, {
      bookingId,
      type: 'DEPOSIT',
      amount: Number(amount),
      method: 'ONLINE',
      paidAt: new Date(),
      createdBy: null,
    });
    await logEvent({
      bookingId,
      type: 'PAYMENT',
      detail: `Khách đặt cọc online ${Number(amount).toLocaleString('vi-VN')} đ.`,
      actorRole: 'CUSTOMER',
      actorName: 'Khách hàng',
      connection,
    });

    /* Cọc xong thì lịch thành chính thức. Lịch Mobile luôn có nhân viên
       từ lúc đặt (tự chọn khi khách bỏ trống), nên xác nhận được ngay;
       trường hợp không có người thì giữ PENDING để Admin phân công rồi
       xác nhận (lúc đó đã có DEPOSITED nên qua được luật chắn). */
    let confirmed = false;
    if (booking.staffId) {
      const go = canTransition('PENDING', 'CONFIRMED');
      if (go.ok) {
        await connection.query(
          'UPDATE booking SET status = \'CONFIRMED\' WHERE booking_id = ?', [bookingId]);
        await logEvent({
          bookingId,
          type: 'CONFIRMED',
          detail: 'Khách đã đặt cọc. Lịch được xác nhận tự động.',
          actorRole: 'SYSTEM',
          actorName: 'Hệ thống',
          connection,
        });
        confirmed = true;
      }
    }

    await connection.commit();
    return { status: 200, already: false, confirmed, bookingStatus: confirmed ? 'CONFIRMED' : 'PENDING' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* Trang HTML trả về cho trình duyệt sau khi VNPay redirect. */
function resultPage({ ok, title, lines }) {
  const items = lines.map((text) => `<p>${text}</p>`).join('');
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#FFF8F8;color:#2D2430;margin:0;padding:32px 20px;text-align:center}
.card{max-width:420px;margin:0 auto;background:#fff;border:1px solid #F0DFE3;border-radius:16px;padding:28px 22px}
.mark{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px;font-size:30px;
background:${ok ? '#E8F3EF' : '#FBE8ED'};color:${ok ? '#4E7D74' : '#B93E62'}}
h1{font-size:20px;margin:0 0 10px}p{font-size:14px;color:#756A73;line-height:1.7;margin:6px 0}
.note{margin-top:14px;font-size:13px;color:#B93E62}</style></head><body>
<div class="card"><div class="mark">${ok ? '✓' : '!'}</div><h1>${title}</h1>${items}
<p class="note">Bạn có thể quay lại ứng dụng NailHouse để xem lịch hẹn.</p></div></body></html>`;
}

/**
 * GET /api/payments/vnpay-return — VNPay đưa trình duyệt khách về đây.
 * Công khai (VNPay gọi, không có token): chỉ tin sau khi xác thực chữ ký.
 */
export async function vnpayReturn(req, res, next) {
  try {
    const { valid, params } = verifyReturn(req.query);
    if (!valid) {
      return res.status(400).send(resultPage({
        ok: false, title: 'Xác thực thất bại',
        lines: ['Chữ ký trả về không hợp lệ, không ghi nhận thanh toán.'],
      }));
    }
    const bookingId = bookingIdFromTxnRef(params.vnp_TxnRef);
    const paid = Math.round(Number(params.vnp_Amount ?? 0) / 100);
    const success = String(params.vnp_ResponseCode ?? '') === '00'
      && String(params.vnp_TransactionStatus ?? '') === '00';
    if (!bookingId) {
      return res.status(400).send(resultPage({
        ok: false, title: 'Giao dịch không hợp lệ', lines: ['Không xác định được lịch hẹn.'],
      }));
    }
    if (!success) {
      return res.status(200).send(resultPage({
        ok: false, title: 'Thanh toán chưa thành công',
        lines: [`Lịch #${bookingId} vẫn đang chờ đặt cọc.`, 'Bạn có thể quay lại ứng dụng và thử lại.'],
      }));
    }
    try {
      const result = await confirmDepositPayment({ bookingId, amount: paid });
      if (result.status !== 200) {
        return res.status(result.status).send(resultPage({ ok: false, title: 'Không ghi nhận được', lines: [result.message] }));
      }
      return res.status(200).send(resultPage({
        ok: true, title: 'Đặt cọc thành công',
        lines: [
          `Lịch hẹn #${bookingId} ${result.confirmed ? 'đã được xác nhận' : 'đang chờ phân công nhân viên'}.`,
          `Đã cọc: ${paid.toLocaleString('vi-VN')} đ.`,
        ],
      }));
    } catch (error) {
      return next(error);
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/payments/vnpay-ipn — VNPay gọi ngầm xác nhận (server-to-server).
 * Trả đúng mã VNPay quy định để cổng ngừng gọi lại.
 */
export async function vnpayIpn(req, res, next) {
  try {
    const { valid, params } = verifyReturn(req.query);
    if (!valid) return res.json({ RspCode: '97', Message: 'Invalid signature' });
    const bookingId = bookingIdFromTxnRef(params.vnp_TxnRef);
    if (!bookingId) return res.json({ RspCode: '01', Message: 'Order not found' });
    const paid = Math.round(Number(params.vnp_Amount ?? 0) / 100);
    if (String(params.vnp_ResponseCode ?? '') !== '00') {
      return res.json({ RspCode: '00', Message: 'Confirm Success' });
    }
    try {
      const result = await confirmDepositPayment({ bookingId, amount: paid });
      if (result.status === 404) return res.json({ RspCode: '01', Message: 'Order not found' });
      if (result.status !== 200) return res.json({ RspCode: '02', Message: 'Order already confirmed' });
      return res.json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (error) {
      return next(error);
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/payments/mock-pay — trang cọc giả lập khi chưa cấu hình VNPay.
 * Hiển thị đúng số tiền cọc; nút thành công gọi mock-confirm nội bộ.
 */
export async function mockPayPage(req, res, next) {
  try {
    if (!vnpayConfig().mock) return res.status(404).json({ message: 'API endpoint không tồn tại' });
    const bookingId = bookingIdFromTxnRef(req.query.ref);
    if (!bookingId) return res.status(400).send('Mã giao dịch không hợp lệ.');
    const due = await amountDue(pool, bookingId);
    if (!due) return res.status(404).send('Không tìm thấy lịch hẹn.');
    const deposit = depositAmount(due.total);
    const ref = String(req.query.ref ?? '');
    res.send(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Thanh toán đặt cọc (Test)</title>
<style>body{font-family:system-ui,sans-serif;background:#f2f4f7;margin:0;padding:24px 14px}
.card{max-width:430px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.08);overflow:hidden}
.head{background:#fff;padding:16px;text-align:center;border-bottom:1px solid #eee}
.head h1{font-size:17px;margin:8px 0 0}.vnp{color:#0d4ea2}.qr{color:#cb0a2b}
.body{padding:20px}.row{display:flex;justify-content:space-between;font-size:15px;padding:9px 0;border-bottom:1px dashed #eee}
.row strong{font-size:19px;color:#cb0a2b}
button{width:100%;margin-top:14px;padding:14px;border:0;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer}
.pay{background:#0d4ea2;color:#fff}.cancel{background:#fff;color:#555;border:1px solid #ddd;margin-top:8px}
p.note{font-size:12px;color:#888;text-align:center;margin-top:12px}</style></head><body>
<div class="card"><div class="head"><h1><span class="vnp">CỔNG THANH TOÁN</span> <span class="qr">GIẢ LẬP</span></h1>
<div style="font-size:13px;color:#666">Mô phỏng VNPay sandbox — dùng khi chưa có key thật</div></div>
<div class="body">
<div class="row"><span>Lịch hẹn</span><strong>#${bookingId}</strong></div>
<div class="row"><span>${due.serviceName ?? 'Dịch vụ'}</span><span>${due.total.toLocaleString('vi-VN')} đ</span></div>
<div class="row"><span>Tiền cọc 30%</span><strong>${deposit.toLocaleString('vi-VN')} đ</strong></div>
<a href="/api/payments/mock-confirm?ref=${encodeURIComponent(ref)}" style="display:block;text-align:center;text-decoration:none;background:#0d4ea2;color:#fff;margin-top:14px;padding:14px;border-radius:8px;font-size:16px;font-weight:700">Thanh toán thành công</a>
<a href="/api/payments/mock-cancel" style="display:block;text-align:center;text-decoration:none;background:#fff;color:#555;border:1px solid #ddd;margin-top:8px;padding:14px;border-radius:8px;font-size:16px">Hủy thanh toán</a>
<p class="note">Chế độ thử nghiệm nội bộ — không trừ tiền thật.</p>
</div></div></body></html>`);
  } catch (error) {
    next(error);
  }
}

/** Trang hủy thanh toán của chế độ giả lập. */
export async function mockCancelPage(_req, res) {
  res.send(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Đã hủy</title></head>
<body style="font-family:system-ui;text-align:center;padding:60px 20px">
<h2>Bạn đã hủy thanh toán</h2><p>Lịch hẹn vẫn đang chờ đặt cọc. Quay lại ứng dụng để thử lại.</p></body></html>`);
}

/**
 * GET /api/payments/mock-confirm — nút "Thanh toán thành công" của
 * trang giả lập. Chỉ tồn tại khi đang ở chế độ mock.
 */
export async function mockConfirm(req, res, next) {
  try {
    if (!vnpayConfig().mock) return res.status(404).json({ message: 'API endpoint không tồn tại' });
    const bookingId = bookingIdFromTxnRef(req.query?.ref ?? req.body?.ref);
    if (!bookingId) return res.status(400).send('Mã giao dịch không hợp lệ.');
    const due = await amountDue(pool, bookingId);
    if (!due) return res.status(404).send('Không tìm thấy lịch hẹn.');
    const result = await confirmDepositPayment({ bookingId, amount: depositAmount(due.total) });
    if (result.status !== 200) return res.status(result.status).send(result.message);
    return res.send(resultPage({
      ok: true, title: 'Đặt cọc thành công',
      lines: [
        `Lịch hẹn #${bookingId} ${result.confirmed ? 'đã được xác nhận' : 'đang chờ phân công nhân viên'}.`,
        `Đã cọc: ${depositAmount(due.total).toLocaleString('vi-VN')} đ.`,
      ],
    }));
  } catch (error) {
    next(error);
  }
}

/* Hủy một lịch quá hạn cọc (dùng cho intent quá hạn và sweeper). */
async function cancelExpiredBooking(bookingId, reason) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      'SELECT status FROM booking WHERE booking_id = ? LIMIT 1 FOR UPDATE', [bookingId]);
    if (!booking || booking.status !== 'PENDING') {
      await connection.rollback();
      return false;
    }
    await connection.query(
      `UPDATE booking SET status = 'CANCELLED', cancel_reason = ?,
           cancelled_at = NOW(), cancelled_by = 'ADMIN'
       WHERE booking_id = ?`, [reason, bookingId],
    );
    await logEvent({
      bookingId, type: 'CANCELLED', detail: `Tự động hủy: ${reason}`,
      actorRole: 'SYSTEM', actorName: 'Hệ thống', connection,
    });
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Quét lịch PENDING quá 15 phút chưa cọc → hủy, trả slot. Chạy mỗi phút
 * từ server và gọi trong test. cancelled_by để ADMIN vì ENUM không có
 * SYSTEM — lý do ghi rõ "tự động hủy".
 */
export async function sweepExpiredDeposits() {
  const [rows] = await pool.query(
    `SELECT b.booking_id AS id FROM booking b
      WHERE b.status = 'PENDING'
        AND b.created_at < (NOW() - INTERVAL ? MINUTE)
        AND NOT EXISTS (
          SELECT 1 FROM payment p WHERE p.booking_id = b.booking_id
            AND p.payment_status IN ('DEPOSITED', 'PAID')
        )`,
    [DEPOSIT_WINDOW_MINUTES],
  );
  let cancelled = 0;
  for (const row of rows) {
    const done = await cancelExpiredBooking(
      row.id, `Quá ${DEPOSIT_WINDOW_MINUTES} phút chờ thanh toán đặt cọc (tự động hủy).`);
    if (done) cancelled += 1;
  }
  return { cancelled };
}
