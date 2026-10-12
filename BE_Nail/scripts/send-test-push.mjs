/* Gửi một push thử ra màn hình điện thoại của một user.
   Dùng sau khi máy đã mở app, đăng nhập và bấm Cho phép thông báo:
     node scripts/send-test-push.mjs <userId> [nội dung]
   Không có máy nào đăng ký thì báo rõ, khỏi đoán. */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const userId = process.argv[2];
const text = process.argv.slice(3).join(' ') || 'Tin thử từ NailHouse. Nếu bạn đọc được dòng này thì push đã tới máy.';
if (!userId) {
  console.error('Dùng: node scripts/send-test-push.mjs <userId> [nội dung]');
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
