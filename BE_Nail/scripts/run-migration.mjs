/* ===== Chạy các file migration trong DB/migrations theo thứ tự tên =====
   Dùng:
     node --env-file=.env scripts/run-migration.mjs            chạy mọi file chưa chạy
     node --env-file=.env scripts/run-migration.mjs 006_x.sql  chạy đúng file đó

   Tự tách câu lệnh rồi gửi từng câu một, thay vì bật multipleStatements:
   pool của database.js không mở cờ đó, và tách tay cũng tránh được việc một
   câu lệnh chứa nhiều câu lọt vào. File đã chạy được đánh dấu trong
   bảng schema_migrations nên chạy lại không trùng. */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/config/database.js';

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'DB', 'migrations',
);

/** Tách SQL thành từng câu: bỏ chú thích, không cắt nhầm dấu ; trong chuỗi. */
function splitStatements(sql) {
  const withoutComments = sql
    .replace(/^\s*--[^\n]*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const statements = [];
  let buffer = '';
  let quote = null;

  for (const char of withoutComments) {
    if (quote) {
      buffer += char;
      /* Dấu nháy đóng trong chuỗi: bỏ qua nếu bị escape bằng dấu gạch chéo. */
      if (char === '\\') { continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; buffer += char; continue; }
    if (char === ';') {
      if (buffer.trim()) statements.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += char;
  }
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

const requested = process.argv.slice(2);

async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const [done] = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(done.map((row) => row.name));

  const all = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const files = requested.length
    ? all.filter((name) => requested.includes(name))
    : all.filter((name) => !applied.has(name));

  if (!files.length) {
    console.log(requested.length
      ? 'Khong co file migration nao khop.'
      : 'Khong con migration nao can chay.');
    return;
  }

  for (const name of files) {
    const statements = splitStatements(await readFile(path.join(migrationsDir, name), 'utf8'));

    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      try {
        await pool.query(statement);
      } catch (error) {
        const preview = statement.replace(/\s+/g, ' ').slice(0, 70);
        console.error(`x ${name} — cau ${index + 1}/${statements.length}`);
        console.error(`  ${preview}...`);
        console.error(`  ${error.code ?? ''} ${error.sqlMessage ?? error.message}`);
        process.exitCode = 1;
        return;
      }
    }

    await pool.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', [name]);
    console.log(`+ chay    ${name} (${statements.length} cau)`);
  }

  console.log('\nXong migration.');
}

await main();
await pool.end();
