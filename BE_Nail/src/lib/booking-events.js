/* ===== Ghi lịch sử thay đổi của một lịch hẹn =====

   Trang chi tiết cần dòng thời gian "ai làm gì, lúc nào" để Admin đối chiếu
   khi có khiếu nại. Vì vậy mọi thao tác trên lịch hẹn đều ghi lại đúng một
   dòng, kể cả thao tác bị từ chối thì không ghi — lịch sử chỉ ghi những gì
   đã thật sự xảy ra.

   Lưu ý về danh tính người thực hiện: khu quản trị hiện đăng nhập bằng
   localStorage, database chưa có bảng phiên đăng nhập cho Admin, nên
   actor_name lấy theo tên do giao diện gửi lên, chưa được backend xác
   minh. Khi làm xác thực thật thì thay chỗ này bằng user_id từ token. */

import { pool } from '../config/database.js';

/**
 * Ghi một mốc vào lịch sử của lịch hẹn.
 * @param {object} entry
 * @param {number} entry.bookingId
 * @param {string} entry.type      CREATED | CONFIRMED | RESCHEDULED | ...
 * @param {string} [entry.detail]   câu mô tả bằng tiếng Việt, hiện thẳng ra giao diện
 * @param {string} [entry.actorRole] CUSTOMER | STAFF | ADMIN | SYSTEM
 * @param {string} [entry.actorName]
 * @param {import('mysql2/promise').PoolConnection} [connection] dùng chung
 *        transaction với câu lệnh chính để ghi và sửa là cùng lúc hoặc không.
 */
export async function logEvent({
  bookingId, type, detail, actorRole = 'ADMIN', actorName = 'Quản trị viên', connection,
}) {
  const runner = connection ?? pool;
  await runner.query(
    `INSERT INTO booking_event (booking_id, event_type, detail, actor_role, actor_name)
     VALUES (?,?,?,?,?)`,
    [bookingId, type, detail ? String(detail).slice(0, 500) : null, actorRole, actorName ?? null]);
}

/** Đọc lịch sử của một lịch hẹn, cũ đến mới. */
export async function listEvents(bookingId) {
  const [rows] = await pool.query(
    `SELECT event_id AS id, event_type AS type, detail,
            actor_role AS actorRole, actor_name AS actorName, created_at AS createdAt
       FROM booking_event WHERE booking_id = ? ORDER BY created_at ASC, event_id ASC`,
    [bookingId]);
  return rows.map((row) => ({ ...row, id: String(row.id) }));
}
