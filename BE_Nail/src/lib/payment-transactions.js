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
   (không có tiền vào/ra thêm). UNPAID không bao giờ sinh giao dịch. */

export async function recordCashFlow(runner, {
  bookingId, type, amount, method = null, paidAt = null, createdBy = null,
}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return null;
  if (!['DEPOSIT', 'FINAL', 'REFUND'].includes(type)) return null;
  const [result] = await runner.query(
    `INSERT INTO payment_transaction
        (booking_id, type, amount, payment_method, paid_at, created_by)
     VALUES (?,?,?,?,?,?)`,
    [bookingId, type, Math.round(value), method,
      paidAt ?? new Date(), createdBy],
  );
  return result.insertId;
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
   Trả về { forfeited, refunded } để caller ghi log và báo cho khách.
   ================================================================ */
export async function settleCancelPayment(runner, bookingId, { mode, createdBy = null }) {
  const [[pay]] = await runner.query(
    `SELECT payment_id AS pid, amount, payment_method AS method, payment_status AS status
       FROM payment WHERE booking_id = ? LIMIT 1 FOR UPDATE`, [bookingId],
  );
  if (!pay || pay.status === 'UNPAID' || pay.status === 'REFUNDED') {
    return { forfeited: 0, refunded: 0 };
  }
  const held = Math.round(Number(pay.amount ?? 0));
  const now = new Date();

  if (mode === 'FULL') {
    await runner.query(`UPDATE payment SET payment_status = 'REFUNDED' WHERE payment_id = ?`, [pay.pid]);
    await recordCashFlow(runner, {
      bookingId, type: 'REFUND', amount: -held,
      method: pay.method, paidAt: now, createdBy,
    });
    return { forfeited: 0, refunded: held };
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
  if (refund > 0) {
    await recordCashFlow(runner, {
      bookingId, type: 'REFUND', amount: -refund,
      method: pay.method, paidAt: now, createdBy,
    });
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
  return { forfeited: keep, refunded: refund };
}
