/* ===== Nhãn hiển thị dùng chung cho mọi API lịch hẹn =====

   Trạng thái lịch, trạng thái thanh toán và nguồn đặt lịch được hiển thị ở
   cả bảng lịch hẹn lẫn bảng lịch hôm nay của Tổng quan. Nếu mỗi controller
   giữ một bản riêng thì dễ xảy ra chuyện hai màn hiện hai chữ khác nhau cho
   cùng một trạng thái, nên tụng ở đây và cả hai cùng import. */

/** Mã hiển thị dạng #BK00125, dựng từ booking_id nên không cần cột riêng. */
export const bookingCode = (id) => `#BK${String(id).padStart(5, '0')}`;

/* Nhãn trạng thái lịch nằm cùng file với luật chuyển trạng thái ở
   booking-state.js — một nơn duy nhất, không phải hai bản chữ ở hai file. */
export { STATUS_TEXT } from './booking-state.js';

/* Nhãn thanh toán nằm cùng file với luật chuyển trạng thái ở
   payment-state.js — cùng cách làm như trạng thái lịch ở trên. */
export { METHOD_TEXT, PAYMENT_TEXT } from './payment-state.js';

export const SOURCE_TEXT = {
  MOBILE: 'Mobile',
  WALK_IN: 'Khách trực tiếp',
};

/* Ba dạng giá trị thời gian hay gặp ở đây:
     - Date                     : do JS tạo ra khi ghép ngày + giờ
     - 'HH:mm:ss'               : cột TIME của staff_schedule
     - 'YYYY-MM-DDTHH:mm:ssZ'   : chuỗi ISO mà API trả về cho frontend
   Ba dạng này không cùng một cách lấy ngày/giờ, nên gom về hai hàm duy nhất
   để không xảy ra chuyện ca làm việc bị đọc thành "00:00". */

/** Ngày "YYYY-MM-DD" theo giờ địa phương, không phụ thuộc múi giờ máy. */
export function dayOf(value) {
  if (value instanceof Date) return localDay(value);
  const text = String(value);

  /* Đã là ngày rồi, hoặc là giờ trong ngày (TIME) — dùng nguyên. */
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : localDay(date);
}

function localDay(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Phần giờ "HH:mm" theo giờ địa phương. */
export function clockOf(value) {
  if (value instanceof Date) {
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    return `${hour}:${minute}`;
  }
  const text = String(value);

  /* Cột TIME trả về 'HH:mm:ss' — không có phần ngày để cắt. */
  if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);

  /* Chuỗi ISO: đổi sang giờ địa phương rồi mới lấy, vì cắt chuỗi sẽ ra
     giờ UTC và lệch múi giờ so với ngày đã tính ở dayOf. */
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(11, 16);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}
