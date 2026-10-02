/* ===== Máy trạng thái của lịch hẹn =====

   Đây là luật duy nhất quyết định một lịch hẹn được chuyển sang trạng
   thái nào. Trước đây mỗi controller tự viết một danh sách riêng, nên
   xuất hiện các đường đi không đúng nghiệp vụ mà không ai nhận ra, ví
   dụ PENDING → COMPLETED hay PROCESSING → CANCELLED.

   Nguyên tắc: bất kỳ API nào đổi trạng thái lịch — Mobile, quản trị,
   nhân viên — đều phải đi qua `canTransition`. Ẩn nút ở giao diện chỉ
   là tiện lợi, không phải bảo mật; luật thật nằm ở đây. */

/** Trạng thái một lịch hẹn có thể chuyển sang. */
export const BOOKING_STATUSES = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
];

/**
 * Bảng chuyển trạng thái.
 *
 *   PENDING    → CONFIRMED | CANCELLED
 *   CONFIRMED  → PROCESSING | CANCELLED | NO_SHOW
 *   PROCESSING → COMPLETED
 *   COMPLETED  → (kết thúc)
 *   CANCELLED  → (kết thúc)
 *   NO_SHOW    → (kết thúc)
 *
 * Các bước không có trong danh sách là bị cấm hoàn toàn, kể cả khi
 * người dùng gửi request trực tiếp.
 */
export const ALLOWED_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED', 'NO_SHOW'],
  PROCESSING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Nhãn tiếng Việt hiển thị ra giao diện. */
export const STATUS_TEXT = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không đến',
};

/** Trạng thái còn chiếm lịch của nhân viên. */
export const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING'];

/** Trạng thái đã kết thúc — dữ liệu lịch sử, không sửa người/giờ được nữa. */
export const SETTLED_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

/**
 * Kiểm tra một bước chuyển trạng thái có hợp lệ không.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function canTransition(from, to) {
  const start = String(from ?? '').toUpperCase();
  const target = String(to ?? '').toUpperCase();

  if (!BOOKING_STATUSES.includes(start)) {
    return { ok: false, reason: `Trạng thái hiện tại "${from}" không hợp lệ.` };
  }
  if (!BOOKING_STATUSES.includes(target)) {
    return { ok: false, reason: `Trạng thái "${to}" không hợp lệ.` };
  }
  if (start === target) {
    return { ok: false, reason: `Lịch đang ở trạng thái "${STATUS_TEXT[start]}" rồi.` };
  }
  if (!ALLOWED_TRANSITIONS[start].includes(target)) {
    const allowed = ALLOWED_TRANSITIONS[start];
    const hint = allowed.length
      ? `chỉ chuyển được sang ${allowed.map((s) => `"${STATUS_TEXT[s]}"`).join(' hoặc ')}`
      : 'lịch đã kết thúc, không chuyển trạng thái được nữa';
    return {
      ok: false,
      reason: `Không thể chuyển từ "${STATUS_TEXT[start]}" sang "${STATUS_TEXT[target]}": ${hint}.`,
    };
  }
  return { ok: true };
}

/**
 * Bước chuyển mà NHÂN VIÊN được thực hiện.
 * Chỉ hai bước, và chỉ trên lịch được phân công cho chính nhân viên đó.
 */
export const STAFF_TRANSITIONS = ['PROCESSING', 'COMPLETED'];

/**
 * Kiểm tra bước chuyển do nhân viên thực hiện.
 * Ngoài luật chuyển trạng thái chung, nhân viên chỉ được đi đúng hai bước
 * này — xác nhận hay hủy là việc của khách hoặc quản trị.
 */
export function canStaffTransition(from, to) {
  const target = String(to ?? '').toUpperCase();
  if (!STAFF_TRANSITIONS.includes(target)) {
    return {
      ok: false,
      reason: 'Nhân viên chỉ được cập nhật sang "Đang thực hiện" hoặc "Hoàn thành".',
    };
  }
  return canTransition(from, target);
}