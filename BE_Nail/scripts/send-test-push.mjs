/* Gửi một push thử ra màn hình điện thoại của một tài khoản.
   Dùng sau khi máy đã mở app, đăng nhập và bấm Cho phép thông báo:
     node scripts/send-test-push.mjs <sdt-hoac-userId> [nội dung]
   Không có máy nào đăng ký thì báo rõ, khỏi đoán. */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const who = process.argv[2];
const text = process.argv.slice(3).join(' ') || 'Tin thử từ NailHouse. Nếu bạn đọc được dòng này thì push đã tới máy.';
if (!who) {
  console.error('Dùng: node scripts/send-test-push.mjs <sdt-hoac-userId> [nội dung]');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'nail_management',
  connectionLimit: 2,
});

try {
  /* Nhận cả user_id lẫn số điện thoại cho dễ dùng. */
  let userId = /^\d+$/.test(who) && who.length < 9 ? who : null;
  if (!userId) {
    const [[found]] = await pool.query(
      'SELECT user_id AS userId FROM users WHERE phone = ? LIMIT 1', [who]);
    userId = found ? found.userId : null;
  }
  if (!userId) {
    console.log(`Không tìm thấy tài khoản với "${who}". Nhập đúng SĐT đăng nhập app.`);
    process.exit(2);
  }
  const [devices] = await pool.query(
    'SELECT push_token AS token FROM device_token WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5',
    [userId],
  );
  if (!devices.length) {
    console.log(`User ${userId} chưa có máy nào đăng ký. Mở app, đăng nhập rồi vào tab Cá nhân + bấm Cho phép.`);
    process.exit(2);
  }
  for (const device of devices) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: device.token, title: 'NailHouse thử push', body: text }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => null);
    const ticket = payload?.data;
    console.log(ticket?.status === 'ok'
      ? `Đã đẩy tới ${device.token.slice(0, 28)}… (receipt ${ticket.id ?? '—'})`
      : `Đẩy lỗi: ${ticket?.message ?? `HTTP ${response.status}`}`);
  }
} finally {
  await pool.end();
}
