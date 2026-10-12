/* ===== Sổ giao dịch thu/hoàn tiền =====

   payment giữ TRẠNG THÁI tổng hợp của một lịch, bảng payment_transaction
   giữ từng KHOẢN TIỀN vào/ra két: cọc tháng 9 + trả nốt tháng 10 là hai
   dòng riêng nên báo cáo tiền thu theo kỳ mới đúng tháng.

   Quy ước ghi (chênh lệch so với dòng payment cũ):
     vào DEPOSITED: giao dịch DEPOSIT = tiền cọc mới thu thêm.
     vào PAID:      giao dịch FINAL = phần trả thêm (tổng hóa đơn trừ đi
                    số đã ghi trước đó). Lịch trả một lần thì FINAL = cả bill.
     cửa hàng hủy lịch đã cọc: giao dịch REFUND âm tiền + payment REFUNDED.
   Ghi đè cùng trạng thái mà số tiền không đổi thì không sinh giao dịch
   (không có tiền vào/ra thêm). UNPAID không bao giờ sinh giao dịch.

   Riêng REFUND (P0.4): "đã hoàn" chỉ được ghi khi tiền thật đã chuyển.
   Dòng REFUND sinh ra ở PENDING, rồi:
     - MOCK (chưa có key VNPay): SUCCEEDED ngay + is_mock = 1, giao diện
       hiện rõ "Mô phỏng", không được hiện như tiền thật.
     - ONLINE thật: processor gọi API hoàn VNPay → SUCCEEDED khi cổng trả
       mã 00, FAILED khi cổng từ chối/lỗi (thử lại được).
     - CASH / chuyển khoản tay: không có cổng để xác minh → PENDING chờ
       Admin xác nhận đã đưa tiền (confirmRefundManually). */

import { pool } from '../config/database.js';
import { logEvent } from './booking-events.js';
import { refundViaVNPay, vnpayConfig } from './vnpay.js';

export async function recordCashFlow(runner, {
  bookingId, type, amount, method = null, paidAt = null, createdBy = null,
}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return null;
  if (!['DEPOSIT', 'FINAL', 'REFUND'].includes(type)) return null;
  /* Tiền ONLINE ở chế độ giả lập chưa hề di chuyển — đánh dấu để giao
     diện không hiện như tiền thật. */
  const isMock = method === 'ONLINE' && vnpayConfig().mock ? 1 : 0;
  const [result] = await runner.query(
    `INSERT INTO payment_transaction
        (booking_id, type, amount, payment_method, paid_at, created_by, is_mock)
     VALUES (?,?,?,?,?,?,?)`,
    [bookingId, type, Math.round(value), method,
      paidAt ?? new Date(), createdBy, isMock],
  );
  return result.insertId;
}

/* Đặt trạng thái dòng hoàn (chạy trong giao dịch của caller). */
async function markRefundState(runner, txnId, status, message = null) {
  if (!txnId) return;
  await runner.query(
    `UPDATE payment_transaction SET status = ?, gateway_message = ?
      WHERE transaction_id = ?`,
    [status, message, txnId],
  );
}

/* ================================================================
   Quyết toán tiền khi lịch bị hủy / khách không đến.
   ----------------------------------------------------------------
   - mode 'FULL' (cửa hàng hủy: Admin/Staff): hoàn toàn bộ tiền đang giữ.
     payment → REFUNDED + giao dịch REFUND âm tiền.
   - mode 'DEPOSIT_ONLY' (khách tự hủy / không đến): chỉ mất cọc. Phần
     giữ lại = tổng giao dịch DEPOSIT đã ghi (0 nếu chưa từng cọc);
     phần còn lại hoàn qua giao dịch REFUND. payment giữ DEPOSIT với
     đúng số cọc giữ lại để báo cáo "cọc giữ lại" đối chiếu được.
   UNPAID hoặc đã REFUNDED thì không có gì để quyết toán.
   Trả về { forfeited, refunded, refundTxnId } để caller ghi log, báo cho
   khách và đẩy xử lý hoàn (processPendingRefunds) sau khi commit.
   Dòng REFUND sinh ra ở PENDING (chờ hoàn thật), trừ chế độ giả lập thì
   chốt SUCCEEDED ngay vì không có tiền thật để chuyển.
   ================================================================ */
