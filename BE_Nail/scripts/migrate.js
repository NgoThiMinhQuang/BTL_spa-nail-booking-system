import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(currentDirectory, '../DB/migrations/001_home_content.sql');
const sql = await fs.readFile(migrationPath, 'utf8');

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
  await connection.query(sql);
  console.log('Migration dữ liệu trang chủ hoàn tất.');
} finally {
  await connection.end();
}
