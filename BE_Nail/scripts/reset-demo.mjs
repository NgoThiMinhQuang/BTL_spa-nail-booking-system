/* Xoa DUNG du lieu thu do `npm run db:seed-demo` tao ra.
 *
 * Nhan dien bang dau hieu demo, KHONG xoa du lieu that:
 *  - lich co note '[DEMO]%' (con: event, anh, addon, review, payment,
 *    giao dich tien tu CASCADE theo booking)
 *  - user co so demo: NV 0901000001-0901000005, khach 0910000001-0910000014,
 *    0900000001-0900000003 (con: staff, customer, ca lam, yeu cau nghi/doi ca
 *    tu CASCADE theo staff; lich cua ho phai xoa truoc o buoc 1)
 *
 * Khong dong den: dich vu, danh muc, tai khoan admin, lich/thanh toan that.
 *
 * Chay: node scripts/reset-demo.mjs (hoac npm run db:demo-reset)
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'nail_management',
});

const DEMO_PHONES = [
  '0901000001', '0901000002', '0901000003', '0901000004', '0901000005',
  '0910000001', '0910000002', '0910000003', '0910000004', '0910000005',
  '0910000006', '0910000007', '0910000008', '0910000009', '0910000010',
  '0910000011', '0910000012', '0910000013', '0910000014',
  '0900000001', '0900000002', '0900000003',
];

/* 1. Lich demo: theo note, hoac cua user demo (bao ca lich demo cu chua co note). */
const [marked] = await connection.query(
  `SELECT booking_id FROM booking WHERE note LIKE '[DEMO]%'`);
const [ofDemoUsers] = await connection.query(
  `SELECT b.booking_id FROM booking b
     LEFT JOIN customer c ON c.customer_id = b.customer_id
     LEFT JOIN users cu ON cu.user_id = c.user_id
     LEFT JOIN staff st ON st.staff_id = b.staff_id
     LEFT JOIN users su ON su.user_id = st.user_id
    WHERE cu.phone IN (?) OR su.phone IN (?)`,
  [DEMO_PHONES, DEMO_PHONES]);
const ids = [...new Set([
  ...marked.map((r) => r.booking_id),
  ...ofDemoUsers.map((r) => r.booking_id),
])];
if (ids.length) {
  for (const table of ['booking_event', 'booking_image', 'booking_addon']) {
    await connection.query(`DELETE FROM ${table} WHERE booking_id IN (?)`, [ids]);
  }
  await connection.query(
    'DELETE FROM review_images WHERE review_id IN (SELECT review_id FROM review WHERE booking_id IN (?))',
    [ids]);
  await connection.query('DELETE FROM review WHERE booking_id IN (?)', [ids]);
  await connection.query('DELETE FROM payment_transaction WHERE booking_id IN (?)', [ids]);
  await connection.query('DELETE FROM payment WHERE booking_id IN (?)', [ids]);
  await connection.query('DELETE FROM booking WHERE booking_id IN (?)', [ids]);
}
console.log(`Da xoa ${ids.length} lich demo.`);

/* 2. Tai khoan demo (staff/customer/ca/yeu cau tu CASCADE). */
const [users] = await connection.query('SELECT user_id, phone FROM users WHERE phone IN (?)', [DEMO_PHONES]);
if (users.length) {
  const uids = users.map((u) => u.user_id);
  await connection.query('DELETE FROM users WHERE user_id IN (?)', [uids]);
}
console.log(`Da xoa ${users.length} tai khoan demo (${users.map((u) => u.phone).join(', ') || 'khong co'}).`);

await connection.end();