export async function settleCancelPayment(runner, bookingId, { mode, createdBy = null }) {
  const [[pay]] = await runner.query(
    `SELECT payment_id AS pid, amount, payment_method AS method, payment_status AS status
       FROM payment WHERE booking_id = ? LIMIT 1 FOR UPDATE`, [bookingId],
  );
  if (!pay || pay.status === 'UNPAID' || pay.status === 'REFUNDED') {
    return { forfeited: 0, refunded: 0, refundTxnId: null };
  }
  const held = Math.round(Number(pay.amount ?? 0));
  const now = new Date();

  /* Ghi dòng REFUND ở PENDING (chờ hoàn thật). Chế độ giả lập (chưa có
     key VNPay) thì chốt SUCCEEDED ngay + is_mock đã gắn lúc ghi. */
  const trackRefund = async (txnId) => {
    if (!txnId) return;
    await markRefundState(runner, txnId, 'PENDING');
    if (vnpayConfig().mock) {
      await markRefundState(
        runner, txnId, 'SUCCEEDED', 'Giao dịch giả lập (MOCK) — không trừ/chuyển tiền thật.');
    }
  };

  if (mode === 'FULL') {
    await runner.query(`UPDATE payment SET payment_status = 'REFUNDED' WHERE payment_id = ?`, [pay.pid]);
    const txnId = await recordCashFlow(runner, {
      bookingId, type: 'REFUND', amount: -held,
      method: pay.method, paidAt: now, createdBy,
    });
    await trackRefund(txnId);
    return { forfeited: 0, refunded: held, refundTxnId: txnId };
  }

  const [[dep]] = await runner.query(
    `SELECT COALESCE(SUM(amount), 0) AS kept FROM payment_transaction
      WHERE booking_id = ? AND type = 'DEPOSIT'`, [bookingId],
  );
  /* Dữ liệu cũ chưa có dòng giao dịch nhưng trạng thái DEPOSITED: chính
     số tiền trên dòng payment là cọc đang giữ. */
  let keep = Math.round(Number(dep.kept ?? 0));
  if (keep === 0 && pay.status === 'DEPOSITED') keep = held;
  keep = Math.min(Math.max(0, keep), held);
  const refund = held - keep;
  let refundTxnId = null;
  if (refund > 0) {
    refundTxnId = await recordCashFlow(runner, {
      bookingId, type: 'REFUND', amount: -refund,
      method: pay.method, paidAt: now, createdBy,
    });
    await trackRefund(refundTxnId);
  }
  if (keep > 0) {
    await runner.query(
      `UPDATE payment SET amount = ?, payment_status = 'DEPOSITED' WHERE payment_id = ?`,
      [keep, pay.pid],
    );
  } else {
    await runner.query(
      `UPDATE payment SET payment_status = 'REFUNDED' WHERE payment_id = ?`, [pay.pid]);
  }
  return { forfeited: keep, refunded: refund, refundTxnId };
}

/* ================================================================
   Xử lý các dòng hoàn đang chờ (P0.4)
   ----------------------------------------------------------------
   - CASH / chuyển khoản tay: không có cổng để xác minh → giữ PENDING,
     Admin xác nhận đã đưa tiền bằng confirmRefundManually.
   - ONLINE thật (có key, có mã gốc): gọi API hoàn VNPay. Thành công khi
     cổng trả mã 00. Hai phase (PROCESSING rồi SUCCEEDED/FAILED) để hai
     lần thử lại cùng lúc không hoàn trùng, và crash giữa chừng thì lần
     thử sau (dòng PROCESSING quá 30 phút) vẫn xử lý tiếp được.
   - Chế độ giả lập: settle đã chốt SUCCEEDED nên processor bỏ qua.
   Không bao giờ ném lỗi ra ngoài — caller gọi best-effort sau commit.
   ================================================================ */

