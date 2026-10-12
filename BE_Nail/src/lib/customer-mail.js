/* ===== Mail cho khách hàng (xác nhận đặt lịch, hóa đơn) =====

   Khách đăng nhập bằng SĐT nên hệ thống nhận ra đúng người qua user_id
   mà không cần mail. Kênh Gmail này là thêm: ai để lại mail thì nhận
   thêm xác nhận/hóa đơn qua mail, ai không để thì mọi thứ vẫn như cũ.

   Gửi qua Gmail cấu hình ở GMAIL_USER/GMAIL_APP_PASSWORD (xem
   .env.example). Chưa cấu hình thì bỏ qua êm — không bao giờ làm hỏng
   luồng đặt lịch/thanh toán. */

import { sendEmailAlert } from './notifications.js';

/** Làm sạch email khách nhập: null = bỏ trống, undefined = sai định dạng. */
export function cleanEmail(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const text = String(value).trim().toLowerCase();
  if (text.length > 150) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text) ? text : undefined;
}

/* Email hiệu lực của khách: ưu tiên mail vừa nhập; nếu hồ sơ chưa có
   mail thì lưu lại để lần sau khỏi nhập. */
export async function resolveCustomerEmail(runner, customerId, provided) {
  const [[row]] = await runner.query(
    `SELECT u.email AS email FROM customer c
       JOIN users u ON u.user_id = c.user_id
      WHERE c.customer_id = ? LIMIT 1`, [customerId]);
  const stored = row?.email ? String(row.email).trim().toLowerCase() : '';
  if (provided) {
    if (!stored) {
      await runner.query(
        `UPDATE users u JOIN customer c ON c.user_id = u.user_id
            SET u.email = ? WHERE c.customer_id = ?`, [provided, customerId]);
      return provided;
    }
    return stored;
  }
  return stored || null;
}

const METHOD_TEXT = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', ONLINE: 'Online' };

/** Mail xác nhận ngay sau khi đặt lịch (lịch PENDING chờ đặt cọc). */
export async function sendBookingConfirmation({ to, booking }) {
  const result = await sendEmailAlert({
    to,
    fromName: 'NailHouse Dat Lich',
    subject: `[NailHouse] Xác nhận đặt lịch #${booking.id}`,
    text:
      `Xin chào ${booking.customerName},\n\n`
      + `NailHouse đã nhận lịch hẹn của bạn:\n`
      + `- Dịch vụ: ${booking.serviceName}\n`
      + `- Chuyên viên: ${booking.staffName ?? 'Hệ thống tự chọn người phù hợp'}\n`
      + `- Thời gian: ${booking.slot}\n`
      + `- Giá dự kiến: ${booking.price}\n\n`
      + 'Lịch đang giữ chỗ — bạn hoàn tất đặt cọc để xác nhận chính thức.\n'
      + 'Cần đổi giờ/hủy lịch thì mở ứng dụng NailHouse trước giờ hẹn.\n\n'
      + 'Cảm ơn bạn đã tin tưởng NailHouse!',
  });
  return !result.skipped && (result.sent ?? 0) > 0;
}

/** Mail hóa đơn ngay sau khi lịch được ghi PAID. */
export async function sendReceiptEmail({ to, receipt }) {
  const result = await sendEmailAlert({
    to,
    fromName: 'NailHouse Hoa Don',
    subject: `[NailHouse] Hóa đơn thanh toán #${receipt.bookingId}`,
    text:
      `Xin chào ${receipt.customerName},\n\n`
      + `Cảm ơn bạn đã sử dụng dịch vụ. Hóa đơn của lịch #${receipt.bookingId}:\n`
      + `- Dịch vụ: ${receipt.serviceName}\n`
      + `- Chuyên viên: ${receipt.staffName ?? '—'}\n`
      + `- Tổng thanh toán: ${receipt.amount} (${receipt.method})\n`
      + `- Thời điểm thu: ${receipt.paidAt}\n\n`
      + 'Đây là biên nhận nghiệp vụ, không thay thế hóa đơn điện tử.\n'
      + 'Chi tiết từng lần thu/hoàn xem trong ứng dụng NailHouse (mục lịch hẹn).\n\n'
      + 'Hẹn gặp lại bạn!',
  });
  return !result.skipped && (result.sent ?? 0) > 0;
}

export { METHOD_TEXT };
