/* ===== Tiện ích SQL dùng chung ===== */

/**
 * Escape `%`, `_` và `\` trong từ khoá tìm kiếm LIKE.
 *
 * Parameter đã chặn injection, nhưng `search=%` không nên trả về tất cả:
 * `%` và `_` trong LIKE là ký tự đại diện. MySQL dùng backslash làm ký
 * tự escape mặc định nên không cần thêm mệnh đề ESCAPE.
 */
export function escapeLike(term) {
  return String(term ?? '').replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