/** Đẩy xử lý hoàn cho các dòng PENDING/FAILED của một hoặc mọi lịch. */
export async function processPendingRefunds(bookingIds = null) {
  if (vnpayConfig().mock) return [];
  const params = [];
  let bookingFilter = '';
  if (bookingIds) {
    const ids = (Array.isArray(bookingIds) ? bookingIds : [bookingIds])
      .map(Number).filter(Number.isInteger);
    if (!ids.length) return [];
    bookingFilter = 'AND t.booking_id IN (?)';
    params.push(ids);
  }
  const [rows] = await pool.query(
    `SELECT t.transaction_id AS id FROM payment_transaction t
      WHERE t.type = 'REFUND' AND t.status IN ('PENDING','FAILED')
        AND t.payment_method = 'ONLINE' AND t.is_mock = 0 ${bookingFilter}
      ORDER BY t.transaction_id`, params);
  const results = [];
  for (const row of rows) {
    results.push(await processRefundTxn(row.id));
  }
  return results;
}

/** Xử lý một dòng hoàn: gọi cổng VNPay và cập nhật trạng thái. */
export async function processRefundTxn(txnId, { fetchImpl } = {}) {
  const connection = await pool.getConnection();
  try {
    const id = Number(txnId);
    if (!Number.isInteger(id)) return { ok: false, message: 'Mã giao dịch không hợp lệ.' };

    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT t.transaction_id AS txnId, t.booking_id AS bookingId, t.amount,
              t.payment_method AS method, t.status, t.is_mock AS isMock,
              p.gateway_txn_no AS gwNo, p.gateway_txn_ref AS gwRef,
              p.payment_date AS paidDate
         FROM payment_transaction t
         JOIN payment p ON p.booking_id = t.booking_id
        WHERE t.transaction_id = ? AND t.type = 'REFUND' LIMIT 1 FOR UPDATE`, [id]);
    if (!row) {
      await connection.rollback();
      return { ok: false, message: 'Không tìm thấy dòng hoàn tiền.' };
    }
    if (row.status === 'SUCCEEDED') {
      await connection.rollback();
      return { ok: true, status: 'SUCCEEDED', message: 'Dòng này đã hoàn thành.' };
    }
    /* PROCESSING kẹt (crash giữa chừng) quá 30 phút thì cho thử lại. */
    if (row.status === 'PROCESSING') {
      const [[age]] = await connection.query(
        `SELECT TIMESTAMPDIFF(MINUTE, paid_at, NOW()) AS minutes
           FROM payment_transaction WHERE transaction_id = ?`, [id]);
      if (Number(age?.minutes ?? 0) <= 30) {
        await connection.rollback();
        return { ok: false, status: 'PROCESSING', message: 'Đang có tiến trình hoàn khác xử lý.' };
      }
    }
    if (row.method !== 'ONLINE' || Number(row.isMock) === 1) {
      await connection.rollback();
      return {
        ok: false, status: row.status, manual: true,
        message: 'Hoàn tay (tiền mặt/chuyển khoản/giả lập) — Admin xác nhận đã đưa tiền để chốt.',
      };
    }
    if (vnpayConfig().mock) {
      await connection.rollback();
      return { ok: false, status: row.status, message: 'Đang ở chế độ giả lập, không gọi cổng thật.' };
    }
    if (!row.gwNo) {
      await connection.query(
        `UPDATE payment_transaction SET status = 'FAILED',
              gateway_message = 'Thiếu mã giao dịch gốc của VNPay — thu tay rồi xác nhận thủ công.'
          WHERE transaction_id = ?`, [id]);
      await connection.commit();
      return { ok: false, status: 'FAILED', message: 'Thiếu mã giao dịch gốc của VNPay.' };
    }
    await connection.query(
      `UPDATE payment_transaction SET status = 'PROCESSING', gateway_message = NULL
        WHERE transaction_id = ?`, [id]);
    await connection.commit();

    const amount = Math.abs(Number(row.amount));
    const paidDate = row.paidDate instanceof Date ? row.paidDate : new Date(row.paidDate);
    const pad = (n) => String(n).padStart(2, '0');
    const result = await refundViaVNPay({
      requestId: `RF${id}-${Date.now()}`,
      txnRef: row.gwRef || String(row.bookingId),
      txnNo: row.gwNo,
      amountVnd: amount,
      orderInfo: `Hoan tien lich ${row.bookingId}`,
      transactionDate: Number.isNaN(paidDate.getTime()) ? undefined : (
        `${paidDate.getFullYear()}${pad(paidDate.getMonth() + 1)}${pad(paidDate.getDate())}`
        + `${pad(paidDate.getHours())}${pad(paidDate.getMinutes())}${pad(paidDate.getSeconds())}`),
      createBy: 'system',
    }, fetchImpl);

    await connection.beginTransaction();
    if (result.ok) {
      await connection.query(
        `UPDATE payment_transaction SET status = 'SUCCEEDED', gateway_message = ?
          WHERE transaction_id = ?`, [`VNPay xác nhận hoàn (${result.code ?? '00'}).`, id]);
      await logEvent({
        bookingId: row.bookingId, type: 'PAYMENT',
        detail: `Cổng VNPay xác nhận đã hoàn ${amount.toLocaleString('vi-VN')} đ cho khách.`,
        actorRole: 'SYSTEM', actorName: 'Hệ thống', connection,
      });
    } else {
      await connection.query(
        `UPDATE payment_transaction SET status = 'FAILED', gateway_message = ?
          WHERE transaction_id = ?`, [String(result.error ?? 'Cổng từ chối.').slice(0, 255), id]);
      await logEvent({
        bookingId: row.bookingId, type: 'NOTE',
        detail: `Hoàn qua VNPay thất bại (${String(result.error ?? '').slice(0, 200)}). Cần thử lại hoặc hoàn tay.`,
        actorRole: 'SYSTEM', actorName: 'Hệ thống', connection,
      });
    }
    await connection.commit();
    return result.ok
      ? { ok: true, status: 'SUCCEEDED', message: 'Cổng đã xác nhận hoàn tiền.' }
      : { ok: false, status: 'FAILED', message: result.error };
  } catch (error) {
    try { await connection.rollback(); } catch { /* bỏ qua */ }
    return { ok: false, message: String(error?.message ?? error).slice(0, 200) };
  } finally {
    connection.release();
  }
}

/* Admin xác nhận đã hoàn tay (tiền mặt/chuyển khoản ngoài cổng, hoặc đã
   xử lý với VNPay bằng tay): chỉ dòng PENDING/FAILED mới chốt được. */
export async function confirmRefundManually(txnId, { note = null, adminName = 'Quản trị viên' } = {}) {
  const connection = await pool.getConnection();
  try {
    const id = Number(txnId);
    if (!Number.isInteger(id)) return { ok: false, message: 'Mã giao dịch không hợp lệ.' };
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT transaction_id AS txnId, booking_id AS bookingId, amount, status
         FROM payment_transaction WHERE transaction_id = ? AND type = 'REFUND'
         LIMIT 1 FOR UPDATE`, [id]);
    if (!row) {
      await connection.rollback();
      return { ok: false, message: 'Không tìm thấy dòng hoàn tiền.' };
    }
    if (row.status === 'SUCCEEDED') {
      await connection.rollback();
      return { ok: true, status: 'SUCCEEDED', message: 'Dòng này đã hoàn thành.' };
    }
    if (!['PENDING', 'FAILED'].includes(row.status)) {
      await connection.rollback();
      return { ok: false, message: `Dòng đang ở trạng thái ${row.status}, không chốt tay được.` };
    }
    await connection.query(
      `UPDATE payment_transaction SET status = 'SUCCEEDED', gateway_message = ?
        WHERE transaction_id = ?`,
      [String(note || 'Admin xác nhận đã hoàn tiền cho khách.').slice(0, 255), id]);
    await logEvent({
      bookingId: row.bookingId, type: 'PAYMENT',
      detail: `Admin xác nhận đã hoàn ${Math.abs(Number(row.amount)).toLocaleString('vi-VN')} đ cho khách`
        + (note ? `: ${note}` : '.'),
      actorRole: 'ADMIN', actorName: adminName, connection,
    });
    await connection.commit();
    return { ok: true, status: 'SUCCEEDED' };
  } catch (error) {
    try { await connection.rollback(); } catch { /* bỏ qua */ }
    return { ok: false, message: String(error?.message ?? error).slice(0, 200) };
  } finally {
    connection.release();
  }
}
