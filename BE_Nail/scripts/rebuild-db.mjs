import 'dotenv/config';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sql = await fs.readFile('DB/Database.sql', 'utf8');
const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});
await c.query(sql);
console.log('Database.sql applied');
await c.end();