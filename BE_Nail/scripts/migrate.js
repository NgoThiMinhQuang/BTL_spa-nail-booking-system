import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(currentDirectory, '../DB/migrations');
const migrationFiles = (await fs.readdir(migrationDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort((left, right) => left.localeCompare(right));

const targetDatabase = process.env.DB_NAME ?? 'nail_management';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: targetDatabase,
  charset: 'utf8mb4',
  multipleStatements: true,
});

/* Chặn lỗi rất dễ gặp: một file migration lỡ viết `USE <database>;` sẽ đổi
   database đang dùng giữa chừng, và mọi câu lệnh phía sau sẽ chạy vào
   database khác — thường là database thật khi đang chạy test. Lỗi này
   không báo gì cả, chỉ thấy dữ liệu "tự biến mất".
   Cách chặn: sau mỗi file, kiểm tra lại đang ở database nào. */
async function assertSameDatabase(file) {
  const [[row]] = await connection.query('SELECT DATABASE() AS name');
  if (row.name !== targetDatabase) {
    throw new Error(
      `Migration ${file} đã đổi sang database "${row.name}" `
      + `thay vì "${targetDatabase}".\n`
      + 'File đó nhiều khả năng chứa câu `USE <database>;` — hãy bỏ đi, '
      + 'vì script đã kết nối sẵn tới database cần dùng.');
  }
}

console.log(`Đang chạy migration trên database: ${targetDatabase}`);

try {
  for (const file of migrationFiles) {
    const sql = await fs.readFile(path.join(migrationDirectory, file), 'utf8');
    await connection.query(sql);
    await assertSameDatabase(file);
    console.log(`Đã chạy migration: ${file}`);
  }
  console.log('Toàn bộ migration đã hoàn tất.');
} finally {
  await connection.end();
}
