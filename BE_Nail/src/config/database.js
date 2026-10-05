import mysql from 'mysql2/promise';

function createPoolFromEnv() {
  return mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'nail_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    charset: 'utf8mb4',
  });
}

export let pool = createPoolFromEnv();

/**
 * CHỈ DÙNG TRONG TEST: trỏ mọi controller sang database test.
 *
 * Các controller `import { pool }` nên gán lại ở đây có hiệu lực ngay
 * (ESM live binding). Không gọi hàm này ở code chạy thật.
 */
export function _setPoolForTests(testPool) {
  pool = testPool;
}

export async function checkDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
}
