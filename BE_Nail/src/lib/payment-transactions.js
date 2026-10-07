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
