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

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'nail_management',
  charset: 'utf8mb4',
  multipleStatements: true,
});

try {
  for (const file of migrationFiles) {
    const sql = await fs.readFile(path.join(migrationDirectory, file), 'utf8');
    await connection.query(sql);
    console.log(`Đã chạy migration: ${file}`);
  }
  console.log('Toàn bộ migration đã hoàn tất.');
} finally {
  await connection.end();
}
