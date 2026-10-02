/* Xoá dữ liệu mà các script kiểm thử tạo ra, để database về đúng trạng
   thái dữ liệu mẫu ban đầu.

   Dữ liệu kiểm thử nhận ra là:
     - lịch của khách vãng lai tên "Khách thử nghiệm"
     - yêu cầu nghỉ / yêu cầu lịch làm việc do script tạo

   Chạy: node scripts/reset-demo.mjs */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [bookings] = await connection.query(
  "SELECT booking_id FROM booking WHERE guest_name = 'Khách thử nghiệm'");
if (bookings.length) {
  const ids = bookings.map((row) => row.booking_id);
  await connection.query('DELETE FROM booking_event WHERE booking_id IN (?)', [ids]);
  await connection.query('DELETE FROM booking_image WHERE booking_id IN (?)', [ids]);
  await connection.query('DELETE FROM booking_addon WHERE booking_id IN (?)', [ids]);
  await connection.query(
    'DELETE FROM review_images WHERE review_id IN '
    + '(SELECT review_id FROM review WHERE booking_id IN (?))', [ids]);
  await connection.query('DELETE FROM review WHERE booking_id IN (?)', [ids]);
  await connection.query('DELETE FROM payment WHERE booking_id IN (?)', [ids]);
  await connection.query('DELETE FROM booking WHERE booking_id IN (?)', [ids]);
  console.log(`Đã xoá ${ids.length} lịch thử nghiệm.`);
} else {
  console.log('Không có lịch thử nghiệm nào.');
}

const [leave] = await connection.query('DELETE FROM staff_leave_request');
console.log(`Đã xoá ${leave.affectedRows} yêu cầu nghỉ.`);
const [schedule] = await connection.query('DELETE FROM staff_schedule_request');
console.log(`Đã xoá ${schedule.affectedRows} yêu cầu lịch làm việc.`);

/* Thêm lại ca làm việc cho 30 ngày tới nếu script nào đã xoá mất. */
await connection.query(
  `INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status)
   SELECT st.staff_id, DATE_ADD(CURDATE(), INTERVAL d.n DAY), '09:00:00', '18:00:00', 'AVAILABLE'
     FROM staff st
     JOIN users u ON u.user_id = st.user_id AND u.status = 'ACTIVE'
     CROSS JOIN (
       SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
       UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
       UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
       UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
       UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
       UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
       UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27
       UNION ALL SELECT 28 UNION ALL SELECT 29) d
    WHERE NOT EXISTS (
      SELECT 1 FROM staff_schedule sc
       WHERE sc.staff_id = st.staff_id
         AND sc.work_date = DATE_ADD(CURDATE(), INTERVAL d.n DAY))`);
console.log('Đã bổ sung ca làm việc còn thiếu.');

await connection.end();