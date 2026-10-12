import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'nail_management',
  connectionLimit: 2,
});

try {
  const [rows] = await pool.query(
    `SELECT u.user_id AS userId, u.full_name AS name, u.phone, dt.platform,
            LEFT(dt.push_token, 30) AS tokenHead, dt.updated_at AS updated
       FROM device_token dt JOIN users u ON u.user_id = dt.user_id
      ORDER BY dt.updated_at DESC LIMIT 10`,
  );
  console.log(`ROWS: ${rows.length}`);
  for (const r of rows) {
    console.log(`- uid=${r.userId} ${r.name} | ${r.phone} | ${r.platform} | ${r.tokenHead}... | ${r.updated}`);
  }
} catch (e) {
  console.log(`DB_ERR: ${e.message}`);
} finally {
  await pool.end();
}
