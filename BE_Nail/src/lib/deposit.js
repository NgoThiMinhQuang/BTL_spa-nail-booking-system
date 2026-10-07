/* ===== Quy tắc đặt cọc bắt buộc (Mobile) =====

   Mọi lịch khách đặt qua Mobile đều phải cọc trước mới giữ chỗ:

     PENDING + UNPAID      đang chờ khách cọc (giữ slot tối đa 15 phút)
     CONFIRMED + DEPOSITED đã cọc, lịch chính thức
     PROCESSING + DEPOSITED đang phục vụ
     COMPLETED + DEPOSITED làm xong, chưa trả phần còn lại
     COMPLETED + PAID      hoàn tất

   Không thêm trạng thái booking mới: "chờ cọc" chính là PENDING + UNPAID.
   Khách hủy sau khi đã cọc thì cọc không hoàn lại (không có nghiệp vụ
   hoàn tiền) — dòng payment giữ nguyên DEPOSITED. */

export const DEPOSIT_RATE = 0.3;

/** Số phút khách có để thanh toán cọc trước khi slot trả lại. */
export const DEPOSIT_WINDOW_MINUTES = 15;

/** Tiền cọc = 30% tổng phải thu, làm tròn đồng. */
export function depositAmount(total) {
  return Math.max(0, Math.round(Number(total) * DEPOSIT_RATE));
}

/** Phần còn phải trả tại salon sau khi đã cọc. */
export function remainingAmount(total, deposited) {
  return Math.max(0, Number(total) - Number(deposited ?? 0));
}

/** Lịch PENDING tạo đã quá hạn cọc chưa (tính từ created_at). */
export function isDepositExpired(createdAt, now = new Date()) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created >= DEPOSIT_WINDOW_MINUTES * 60 * 1000;
}

/** Mốc hết hạn cọc để hiển thị đếm ngược. */
export function depositExpiresAt(createdAt) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  return new Date(created + DEPOSIT_WINDOW_MINUTES * 60 * 1000);
}
