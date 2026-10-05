/* ===== Máy trạng thái thanh toán =====

   Trạng thái lịch hẹn và trạng thái thanh toán là hai thứ khác nhau:
   một lịch có thể đã hoàn thành nhưng chưa thu tiền, hoặc đã đặt cọc
   nhưng còn phần chưa trả. Vì vậy `payment_status` nằm ở bảng payment
   chứ không nằm trong bảng booking.

   Luật chuyển trạng thái ở đây là nguồn duy nhất: mọi API ghi hay sửa
   thanh toán đều đi qua hàm này, nên không có chuyện một nơi cho phép
   PAID → UNPAID trong khi nơi khác chặn. */

/** Các trạng thái thanh toán hợp lệ. */
export const PAYMENT_STATUSES = ['UNPAID', 'DEPOSITED', 'PAID'];

/**
 * Bảng chuyển trạng thái.
 *
 *   UNPAID   → DEPOSITED | PAID
 *   DEPOSITED→ PAID
 *   PAID     → (kết thúc)
 *
 * PAID không quay lại được. README chưa có nghiệp vụ hoàn tiền nên
 * không mở đường đi ngược — mở rồi thì báo cáo doanh thu sẽ không
 * bao giờ khớp với thực tế.
 */
export const PAYMENT_TRANSITIONS = {
  UNPAID: ['DEPOSITED', 'PAID'],
  DEPOSITED: ['PAID'],
  PAID: [],
};

export const PAYMENT_TEXT = {
  UNPAID: 'Chưa thanh toán',
  DEPOSITED: 'Đã đặt cọc',
  PAID: 'Đã thanh toán',
};

export const METHOD_TEXT = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  ONLINE: 'Thanh toán online',
};

/**
 * Kiểm tra một bước chuyển thanh toán.
 * Ghi đè cùng một trạng thái được phép — đây là chỉnh sửa thông tin
 * (đổi hình thức trả, sửa số tiền) chứ không phải đi ngược.
 */
export function canPaymentTransition(from, to) {
  const start = String(from ?? 'UNPAID').toUpperCase();
  const target = String(to ?? '').toUpperCase();

  if (!PAYMENT_STATUSES.includes(target)) {
    return { ok: false, reason: `Trạng thái thanh toán "${to}" không hợp lệ.` };
  }
  if (!PAYMENT_STATUSES.includes(start)) {
    return { ok: false, reason: `Trạng thái thanh toán hiện tại "${from}" không hợp lệ.` };
  }
  if (start === target) return { ok: true, unchanged: true };
  if (!PAYMENT_TRANSITIONS[start].includes(target)) {
    return {
      ok: false,
      reason: `Thanh toán đang ở trạng thái "${PAYMENT_TEXT[start]}" nên không chuyển `
        + `sang "${PAYMENT_TEXT[target]}" được.`,
    };
  }
  return { ok: true };
}

/**
 * Số tiền phải thu của một lịch: giá dịch vụ lúc đặt (snapshot, không
 * phải giá hiện tại của dịch vụ) cộng tổng các dịch vụ phát sinh.
 *
 * Dịch vụ phát sinh có `quantity`, nên phải nhân `price * quantity`:
 * 3 lớp sơn trị 40.000 là 120.000 chứ không phải 40.000.
 */
export function finalAmount({ servicePrice, addons = [] }) {
  const addonTotal = addons.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity ?? 1), 0);
  return Number(servicePrice) + addonTotal;
}

/**
 * Chốt số tiền ghi vào `payment`.
 *
 * PAID nghĩa là khách đã trả đủ — backend tự đặt đúng tổng phải thu,
 * không tin con số frontend gửi lên. Nếu tin thì PAID kèm amount = 1000đ
 * cho hoá đơn 500.000đ vẫn lọt: khách thấy "còn phải trả 0đ" dù chưa trả
 * đủ, và báo cáo doanh thu cũng sai theo.
 */
export function resolvePaymentAmount(status, rawAmount, total) {
  const target = String(status ?? '').toUpperCase();
  const due = Number(total);
  if (target === 'PAID') return { ok: true, amount: due };

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount < 0 || amount > due) {
    return {
      ok: false,
      reason: `Số tiền không hợp lệ. Tổng tiền lịch này là `
        + `${due.toLocaleString('vi-VN')} đ.`,
    };
  }
  return { ok: true, amount };
}