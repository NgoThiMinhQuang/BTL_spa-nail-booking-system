/* ===== Test nghiá»‡p vá»¥ lá»‹ch háº¹n =====

   Cháº¡y báº±ng:  node --test tests/

   Bá»™ test nÃ y dá»±ng má»™t database riÃªng (nail_management_test), náº¡p
   Databasse.sql rá»“i cháº¡y cÃ¡c migration, nÃªn khÃ´ng Ä‘á»¥ng vÃ o dá»¯ liá»‡u
   tháº­t cá»§a dá»± Ã¡n. Sau Ä‘Ã³ kiá»ƒm tra Ä‘Ãºng nhá»¯ng luáº­t dá»… sai nháº¥t:

     - MÃ¡y tráº¡ng thÃ¡i lá»‹ch háº¹n (chuyá»ƒn nÃ o Ä‘Æ°á»£c, chuyá»ƒn nÃ o bá»‹ cháº·n)
     - Chá»‘ng Ä‘áº·t trÃ¹ng, tÃ­nh cáº£ khoáº£ng nghá»‰ giá»¯a hai lá»‹ch
     - Khung giá» cÃ²n trá»‘ng (lá»—i so sÃ¡nh timestamp vá»›i phÃºt)
     - Chá»¥p giÃ¡: Ä‘á»•i giÃ¡ dá»‹ch vá»¥ khÃ´ng lÃ m Ä‘á»•i lá»‹ch cÅ©
     - MÃ¡y tráº¡ng thÃ¡i thanh toÃ¡n
     - Doanh thu chá»‰ tÃ­nh lá»‹ch Ä‘Ã£ thu tiá»n

   Má»—i test tá»± dá»±ng láº¡i dá»¯ liá»‡u cáº§n thiáº¿t nÃªn cháº¡y Ä‘á»™c láº­p, khÃ´ng phá»¥
   thuá»™c thá»© tá»±. */

import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test, { after, before, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

import {
  ALLOWED_TRANSITIONS, canStaffTransition, canTransition, isCancelWindowOpen,
} from '../src/lib/booking-state.js';
import {
  PAYMENT_TRANSITIONS, canPaymentTransition, finalAmount, resolvePaymentAmount,
} from '../src/lib/payment-state.js';
import {
  actualServiceMinutes, createBooking as createBookingTx, isDate, momentOf,
} from '../src/lib/booking-service.js';
import { clockOfMinutes, minutesOfClock } from '../src/lib/staff-availability.js';
import * as dbConfig from '../src/config/database.js';
/* Controller test cháº¡y trÃªn database test nhá» _setPoolForTests (xem
   src/config/database.js): má»i test bÃªn dÆ°á»›i gá»i controller nhÆ°ng khÃ´ng
   cháº¡m vÃ o database tháº­t. */
import { addAddon, patchBooking, removeAddon } from '../src/controllers/booking-admin.controller.js';
import { addCustomerImage } from '../src/controllers/booking.controller.js';
import { getHome } from '../src/controllers/home.controller.js';
import { savePayment } from '../src/controllers/payment.controller.js';
import { patchPayment } from '../src/controllers/payment.controller.js';
import { register } from '../src/controllers/auth.controller.js';
import { cancelBooking, createBooking as createCustomerBooking, getAvailableSlots } from '../src/controllers/booking.controller.js';
import { approveScheduleRequest } from '../src/controllers/request.controller.js';
import { confirmDepositPayment, createDepositIntent, sweepExpiredDeposits } from '../src/controllers/deposit.controller.js';
import { getBookingDetail } from '../src/controllers/booking.controller.js';
import { deleteService, setStaffStatus } from '../src/controllers/catalog.controller.js';
import {
  assignServices, deleteCategory, removeServiceFromStaff, updateStaff,
} from '../src/controllers/catalog.controller.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const TEST_DB = process.env.TEST_DB_NAME ?? 'nail_management_test';
const config = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  multipleStatements: true,
};

let db;
let setupPromise = null;

/* Pool test dùng chung: mọi code chạm pool mặc định (auth, availability
   không truyền runner) đều chạy trên database test, kể cả ở CI nơi không
   có database thật. Không có dòng này thì test auth rớt với
   "Unknown database 'nail_management'". */
let testPool = null;
let realPool = null;

/**
 * Dá»±ng database test má»™t láº§n, cÃ¡c láº§n gá»i sau dÃ¹ng láº¡i káº¿t quáº£.
 *
 * Má»i test gá»i `connect()` Ä‘á»u pháº£i chá» viá»‡c dá»±ng xong, nÃªn khÃ´ng phá»¥ thuá»™c
 * thá»© tá»± mÃ  trÃ¬nh cháº¡y test thi hÃ nh hook â€” trÆ°á»›c Ä‘Ã¢y cÃ³ test cháº¡y trÆ°á»›c khi
 * dá»¯ liá»‡u sáºµn sÃ ng vÃ  bÃ¡o lá»—i khoÃ¡ ngoáº¡i ráº¥t khÃ³ hiá»ƒu.
 */
function ensureReady() {
  setupPromise ??= setup();
  return setupPromise;
}

/** Káº¿t ná»‘i tá»›i database test (tá»± chá» dá»±ng xong náº¿u chÆ°a). */
async function connect() {
  await ensureReady();
  const connection = await mysql.createConnection({ ...config, database: TEST_DB });
  const [[row]] = await connection.query('SELECT COUNT(*) AS n FROM staff');
  if (!row.n) {
    /* Pháº£i Ä‘Ã³ng káº¿t ná»‘i trÆ°á»›c khi nÃ©m lá»—i: káº¿t ná»‘i cÃ²n má»Ÿ thÃ¬ node khÃ´ng
       bao giá» thoÃ¡t, vÃ  toÃ n bá»™ output cá»§a láº§n cháº¡y sáº½ bá»‹ nuá»‘t. */
    await connection.end();
    throw new Error(
      'Báº£ng staff trong database test bá»‹ trá»‘ng dÃ¹ Ä‘Ã£ seed. '
      + 'CÃ³ kháº£ nÄƒng hai tiáº¿n trÃ¬nh test cÃ¹ng cháº¡y trÃªn má»™t database test.');
  }
  return connection;
}

async function setup() {
  /* 1. Táº¡o database test náº¿u chÆ°a cÃ³.
     DÃ¹ng IF NOT EXISTS thay vÃ¬ DROP/CREATE: xoÃ¡ cáº£ database pháº£i chá»
     má»i káº¿t ná»‘i khÃ¡c Ä‘Ã³ng háº¿t nÃªn ráº¥t cháº­m vÃ  dá»… treo khi cÃ²n ai Ä‘ang
     má»Ÿ database. BÃªn trong, Database.sql váº«n xoÃ¡ vÃ  dá»±ng láº¡i tá»«ng báº£ng
     nÃªn dá»¯ liá»‡u cÅ© trong Ä‘Ã³ khÃ´ng áº£nh hÆ°á»Ÿng. */
  const admin = await mysql.createConnection(config);
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS ${TEST_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  /* 2. Náº¡p schema gá»‘c rá»“i cháº¡y cÃ¡c migration theo Ä‘Ãºng thá»© tá»± mÃ 
      `npm run db:migrate` sáº½ cháº¡y.

      Database.sql cá»‘ Ã½ ghi cá»©ng tÃªn database lÃ  nail_management Ä‘á»ƒ cháº¡y
      tay khÃ´ng cáº§n tham sá»‘. á»ž Ä‘Ã¢y thay báº±ng tÃªn database test, Ä‘á»“ng thá»i
      cáº¯t bá» pháº§n Ä‘áº§u file (DROP/CREATE DATABASE vÃ  USE) Ä‘á»ƒ khÃ´ng bao
      giá» xoÃ¡ nháº§m database tháº­t khi cháº¡y npm test. */
  db = await mysql.createConnection({ ...config, database: TEST_DB });
  const raw = await fs.readFile(path.join(root, 'DB/Database.sql'), 'utf8');
  const start = raw.indexOf('DROP TABLE IF EXISTS');
  /* Cáº¯t tá»« `DROP TABLE IF EXISTS` nÃªn pháº£i báº­t láº¡i cÃ¢u táº¯t kiá»ƒm tra khoÃ¡
     ngoáº¡i (náº±m á»Ÿ pháº§n Ä‘áº§u file, Ä‘Ã£ bá»‹ cáº¯t) â€” khÃ´ng cÃ³ nÃ³ thÃ¬ khÃ´ng xoÃ¡
     Ä‘Æ°á»£c báº£ng cha nhÆ° `users` khi báº£ng con cÃ²n tham chiáº¿u. */
  await db.query('SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n'
    + raw.slice(start).replaceAll('nail_management', TEST_DB));

  const dir = path.join(root, 'DB/migrations');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.query(await fs.readFile(path.join(dir, file), 'utf8'));
    /* Cháº·n lá»—i ráº¥t dá»… gáº·p: má»™t file migration lá»¡ viáº¿t `USE <database>;` sáº½
       Ä‘á»•i database Ä‘ang dÃ¹ng giá»¯a chá»«ng, vÃ  má»i cÃ¢u lá»‡nh phÃ­a sau cháº¡y vÃ o
       database khÃ¡c â€” thÆ°á»ng lÃ  database THáº¬T. Lá»—i nÃ y khÃ´ng bÃ¡o gÃ¬,
       chá»‰ tháº¥y dá»¯ liá»‡u test "tá»± biáº¿n máº¥t". */
    const [[where]] = await db.query('SELECT DATABASE() AS name');
    if (where.name !== TEST_DB) {
      throw new Error(
        `Migration ${file} Ä‘Ã£ Ä‘á»•i sang database "${where.name}" `
        + `thay vÃ¬ "${TEST_DB}". File Ä‘Ã³ nhiá»u kháº£ nÄƒng cÃ³ cÃ¢u \`USE ...;\` `
        + 'cáº§n bá» Ä‘i.');
    }
  }

  /* 3. Dá»¯ liá»‡u tá»‘i thiá»ƒu cho test. */
  await seed(db);
  await db.end();

  return db;
}

before(ensureReady);

/* Trỏ pool mặc định sang database test NGAY TỪ ĐẦU, trước mọi test trong
   file — kể cả các test cũ gọi auth qua pool mặc định. Đăng ký sau
   before(ensureReady) nên chạy sau khi schema + seed xong. */
before(async () => {
  await ensureReady();
  if (!testPool) {
    realPool = dbConfig.pool;
    testPool = mysql.createPool({
      ...config, database: TEST_DB, connectionLimit: 10,
      decimalNumbers: true, charset: 'utf8mb4',
    });
    dbConfig._setPoolForTests(testPool);
  }
});

/* Giá»¯ database test láº¡i giá»¯a cÃ¡c láº§n cháº¡y. Láº§n sau Database.sql dá»±ng láº¡i
   toÃ n bá»™ báº£ng nÃªn váº«n sáº¡ch, nhÆ°ng khá»i pháº£i chá» DROP DATABASE â€” thao tÃ¡c
   Ä‘Ã³ cháº­m vÃ  treo náº¿u cÃ²n káº¿t ná»‘i nÃ o chÆ°a Ä‘Ã³ng. Muá»‘n dá»n thÃ¬ cháº¡y:
      DROP DATABASE nail_management_test;

   Äá»“ng thá»i Ä‘Ã³ng luÃ´n connection pool cá»§a src/config/database.js: pool
   giá»¯ socket má»Ÿ nÃªn náº¿u khÃ´ng Ä‘Ã³ng, node sáº½ khÃ´ng bao giá» thoÃ¡t dÃ¹ test
   Ä‘Ã£ cháº¡y xong. */
after(async () => {
  /* Đóng cả hai pool đúng một lần: testPool (mọi controller/test dùng
     chung sau swap) và pool gốc. Thiếu dòng này node treo dù test xong. */
  dbConfig._setPoolForTests(realPool);
  if (testPool) await testPool.end();
  await dbConfig.pool.end();
});

async function seed(connection) {
  const hash = await bcrypt.hash('Test@1234', 10);

  /* Dá»n dá»¯ liá»‡u test cÅ© trÆ°á»›c. Database.sql Ä‘Ã£ dá»±ng láº¡i báº£ng nÃªn thÆ°á»ng
     khÃ´ng cÃ²n gÃ¬, nhÆ°ng dá»n á»Ÿ Ä‘Ã¢y cho phÃ©p cháº¡y láº¡i seed() an toÃ n. */
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['booking_event', 'booking_image', 'booking_addon', 'review_images',
    'review', 'payment', 'booking', 'staff_leave_request', 'staff_schedule_request',
    'staff_schedule', 'staff_service', 'staff', 'customer', 'users']) {
    await connection.query(`DELETE FROM ${table}`);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  /* TÃ i khoáº£n: 1 khÃ¡ch, 2 nhÃ¢n viÃªn, 1 quáº£n trá»‹, 1 nhÃ¢n viÃªn Ä‘Ã£ khoÃ¡. */
  await connection.query(
    `INSERT INTO users (user_id, full_name, phone, email, password, role, status) VALUES
       (9001, 'Khach Test',    '0911000001', 'khach@test.local', ?, 'CUSTOMER', 'ACTIVE'),
       (9002, 'Nhan vien Test', '0911000002', 'nv@test.local',    ?, 'STAFF',    'ACTIVE'),
       (9003, 'Nhan vien Khac', '0911000003', 'nv2@test.local',   ?, 'STAFF',    'ACTIVE'),
       (9004, 'Quan tri Test',  '0911000004', 'admin@test.local', ?, 'ADMIN',    'ACTIVE'),
       (9005, 'Nhan bi khoa',   '0911000005', 'nv3@test.local',   ?, 'STAFF',    'INACTIVE')`,
    [hash, hash, hash, hash, hash],
  );

  await connection.query(
    'INSERT INTO customer (customer_id, user_id) VALUES (9001, 9001)');

  await connection.query(
    `INSERT INTO staff (staff_id, user_id, specialty, experience_year) VALUES
       (9001, 9002, 'Son Gel', 3),
       (9002, 9003, 'Nail Art', 1),
       (9003, 9005, NULL, 0)`);

  /* Dich vu: 60 phut + 15 phut nghi = 75 phut chiem lich.
     ON DUPLICATE vÃ¬ Database.sql Ä‘Ã£ cÃ³ sáºµn 3 dá»‹ch vá»¥ máº«u (mÃ£ 1..3) vÃ 
     dÃ¹ng láº¡i chÃºng cho gá»n, khÃ´ng cáº§n táº¡o mÃ£ riÃªng. */
  await connection.query(
    `INSERT INTO services
       (service_id, category_id, service_name, price, duration, buffer_time, status)
     VALUES (1, 1, 'Son Gel Cao Cap', 200000, 60, 15, 'ACTIVE'),
            (2, 1, 'Dich vu phu', 50000, 30, 0, 'ACTIVE')
     ON DUPLICATE KEY UPDATE
       service_name = VALUES(service_name), price = VALUES(price),
       duration = VALUES(duration), buffer_time = VALUES(buffer_time),
       status = 'ACTIVE'`,
  );

  await connection.query(
    'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (9001, 1), (9001, 2)');

  /* Ca lam 09:00 - 18:00 trong 8 ngay ke ca hom nay. */
  await connection.query(
    `INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status)
     SELECT 9001, DATE_ADD(CURDATE(), INTERVAL d.n DAY), '09:00:00', '18:00:00', 'AVAILABLE'
       FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
             UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) d`,
  );

  /* Kiá»ƒm tra ngay: náº¿u seed há»ng mÃ  khÃ´ng bÃ¡o, cÃ¡c test phÃ­a dÆ°á»›i sáº½ há»ng
     theo kiá»ƒu khÃ³ hiá»ƒu (lá»—i khoÃ¡ ngoáº¡i á»Ÿ test chá»© khÃ´ng pháº£i á»Ÿ seed). */
  for (const table of ['users', 'staff', 'customer', 'staff_schedule']) {
    const [row] = await connection.query(`SELECT COUNT(*) AS n FROM ${table}`);
    if (!row[0].n) throw new Error(`seed(): báº£ng ${table} khÃ´ng cÃ³ dá»¯ liá»‡u`);
  }
}

/* ================================================================
   1. MÃY TRáº NG THÃI Lá»ŠCH Háº¸N
   ================================================================ */

describe('MÃ¡y tráº¡ng thÃ¡i lá»‹ch háº¹n', () => {
  test('luá»“ng chÃ­nh Ä‘i Ä‘Ãºng thá»© tá»±', () => {
    assert.equal(canTransition('PENDING', 'CONFIRMED').ok, true);
    assert.equal(canTransition('CONFIRMED', 'PROCESSING').ok, true);
    assert.equal(canTransition('PROCESSING', 'COMPLETED').ok, true);
  });

  test('cÃ¡c nhÃ¡nh phá»¥ Ä‘Ãºng nghiá»‡p vá»¥', () => {
    assert.equal(canTransition('PENDING', 'CANCELLED').ok, true);
    assert.equal(canTransition('CONFIRMED', 'CANCELLED').ok, true);
    assert.equal(canTransition('CONFIRMED', 'NO_SHOW').ok, true);
  });

  test('cÃ¡c Ä‘Æ°á»ng Ä‘i sai Ä‘á»u bá»‹ cháº·n', () => {
    /* Nhá»¯ng Ä‘Æ°á»ng nÃ y trÆ°á»›c Ä‘Ã¢y lá»t lÃªn vÃ¬ má»—i controller tá»± liá»‡t kÃª
       tráº¡ng thÃ¡i riÃªng. */
    const forbidden = [
      ['PENDING', 'COMPLETED'],
      ['PENDING', 'PROCESSING'],
      ['PENDING', 'NO_SHOW'],
      ['PROCESSING', 'CANCELLED'],
      ['PROCESSING', 'NO_SHOW'],
      ['COMPLETED', 'CONFIRMED'],
      ['NO_SHOW', 'CONFIRMED'],
      ['CANCELLED', 'PENDING'],
    ];
    for (const [from, to] of forbidden) {
      const result = canTransition(from, to);
      assert.equal(result.ok, false, `KHÃ”NG Ä‘Æ°á»£c phÃ©p ${from} â†’ ${to}`);
      assert.ok(result.reason.length > 0, 'pháº£i kÃ¨m lÃ½ do Ä‘á»ƒ hiá»‡n ra giao diá»‡n');
    }
  });

  test('tráº¡ng thÃ¡i káº¿t thÃºc khÃ´ng Ä‘i Ä‘Æ°á»£c Ä‘Ã¢u ná»¯a', () => {
    for (const end of ['COMPLETED', 'CANCELLED', 'NO_SHOW']) {
      assert.deepEqual(ALLOWED_TRANSITIONS[end], []);
      for (const to of ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) {
        assert.equal(canTransition(end, to).ok, false, `${end} â†’ ${to} pháº£i bá»‹ cháº·n`);
      }
    }
  });

  test('khÃ´ng chuyá»ƒn sang tráº¡ng thÃ¡i khÃ´ng tá»“n táº¡i', () => {
    assert.equal(canTransition('PENDING', 'FOO').ok, false);
    assert.equal(canTransition('PENDING', '').ok, false);
  });

  test('nhÃ¢n viÃªn chá»‰ Ä‘Æ°á»£c báº¯t Ä‘áº§u vÃ  hoÃ n thÃ nh', () => {
    assert.equal(canStaffTransition('CONFIRMED', 'PROCESSING').ok, true);
    assert.equal(canStaffTransition('PROCESSING', 'COMPLETED').ok, true);
    /* XÃ¡c nháº­n, há»§y, Ä‘Ã¡nh dáº¥u khÃ´ng Ä‘áº¿n khÃ´ng pháº£i viá»‡c cá»§a nhÃ¢n viÃªn. */
    assert.equal(canStaffTransition('PENDING', 'CONFIRMED').ok, false);
    assert.equal(canStaffTransition('CONFIRMED', 'CANCELLED').ok, false);
    assert.equal(canStaffTransition('CONFIRMED', 'NO_SHOW').ok, false);
  });

  test('nhÃ¢n viÃªn khÃ´ng bá» qua bÆ°á»›c báº¯t buá»™c', () => {
    assert.equal(canStaffTransition('PENDING', 'COMPLETED').ok, false);
    assert.equal(canStaffTransition('PENDING', 'PROCESSING').ok, false);
  });
});

/* ================================================================
   2. Äá»”I ÄÆ N Vá»Š THá»œI GIAN
   ---------------------------------------------------------------
   ÄÃ¢y lÃ  lá»—i gá»‘c cá»§a pháº§n khung giá» cÃ²n trá»‘ng: má»™t váº¿ lÃ  timestamp Unix
   (new Date(...).getTime()) cÃ²n váº¿ kia lÃ  `minute * 60000` â€” lá»‡ch Ä‘Æ¡n
   vá»‹ nÃªn pháº§n kiá»ƒm tra trÃ¹ng lá»‹ch cho káº¿t quáº£ tuá»³ tiá»‡n.
   ================================================================ */

describe('Äá»•i Ä‘Æ¡n vá»‹ thá»i gian', () => {
  test('Date vÃ  chuá»—i HH:mm cho cÃ¹ng sá»‘ phÃºt', () => {
    assert.equal(minutesOfClock(new Date(2026, 0, 5, 9, 30)), 570);
    assert.equal(minutesOfClock('09:30:00'), 570);
    assert.equal(minutesOfClock('09:30'), 570);
  });

  test('giá»¯a khoáº£ng giá» qua ná»­a Ä‘Ãªm váº«n Ä‘Ãºng', () => {
    /* Ca Ä‘Ãªm 22:00 â€“ 02:00: '02:00' lÃ  120 phÃºt trong ngÃ y, khÃ´ng pháº£i
       24:00. HÃ m chá»‰ dÃ¹ng Ä‘á»ƒ so trong cÃ¹ng má»™t ngÃ y nÃªn nháº¥t quÃ¡n lÃ  Ä‘á»§. */
    assert.equal(minutesOfClock('00:00'), 0);
    assert.equal(minutesOfClock('23:45'), 1425);
    assert.equal(clockOfMinutes(1425), '23:45');
    assert.equal(clockOfMinutes(570), '09:30');
  });

  test('vÃ²ng láº·p qua láº¡i khÃ´ng lá»‡ch', () => {
    for (let minute = 0; minute < 1440; minute += 7) {
      assert.equal(minutesOfClock(clockOfMinutes(minute)), minute);
    }
  });
});

/* ================================================================
   3. CHá»NG Äáº¶T TRÃ™NG
   ================================================================ */

describe('Chá»‘ng Ä‘áº·t trÃ¹ng lá»‹ch', () => {
  /** Khoáº£ng [from, to) cÃ³ chá»“ng [a, b) khÃ´ng â€” cÃ¹ng cÃ´ng thá»©c backend dÃ¹ng. */
  const overlaps = (from, to, a, b) => from < b && to > a;

  test('lá»‹ch náº±m trong lá»‹ch khÃ¡c thÃ¬ trÃ¹ng', () => {
    /* A: 09:00â€“10:15  â†’  540â€“615
       B: 09:30â€“10:30  â†’  570â€“630
       B báº¯t Ä‘áº§u lÃºc 09:30, tá»©c lÃ  A cÃ²n Ä‘ang phá»¥c vá»¥ â†’ trÃ¹ng. */
    assert.equal(overlaps(570, 630, 540, 615), true);
    /* B báº¯t Ä‘áº§u trÆ°á»›c khi A káº¿t thÃºc â†’ trÃ¹ng. */
    assert.equal(overlaps(600, 660, 540, 615), true);
  });

  test('khung giá» cháº¡m Ä‘Ãºng giá» káº¿t thÃºc thÃ¬ khÃ´ng trÃ¹ng', () => {
    /* A: 09:00â€“10:15, trong Ä‘Ã³ 10:00â€“10:15 lÃ  khoáº£ng nghá»‰ cá»§a nhÃ¢n viÃªn.
       B báº¯t Ä‘áº§u 10:00 â†’ váº«n trÃ¹ng, vÃ¬ nhÃ¢n viÃªn cÃ²n bá»‹ chiáº¿m tá»›i 10:15. */
    assert.equal(overlaps(600, 660, 540, 615), true, '10:00 váº«n náº±m trong khoáº£ng bá»‹ chiáº¿m');
    /* B báº¯t Ä‘áº§u Ä‘Ãºng 10:15 â†’ há»£p lá»‡. */
    assert.equal(overlaps(615, 675, 540, 615), false, '10:15 lÃ  khung giá» há»£p lá»‡ Ä‘áº§u tiÃªn');
  });

  test('hai khoáº£ng liá»n nhau khÃ´ng trÃ¹ng', () => {
    assert.equal(overlaps(615, 690, 540, 615), false);
  });

  test('lá»‹ch trÃ¹ng hoÃ n toÃ n bá»‹ phÃ¡t hiá»‡n', () => {
    assert.equal(overlaps(540, 615, 540, 615), true);
  });
});

/* ================================================================
   4. CHá»¤P GIÃ (SNAPSHOT)
   ================================================================ */

describe('Chá»¥p giÃ¡ vÃ  thá»i lÆ°á»£ng', () => {
  test('Ä‘á»•i giÃ¡ dá»‹ch vá»¥ khÃ´ng lÃ m Ä‘á»•i lá»‹ch cÅ©', async () => {
    const connection = await connect();
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const day = tomorrow.toISOString().slice(0, 10);
      await connection.query(
        `INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status)
         VALUES (9001, ?, '09:00:00', '18:00:00', 'AVAILABLE')
         ON DUPLICATE KEY UPDATE end_time = '18:00:00'`, [day],
      );

      /* Táº¡o lá»‹ch nhÆ° lÃºc khÃ¡ch Ä‘áº·t: chá»¥p giÃ¡ 200.000 / 60 phÃºt. */
      const [created] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'PENDING', 'MOBILE')`,
        [`${day} 11:00:00`, `${day} 12:15:00`],
      );

      /* Admin Ä‘á»•i giÃ¡ vÃ  thá»i lÆ°á»£ng cá»§a dá»‹ch vá»¥. */
      await connection.query(
        `UPDATE services SET price = 300000, duration = 90, buffer_time = 20
          WHERE service_id = 1`);

      const [[row]] = await connection.query(
        `SELECT COALESCE(b.service_price, s.price) AS price,
                COALESCE(b.service_duration, s.duration) AS duration,
                COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime
           FROM booking b JOIN services s ON s.service_id = b.service_id
          WHERE b.booking_id = ?`, [created.insertId],
      );

      assert.equal(Number(row.price), 200000, 'lá»‹ch cÅ© pháº£i giá»¯ giÃ¡ lÃºc Ä‘áº·t');
      assert.equal(Number(row.duration), 60, 'lá»‹ch cÅ© pháº£i giá»¯ thá»i lÆ°á»£ng lÃºc Ä‘áº·t');
      assert.equal(Number(row.bufferTime), 15);

      /* Lá»‹ch má»›i pháº£i nháº­n giÃ¡ má»›i. */
      const [fresh] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 300000, 90, 20, ?, ?, 'PENDING', 'MOBILE')`,
        [`${day} 14:00:00`, `${day} 15:50:00`],
      );
      assert.ok(fresh.insertId > 0);

      /* Tráº£ láº¡i dá»‹ch vá»¥ vá» giÃ¡ cÅ© cho cÃ¡c test sau. */
      await connection.query(
        `UPDATE services SET price = 200000, duration = 60, buffer_time = 15 WHERE service_id = 1`);
      await connection.query('DELETE FROM booking WHERE booking_id IN (?, ?)',
        [created.insertId, fresh.insertId]);
    } finally {
      await connection.end();
    }
  });

  test('end_time = start + thá»i lÆ°á»£ng + khoáº£ng nghá»‰', async () => {
    const connection = await connect();
    try {
      const [row] = await connection.query(
        `SELECT TIMESTAMPDIFF(MINUTE, start_time, end_time) AS span
           FROM booking WHERE booking_id = (SELECT MAX(booking_id) FROM booking)`);
      /* Náº¿u cÃ³ lá»‹ch nÃ o tá»« dá»¯ liá»‡u cÅ© thÃ¬ span pháº£i báº±ng duration + buffer. */
      if (row.length) {
        const [[check]] = await connection.query(
          `SELECT TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time) AS span,
                  COALESCE(b.service_duration, s.duration) + COALESCE(b.buffer_time, s.buffer_time, 0) AS expected
             FROM booking b JOIN services s ON s.service_id = b.service_id
            WHERE b.booking_id = (SELECT MAX(booking_id) FROM booking)`);
        if (check.span !== null) {
          assert.equal(Number(check.span), Number(check.expected));
        }
      }
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   5. MÃY TRáº NG THÃI THANH TOÃN
   ================================================================ */

describe('MÃ¡y tráº¡ng thÃ¡i thanh toÃ¡n', () => {
  test('cÃ¡c bÆ°á»›c Ä‘i há»£p lá»‡', () => {
    assert.equal(canPaymentTransition('UNPAID', 'DEPOSITED').ok, true);
    assert.equal(canPaymentTransition('UNPAID', 'PAID').ok, true);
    assert.equal(canPaymentTransition('DEPOSITED', 'PAID').ok, true);
  });

  test('PAID khÃ´ng quay láº¡i Ä‘Æ°á»£c â€” khÃ´ng cÃ³ nghiá»‡p vá»¥ hoÃ n tiá»n', () => {
    assert.equal(canPaymentTransition('PAID', 'UNPAID').ok, false);
    assert.equal(canPaymentTransition('PAID', 'DEPOSITED').ok, false);
    assert.deepEqual(PAYMENT_TRANSITIONS.PAID, []);
  });

  test('DEPOSITED khÃ´ng lÃ¹i vá» UNPAID', () => {
    assert.equal(canPaymentTransition('DEPOSITED', 'UNPAID').ok, false);
  });

  test('ghi Ä‘Ã¨ cÃ¹ng tráº¡ng thÃ¡i Ä‘Æ°á»£c phÃ©p', () => {
    assert.equal(canPaymentTransition('DEPOSITED', 'DEPOSITED').ok, true);
  });
});

/* ================================================================
   6. TÃNH TIá»€N CÃ“ Sá» LÆ¯á»¢NG
   ---------------------------------------------------------------
   booking_addon cÃ³ cá»™t quantity. Cá»™ng SUM(price) sáº½ tÃ­nh thiáº¿u: 3 mÃ³n
   cÃ¹ng loáº¡i giÃ¡ 40.000 lÃ  120.000 chá»© khÃ´ng pháº£i 40.000.
   ================================================================ */

describe('TÃ­nh tiá»n dá»‹ch vá»¥ phÃ¡t sinh', () => {
  test('nhÃ¢n vá»›i sá»‘ lÆ°á»£ng', () => {
    assert.equal(finalAmount({
      servicePrice: 200000,
      addons: [{ price: 40000, quantity: 3 }],
    }), 320000);
  });

  test('cá»™ng nhiá»u mÃ³n khÃ¡c loáº¡i', () => {
    assert.equal(finalAmount({
      servicePrice: 200000,
      addons: [
        { price: 40000, quantity: 3 },
        { price: 90000, quantity: 1 },
      ],
    }), 410000);
  });

  test('khÃ´ng cÃ³ mÃ³n phÃ¡t sinh thÃ¬ báº±ng giÃ¡ dá»‹ch vá»¥', () => {
    assert.equal(finalAmount({ servicePrice: 150000 }), 150000);
    assert.equal(finalAmount({ servicePrice: 150000, addons: [] }), 150000);
  });

  test('thiáº¿u quantity thÃ¬ coi nhÆ° má»™t', () => {
    assert.equal(finalAmount({
      servicePrice: 100000, addons: [{ price: 50000 }],
    }), 150000);
  });

  test('SUM(price * quantity) cá»§a database khá»›p vá»›i hÃ m JS', async () => {
    const connection = await connect();
    try {
      /* Táº¡o má»™t lá»‹ch rá»“i thÃªm dá»‹ch vá»¥ phÃ¡t sinh cÃ³ sá»‘ lÆ°á»£ng khÃ¡c nhau,
         Ä‘á»ƒ so hai cÃ¡ch tÃ­nh tháº­t sá»± khÃ¡c nhau chá»© khÃ´ng chá»‰ báº±ng 0 = 0. */
      const day = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
      const [booking] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'COMPLETED', 'MOBILE')`,
        [`${day} 09:00:00`, `${day} 10:15:00`],
      );
      const id = booking.insertId;

      await connection.query(
        `INSERT INTO booking_addon (booking_id, service_id, service_name, quantity, price)
         VALUES (?, 1, 'Son Gel Cao Cap', 3, 40000),
                (?, 2, 'Dich vu phu', 2, 50000)`,
        [id, id],
      );

      const [rows] = await connection.query(
        'SELECT price, quantity FROM booking_addon WHERE booking_id = ?', [id]);
      const [[sum]] = await connection.query(
        'SELECT COALESCE(SUM(price * quantity), 0) AS total FROM booking_addon WHERE booking_id = ?',
        [id]);

      assert.equal(finalAmount({ servicePrice: 0, addons: rows }), Number(sum.total));
      /* 3 Ã— 40.000 + 2 Ã— 50.000 = 220.000. Náº¿u dÃ¹ng SUM(price) sáº½ ra
         90.000 â€” Ä‘Ã³ chÃ­nh lÃ  lá»—i mÃ  pháº§n nÃ y cháº·n láº¡i. */
      assert.equal(Number(sum.total), 220000);

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [id]);
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   7. DOANH THU CHá»ˆ TÃNH Lá»ŠCH ÄÃƒ THU TIá»€N
   ---------------------------------------------------------------
   COMPLETED + UNPAID pháº£i ra doanh thu báº±ng 0. TrÆ°á»›c Ä‘Ã¢y cÃ¡c bÃ¡o cÃ¡o
   láº¥y SUM(s.price) cá»§a má»i lá»‹ch COMPLETED nÃªn lá»‹ch chÆ°a thu tiá»n váº«n
   bá»‹ tÃ­nh vÃ o.
   ================================================================ */

describe('Doanh thu chá»‰ tÃ­nh lá»‹ch Ä‘Ã£ thu tiá»n', () => {
  test('lá»‹ch hoÃ n thÃ nh nhÆ°ng chÆ°a thu tiá»n khÃ´ng ra doanh thu', async () => {
    const connection = await connect();
    try {
      const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const [booking] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'COMPLETED', 'MOBILE')`,
        [`${day} 09:00:00`, `${day} 10:15:00`],
      );
      const id = booking.insertId;

      /* CHÆ¯A cÃ³ dÃ²ng thanh toÃ¡n â†’ khÃ´ng cÃ³ doanh thu. */
      const [[before]] = await connection.query(
        `SELECT COALESCE(SUM(pay.amount), 0) AS revenue
           FROM booking b JOIN payment pay ON pay.booking_id = b.booking_id
          WHERE b.booking_id = ? AND pay.payment_status = 'PAID'`, [id]);
      assert.equal(Number(before.revenue), 0, 'COMPLETED + chÆ°a cÃ³ payment = 0');

      /* ThÃªm dÃ²ng UNPAID â†’ váº«n báº±ng 0. */
      await connection.query(
        `INSERT INTO payment (booking_id, amount, payment_status) VALUES (?, 200000, 'UNPAID')`, [id]);
      const [[unpaid]] = await connection.query(
        `SELECT COALESCE(SUM(pay.amount), 0) AS revenue
           FROM booking b JOIN payment pay ON pay.booking_id = b.booking_id
          WHERE b.booking_id = ? AND pay.payment_status = 'PAID'`, [id]);
      assert.equal(Number(unpaid.revenue), 0, 'COMPLETED + UNPAID = 0');

      /* Chuyá»ƒn sang PAID â†’ má»›i cÃ³ doanh thu. */
      await connection.query(`UPDATE payment SET payment_status = 'PAID' WHERE booking_id = ?`, [id]);
      const [[paid]] = await connection.query(
        `SELECT COALESCE(SUM(pay.amount), 0) AS revenue
           FROM booking b JOIN payment pay ON pay.booking_id = b.booking_id
          WHERE b.booking_id = ? AND pay.payment_status = 'PAID'`, [id]);
      assert.equal(Number(paid.revenue), 200000, 'COMPLETED + PAID má»›i tÃ­nh doanh thu');

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [id]);
    } finally {
      await connection.end();
    }
  });

  test('tiá»n cá»c khÃ´ng Ä‘Æ°á»£c tÃ­nh vÃ o doanh thu', async () => {
    const connection = await connect();
    try {
      const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const [booking] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'COMPLETED', 'MOBILE')`,
        [`${day} 09:00:00`, `${day} 10:15:00`],
      );
      await connection.query(
        `INSERT INTO payment (booking_id, amount, payment_status) VALUES (?, 50000, 'DEPOSITED')`,
        [booking.insertId]);

      const [[row]] = await connection.query(
        `SELECT COALESCE(SUM(pay.amount), 0) AS revenue
           FROM booking b JOIN payment pay ON pay.booking_id = b.booking_id
          WHERE b.booking_id = ? AND pay.payment_status = 'PAID'`, [booking.insertId]);
      assert.equal(Number(row.revenue), 0, 'tiá»n cá»c khÃ´ng pháº£i doanh thu');

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [booking.insertId]);
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   8. Báº¢O Vá»† QUYá»€N
   ================================================================ */

describe('PhÃ¢n quyá»n', () => {
  test('tÃ i khoáº£n bá»‹ khoÃ¡ khÃ´ng láº¥y Ä‘Æ°á»£c token há»£p lá»‡', async () => {
    const { loadUserFromToken, signToken } = await import('../src/lib/auth.js');
    const connection = await connect();
    const [rows] = await connection.query(
      'SELECT user_id FROM users WHERE user_id = 9005');
    await connection.end();

    /* Token váº«n Ä‘Ãºng chá»¯ kÃ½, nhÆ°ng tÃ i khoáº£n INACTIVE â†’ loadUserFromToken
       pháº£i tráº£ null thay vÃ¬ tháº£ qua. */
    const token = signToken({ userId: rows[0].user_id, role: 'STAFF' });
    const user = await loadUserFromToken(token);
    assert.equal(user, null, 'tÃ i khoáº£n INACTIVE pháº£i bá»‹ cháº·n');
  });

  test('token sai chá»¯ kÃ½ bá»‹ tá»« chá»‘i', async () => {
    const { verifyToken } = await import('../src/lib/auth.js');
    assert.equal(verifyToken('abc.def.ghi'), null);
  });

  test('má»—i lá»‹ch chá»‰ cÃ³ má»™t Ä‘Ã¡nh giÃ¡', async () => {
    const connection = await connect();
    try {
      const [dupe] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review'
            AND COLUMN_NAME = 'booking_id' AND NON_UNIQUE = 0`);
      assert.ok(dupe.length > 0, 'review.booking_id pháº£i cÃ³ rÃ ng buá»™c UNIQUE');
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   9. Báº¢NG Má»šI THEO NGHIá»†P Vá»¤
   ================================================================ */

describe('Báº£ng nghiá»‡p vá»¥', () => {
  const tables = [
    'staff_leave_request',
    'staff_schedule_request',
    'review_images',
    'staff_attendance',
    'payroll',
    'payroll_item',
  ];

  for (const table of tables) {
    test(`báº£ng ${table} tá»“n táº¡i`, async () => {
      const connection = await connect();
      try {
        const [rows] = await connection.query(
          `SELECT COUNT(*) AS n FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = ?`, [table]);
        assert.equal(Number(rows[0].n), 1, `thiáº¿u báº£ng ${table}`);
      } finally {
        await connection.end();
      }
    });
  }

  test('danh má»¥c cÃ³ tráº¡ng thÃ¡i ACTIVE / INACTIVE', async () => {
    const connection = await connect();
    try {
      const [rows] = await connection.query(
        `SELECT COLUMN_TYPE FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'service_category'
            AND column_name = 'status'`);
      assert.equal(rows.length, 1);
      assert.match(rows[0].COLUMN_TYPE, /ACTIVE/);
      assert.match(rows[0].COLUMN_TYPE, /INACTIVE/);
    } finally {
      await connection.end();
    }
  });

  test('dá»‹ch vá»¥ dÃ¹ng chung má»™t bá»™ tÃªn tráº¡ng thÃ¡i ACTIVE / INACTIVE', async () => {
    const connection = await connect();
    try {
      const [rows] = await connection.query(
        `SELECT COLUMN_TYPE FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'services'
            AND column_name = 'status'`);
      assert.match(rows[0].COLUMN_TYPE, /INACTIVE/);
      assert.doesNotMatch(rows[0].COLUMN_TYPE, /HIDDEN/,
        'HIDDEN lÃ  tÃªn riÃªng cá»§a táº§ng staff, gÃ¢y nháº§m khi bÃ¡o cÃ¡o');
    } finally {
      await connection.end();
    }
  });

  test('máº­t kháº©u trong báº£ng users Ä‘á»u lÃ  hash', async () => {
    const connection = await connect();
    try {
      const [rows] = await connection.query(
        "SELECT password FROM users WHERE password NOT LIKE '$2%'");
      assert.equal(rows.length, 0, 'khÃ´ng Ä‘Æ°á»£c cÃ²n máº­t kháº©u chÆ°a mÃ£ hoÃ¡');
    } finally {
      await connection.end();
    }
  });

  test('yÃªu cáº§u nghá»‰ cÃ³ ngÆ°á»i duyá»‡t vÃ  má»‘c duyá»‡t', async () => {
    const connection = await connect();
    try {
      const [rows] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'staff_leave_request'
            AND column_name IN ('reviewed_by','reviewed_at','reason','status')`);
      assert.equal(rows.length, 4);
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   10. LUáº¬T DUYá»†T NGHá»ˆ
   ================================================================ */

describe('Duyá»‡t yÃªu cáº§u nghá»‰', () => {
  test('cÃ³ lá»‹ch trong khoáº£ng nghá»‰ thÃ¬ khÃ´ng Ä‘Æ°á»£c duyá»‡t', async () => {
    const connection = await connect();
    try {
      const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const [booking] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'CONFIRMED', 'MOBILE')`,
        [`${day} 09:00:00`, `${day} 10:15:00`],
      );

      /* Äáº¿m lá»‹ch chá»“ng lÃªn khoáº£ng nghá»‰ â€” Ä‘Ãºng Ä‘iá»u kiá»‡n cháº·n duyá»‡t. */
      const [clash] = await connection.query(
        `SELECT COUNT(*) AS n FROM booking
          WHERE staff_id = 9001 AND status IN ('PENDING','CONFIRMED','PROCESSING')
            AND start_time < ? AND end_time > ?`,
        [`${day} 12:00:00`, `${day} 08:00:00`],
      );
      assert.equal(Number(clash[0].n), 1, 'pháº£i phÃ¡t hiá»‡n lá»‹ch cáº§n xá»­ lÃ½ trÆ°á»›c');

      /* Sau khi dá»i lá»‹ch ra ngoÃ i khoáº£ng nghá»‰ thÃ¬ duyá»‡t Ä‘Æ°á»£c. */
      await connection.query(
        `UPDATE booking SET start_time = ?, end_time = ? WHERE booking_id = ?`,
        [`${day} 14:00:00`, `${day} 15:15:00`, booking.insertId],
      );
      const [clear] = await connection.query(
        `SELECT COUNT(*) AS n FROM booking
          WHERE staff_id = 9001 AND status IN ('PENDING','CONFIRMED','PROCESSING')
            AND start_time < ? AND end_time > ?`,
        [`${day} 12:00:00`, `${day} 08:00:00`],
      );
      assert.equal(Number(clear[0].n), 0, 'dá»i lá»‹ch ra ngoÃ i thÃ¬ duyá»‡t Ä‘Æ°á»£c');

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [booking.insertId]);
    } finally {
      await connection.end();
    }
  });

  test('yÃªu cáº§u nghá»‰ Ä‘Ã£ duyá»‡t lÃ m nhÃ¢n viÃªn khÃ´ng nháº­n Ä‘Æ°á»£c lá»‹ch', async () => {
    const connection = await connect();
    try {
      const day = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
      await connection.query(
        `INSERT INTO staff_leave_request (staff_id, start_datetime, end_datetime, reason, status)
         VALUES (9001, ?, ?, 'Nghá»‰ viá»‡c gia Ä‘Ã¬nh', 'APPROVED')`,
        [`${day} 09:00:00`, `${day} 18:00:00`],
      );

      /* CÃ¹ng má»™t Ä‘iá»u kiá»‡n overlap mÃ  checkStaffAvailable dÃ¹ng. */
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS n FROM staff_leave_request
          WHERE staff_id = 9001 AND status = 'APPROVED'
            AND start_datetime < ? AND end_datetime > ?`,
        [`${day} 14:00:00`, `${day} 10:00:00`],
      );
      assert.ok(Number(rows[0].n) > 0, 'khung giá» trong khoáº£ng nghá»‰ pháº£i bá»‹ cháº·n');

      await connection.query('DELETE FROM staff_leave_request WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   Báº¢N VÃ Báº¢O Vá»† Dá»® LIá»†U
   ---------------------------------------------------------------
   CÃ¡c test bÃªn dÆ°á»›i bao phá»§ Ä‘Ãºng nhá»¯ng lá»—i tá»«ng lá»t qua bá»™ test cÅ©:
   PAID tráº£ thiáº¿u, double-book nhÃ¡nh "báº¥t ká»³ nhÃ¢n viÃªn", duyá»‡t Ä‘á»•i ca
   khi cÃ²n lá»‹ch, Staff thÃªm add-on, áº£nh máº«u cá»§a khÃ¡ch, xoÃ¡ add-on sau
   PAID, thá»i gian phá»¥c vá»¥ thá»±c táº¿, khoÃ¡ nhÃ¢n viÃªn cÃ²n lá»‹ch, xoÃ¡ dá»‹ch
   vá»¥ Ä‘ang lÃ m add-on, vÃ  biÃªn há»§y Ä‘Ãºng 2 giá».
   ================================================================ */

/** Response Express giáº£: chá»‰ cáº§n status().json() vÃ  json(). */
function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

/** next(err) cá»§a Express: test nÃ o cÅ©ng muá»‘n lá»—i hiá»‡n ra, khÃ´ng nuá»‘t. */
function strictNext(err) {
  if (err) throw err;
}

const dayPlus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe('Báº£n vÃ¡ báº£o vá»‡ dá»¯ liá»‡u', () => {




  before(async () => {
    /* Pool test đã dựng ở before top-level; giữ lại để chạy độc lập. */
    await ensureReady();
    if (!testPool) {
      realPool = dbConfig.pool;
      testPool = mysql.createPool({
        ...config, database: TEST_DB, connectionLimit: 10,
        decimalNumbers: true, charset: 'utf8mb4',
      });
      dbConfig._setPoolForTests(testPool);
    }
  });

  after(async () => {
    /* Chỉ trả pool về, không end ở đây — after top-level đóng một lần. */
    dbConfig._setPoolForTests(realPool);
  });

  /* NhÃ¢n viÃªn test cÃ¡ch ly: khÃ´ng Ä‘á»¥ng lá»‹ch cá»§a cÃ¡c test khÃ¡c. */
  async function makeStaff(n, dayOffset) {
    const uid = 9300 + n;
    const sid = 9300 + n;
    const day = dayPlus(dayOffset);
    const connection = await testPool.getConnection();
    try {
      await connection.query(
        `INSERT INTO users (user_id, full_name, phone, email, password, role, status)
         VALUES (?,?,?,?,'$2b$10$testseed','STAFF','ACTIVE')`,
        [uid, `NV Guard ${n}`, `093300${String(n).padStart(4, '0')}`, `nvguard${n}@test.local`]);
      await connection.query(
        'INSERT INTO staff (staff_id, user_id, specialty, experience_year) VALUES (?,?,?,?)',
        [sid, uid, 'Test', 1]);
      await connection.query(
        'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (?, 1)', [sid]);
      await connection.query(
        `INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status)
         VALUES (?,?, '09:00:00', '18:00:00', 'AVAILABLE')`, [sid, day]);
    } finally {
      connection.release();
    }
    return { uid, sid, day };
  }

  async function makeBooking({ customerId = 9001, staffId, status = 'PENDING', day, from = '10:00:00', to = '11:15:00' }) {
    const [result] = await testPool.query(
      `INSERT INTO booking
         (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
          start_time, end_time, status, source)
       VALUES (?,?,?,?,?,?, ?,?,?, 'MOBILE')`,
      [customerId, staffId, 1, 200000, 60, 15, `${day} ${from}`, `${day} ${to}`, status]);
    return result.insertId;
  }

  /* ---------------- PAID pháº£i báº±ng Ä‘Ãºng tá»•ng ---------------- */

  test('PAID bá» qua sá»‘ tiá»n frontend gá»­i lÃªn', () => {
    assert.deepEqual(resolvePaymentAmount('PAID', 1, 500000), { ok: true, amount: 500000 });
    assert.deepEqual(resolvePaymentAmount('PAID', 0, 500000), { ok: true, amount: 500000 });
    assert.deepEqual(resolvePaymentAmount('PAID', 999999, 500000), { ok: true, amount: 500000 });
    assert.deepEqual(resolvePaymentAmount('PAID', undefined, 500000), { ok: true, amount: 500000 });
  });

  test('UNPAID vÃ  DEPOSITED váº«n kiá»ƒm tra khoáº£ng há»£p lá»‡', () => {
    assert.deepEqual(resolvePaymentAmount('DEPOSITED', 100000, 500000), { ok: true, amount: 100000 });
    assert.equal(resolvePaymentAmount('DEPOSITED', 600000, 500000).ok, false);
    assert.equal(resolvePaymentAmount('UNPAID', -1, 500000).ok, false);
    assert.equal(resolvePaymentAmount('UNPAID', Number.NaN, 500000).ok, false);
    assert.equal(resolvePaymentAmount('UNPAID', 500001, 500000).ok, false);
  });

  test('savePayment PAID vá»›i amount = 1 váº«n ghi Ä‘á»§ tá»•ng', async () => {
    const { sid, day } = await makeStaff(11, 3);
    const bookingId = await makeBooking({ staffId: sid, day });
    const res = mockRes();
    await savePayment(
      { params: { id: String(bookingId) }, body: { status: 'PAID', amount: 1, method: 'CASH' }, user: { name: 'Admin Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.amount, 200000);
    const [[row]] = await testPool.query(
      'SELECT amount FROM payment WHERE booking_id = ?', [bookingId]);
    assert.equal(Number(row.amount), 200000);
  });

  /* ---------------- KhoÃ¡ add-on sau PAID ---------------- */

  test('removeAddon bá»‹ cháº·n khi lá»‹ch Ä‘Ã£ PAID', async () => {
    const { sid, day } = await makeStaff(12, 3);
    const bookingId = await makeBooking({ staffId: sid, day });
    const [addon] = await testPool.query(
      `INSERT INTO booking_addon (booking_id, service_id, service_name, quantity, price)
       VALUES (?,?, 'Dich vu phu', 1, 50000)`, [bookingId, 2]);
    await testPool.query(
      `INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
       VALUES (?,?, 'CASH', 'PAID', NOW())`, [bookingId, 250000]);

    const res = mockRes();
    await removeAddon(
      { params: { id: String(bookingId), addonId: String(addon.insertId) }, user: { role: 'ADMIN', name: 'Admin Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 409);
    const [[kept]] = await testPool.query(
      'SELECT COUNT(*) AS n FROM booking_addon WHERE addon_id = ?', [addon.insertId]);
    assert.equal(Number(kept.n), 1);

    /* ChÆ°a PAID thÃ¬ váº«n bá» Ä‘Æ°á»£c (Ä‘Æ°á»ng thÃ nh cÃ´ng khÃ´ng vá»¡). */
    await testPool.query('DELETE FROM payment WHERE booking_id = ?', [bookingId]);
    const res2 = mockRes();
    await removeAddon(
      { params: { id: String(bookingId), addonId: String(addon.insertId) }, user: { role: 'ADMIN', name: 'Admin Test' } },
      res2, strictNext,
    );
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.removed, true);
  });

  /* ---------------- Duyá»‡t Ä‘á»•i ca khi cÃ²n lá»‹ch ---------------- */

  test('approveScheduleRequest tá»« chá»‘i khi ca má»›i bá» rÆ¡i lá»‹ch', async () => {
    const { sid, day } = await makeStaff(13, 5);
    const bookingId = await makeBooking({ staffId: sid, day, from: '10:00:00', to: '11:15:00' });
    const [request] = await testPool.query(
      `INSERT INTO staff_schedule_request (staff_id, work_date, start_time, end_time, action, status)
       VALUES (?,?, '08:00:00', '09:00:00', 'UPDATE', 'PENDING')`, [sid, day]);

    const res = mockRes();
    await approveScheduleRequest(
      { params: { id: String(request.insertId) }, body: {}, user: { userId: 9004 } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.reason, 'CONFLICTING_BOOKINGS');
    assert.equal(res.body.bookings.length, 1);

    /* Xá»­ lÃ½ lá»‹ch xong thÃ¬ duyá»‡t Ä‘Æ°á»£c. */
    await testPool.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
    const res2 = mockRes();
    await approveScheduleRequest(
      { params: { id: String(request.insertId) }, body: {}, user: { userId: 9004 } },
      res2, strictNext,
    );
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.status, 'APPROVED');
  });

  /* ---------------- NhÃ¢n viÃªn thÃªm add-on ---------------- */

  test('staff thÃªm add-on lÃºc PROCESSING, bá»‹ cháº·n lÃºc CONFIRMED', async () => {
    const { sid, day } = await makeStaff(14, 3);
    const doingId = await makeBooking({ staffId: sid, day, status: 'PROCESSING' });
    const waitingId = await makeBooking({ staffId: sid, day, status: 'CONFIRMED', from: '14:00:00', to: '15:15:00' });

    const staffUser = { role: 'STAFF', staffId: sid, name: 'NV Guard 14' };
    const okRes = mockRes();
    await addAddon(
      { params: { id: String(doingId) }, body: { serviceId: 2, quantity: 2 }, user: staffUser },
      okRes, strictNext,
    );
    assert.equal(okRes.statusCode, 201);
    assert.equal(okRes.body.data.total, 100000);

    const badRes = mockRes();
    await addAddon(
      { params: { id: String(waitingId) }, body: { serviceId: 2, quantity: 1 }, user: staffUser },
      badRes, strictNext,
    );
    assert.equal(badRes.statusCode, 409);
  });

  test('staff khÃ´ng thÃªm Ä‘Æ°á»£c add-on vÃ o lá»‹ch cá»§a ngÆ°á»i khÃ¡c', async () => {
    const { sid, day } = await makeStaff(15, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'PROCESSING' });
    const res = mockRes();
    await addAddon(
      { params: { id: String(bookingId) }, body: { serviceId: 2, quantity: 1 }, user: { role: 'STAFF', staffId: 9001, name: 'NV Khac' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 403);
  });

  /* ---------------- áº¢nh máº«u cá»§a khÃ¡ch ---------------- */

  test('khÃ¡ch gá»­i áº£nh cho lá»‹ch cá»§a mÃ¬nh, khÃ´ng gá»­i Ä‘Æ°á»£c cho lá»‹ch ngÆ°á»i khÃ¡c', async () => {
    await testPool.query(
      `INSERT INTO users (user_id, full_name, phone, email, password, role, status)
       VALUES (9401, 'Khach Guard', '0934000001', 'khachguard@test.local', '$2b$10$testseed', 'CUSTOMER', 'ACTIVE')`);
    await testPool.query('INSERT INTO customer (customer_id, user_id) VALUES (9401, 9401)');

    const { sid, day } = await makeStaff(16, 3);
    const mineId = await makeBooking({ customerId: 9001, staffId: sid, day });
    const otherId = await makeBooking({ customerId: 9401, staffId: sid, day, from: '14:00:00', to: '15:15:00' });

    const okRes = mockRes();
    await addCustomerImage(
      { params: { id: String(mineId) }, body: { url: 'https://cdn.test/mau.jpg' }, user: { customerId: 9001 } },
      okRes, strictNext,
    );
    assert.equal(okRes.statusCode, 201);

    const badRes = mockRes();
    await addCustomerImage(
      { params: { id: String(otherId) }, body: { url: 'https://cdn.test/mau.jpg' }, user: { customerId: 9001 } },
      badRes, strictNext,
    );
    assert.equal(badRes.statusCode, 403);
  });

  /* ---------------- KhoÃ¡ nhÃ¢n viÃªn cÃ²n lá»‹ch ---------------- */

  test('setStaffStatus INACTIVE bá»‹ cháº·n khi cÃ²n lá»‹ch tÆ°Æ¡ng lai', async () => {
    const { sid, day } = await makeStaff(17, 4);
    const bookingId = await makeBooking({ staffId: sid, day });

    const res = mockRes();
    await setStaffStatus(
      { params: { id: String(sid) }, body: { status: 'INACTIVE' }, user: { userId: 9004 } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 409);

    await testPool.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
    const res2 = mockRes();
    await setStaffStatus(
      { params: { id: String(sid) }, body: { status: 'INACTIVE' }, user: { userId: 9004 } },
      res2, strictNext,
    );
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.status, 'INACTIVE');
  });

  /* ---------------- XoÃ¡ dá»‹ch vá»¥ Ä‘ang lÃ m add-on ---------------- */

  test('deleteService bá»‹ cháº·n khi dá»‹ch vá»¥ náº±m trong booking_addon', async () => {
    const { sid, day } = await makeStaff(18, 3);
    const bookingId = await makeBooking({ staffId: sid, day });
    await testPool.query(
      `INSERT INTO booking_addon (booking_id, service_id, service_name, quantity, price)
       VALUES (?,?, 'Dich vu phu', 1, 50000)`, [bookingId, 2]);

    const res = mockRes();
    await deleteService(
      { params: { id: '2' }, user: { userId: 9004 } }, res, strictNext,
    );
    assert.equal(res.statusCode, 409);
  });

  /* ---------------- BiÃªn há»§y Ä‘Ãºng 2 giá» ---------------- */

  test('CONFIRMED Ä‘Ãºng 2:00:00 khÃ´ng há»§y Ä‘Æ°á»£c, trÃªn 2 giá» má»›i Ä‘Æ°á»£c', () => {
    const now = Date.UTC(2026, 5, 1, 12, 0, 0);
    const at = (ms) => new Date(now + ms).toISOString();
    assert.equal(isCancelWindowOpen(at(3 * 3600000), now), true);
    assert.equal(isCancelWindowOpen(at(2 * 3600000 + 60000), now), true);
    assert.equal(isCancelWindowOpen(at(2 * 3600000), now), false);
    assert.equal(isCancelWindowOpen(at(2 * 3600000 - 60000), now), false);
    assert.equal(isCancelWindowOpen(at(-3600000), now), false);
  });

    /* ---------------- CONFIRMED bat buoc co nhan vien (trang thai cuoi) ---------------- */

  test('PENDING + staff A, PATCH CONFIRMED + staffId null thi 409', async () => {
    const { sid, day } = await makeStaff(25, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'PENDING' });
    const res = mockRes();
    await patchBooking(
      { params: { id: String(bookingId) }, body: { status: 'CONFIRMED', staffId: null }, user: { name: 'Admin Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 409);
    const [[row]] = await testPool.query(
      'SELECT status, staff_id AS staffId FROM booking WHERE booking_id = ?', [bookingId]);
    assert.equal(row.status, 'PENDING');
    assert.equal(Number(row.staffId), sid);
  });

  test('CONFIRMED + staff A, PATCH staffId null rieng thi 409', async () => {
    const { sid, day } = await makeStaff(26, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'CONFIRMED' });
    const res = mockRes();
    await patchBooking(
      { params: { id: String(bookingId) }, body: { staffId: null }, user: { name: 'Admin Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 409);
    const [[row]] = await testPool.query(
      'SELECT status, staff_id AS staffId FROM booking WHERE booking_id = ?', [bookingId]);
    assert.equal(row.status, 'CONFIRMED');
    assert.equal(Number(row.staffId), sid);
  });

  test('PENDING + staff A, PATCH CONFIRMED giu nguyen staff thi 200 (duong thanh cong)', async () => {
    const { sid, day } = await makeStaff(27, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'PENDING' });
    await testPool.query(
      `INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
       VALUES (?, 60000, 'ONLINE', 'DEPOSITED', NOW())`, [bookingId]);
    const res = mockRes();
    await patchBooking(
      { params: { id: String(bookingId) }, body: { status: 'CONFIRMED' }, user: { name: 'Admin Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 200);
    const [[row]] = await testPool.query(
      'SELECT status, staff_id AS staffId FROM booking WHERE booking_id = ?', [bookingId]);
    assert.equal(row.status, 'CONFIRMED');
    assert.equal(Number(row.staffId), sid);
  });

    /* ---------------- CONFIRMED doi coc truoc ---------------- */

  test('PENDING + staff, chua coc, PATCH CONFIRMED thi 409', async () => {
    const { sid, day } = await makeStaff(29, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'PENDING' });
    const res = mockRes();
    await patchBooking(
      { params: { id: String(bookingId) }, body: { status: 'CONFIRMED' }, user: { name: 'Admin Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 409);
    const [[row]] = await testPool.query(
      'SELECT status FROM booking WHERE booking_id = ?', [bookingId]);
    assert.equal(row.status, 'PENDING');
  });

  /* ---------------- Dat coc 30% giu cho ---------------- */

  test('deposit-intent tra URL coc 30% cho lich PENDING', async () => {
    const { sid, day } = await makeStaff(30, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'PENDING' });
    const res = mockRes();
    await createDepositIntent(
      { params: { id: String(bookingId) }, user: { customerId: 9001 }, protocol: 'http', get: () => 'localhost:3000', ip: '127.0.0.1' },
      res, strictNext,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.deposit, 60000);
    assert.equal(res.body.data.total, 200000);
    assert.equal(res.body.data.remaining, 140000);
    assert.ok(String(res.body.data.paymentUrl).includes('mock-pay'));
  });

  test('confirmDepositPayment ghi DEPOSITED va tu dong CONFIRMED', async () => {
    const { sid, day } = await makeStaff(31, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'PENDING' });
    const result = await confirmDepositPayment({ bookingId, amount: 60000 });
    assert.equal(result.status, 200);
    assert.equal(result.confirmed, true);
    const [[row]] = await testPool.query(
      'SELECT b.status, p.payment_status AS payStatus, p.amount FROM booking b LEFT JOIN payment p ON p.booking_id = b.booking_id WHERE b.booking_id = ?', [bookingId]);
    assert.equal(row.status, 'CONFIRMED');
    assert.equal(row.payStatus, 'DEPOSITED');
    assert.equal(Number(row.amount), 60000);
  });

  test('sweep huy lich PENDING qua han, giu lich moi va lich da coc', async () => {
    const a = await makeStaff(32, 3);
    const expiredId = await makeBooking({ staffId: a.sid, day: a.day, status: 'PENDING' });
    await testPool.query('UPDATE booking SET created_at = NOW() - INTERVAL 20 MINUTE WHERE booking_id = ?', [expiredId]);
    const b = await makeStaff(33, 4);
    const freshId = await makeBooking({ staffId: b.sid, day: b.day, status: 'PENDING' });
    const paidId = await makeBooking({ staffId: b.sid, day: b.day, status: 'PENDING', from: '13:00:00', to: '14:15:00' });
    await testPool.query('UPDATE booking SET created_at = NOW() - INTERVAL 20 MINUTE WHERE booking_id = ?', [paidId]);
    await testPool.query("INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date) VALUES (?, 60000, 'ONLINE', 'DEPOSITED', NOW())", [paidId]);
    const out2 = await sweepExpiredDeposits();
    assert.ok(out2.cancelled >= 1);
    const [[e]] = await testPool.query('SELECT status FROM booking WHERE booking_id = ?', [expiredId]);
    assert.equal(e.status, 'CANCELLED');
    const [[f]] = await testPool.query('SELECT status FROM booking WHERE booking_id = ?', [freshId]);
    assert.equal(f.status, 'PENDING');
    const [[g]] = await testPool.query('SELECT status FROM booking WHERE booking_id = ?', [paidId]);
    assert.equal(g.status, 'PENDING');
  });

  test('khach huy lich da coc thi coc khong hoan', async () => {
    const { sid, day } = await makeStaff(34, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'CONFIRMED' });
    await testPool.query("INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date) VALUES (?, 60000, 'ONLINE', 'DEPOSITED', NOW())", [bookingId]);
    const res = mockRes();
    await cancelBooking(
      { params: { id: String(bookingId) }, body: {}, user: { customerId: 9001, name: 'Khach Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.forfeited, 60000);
    const [[pay]] = await testPool.query('SELECT payment_status AS status FROM payment WHERE booking_id = ?', [bookingId]);
    assert.equal(pay.status, 'DEPOSITED');
  });

/* ---------------- Availability bat ky chuyen vien ---------------- */

  test('availability khong staffId tra gio union, staffId abc thi 400', async () => {
    const { day } = await makeStaff(28, 3);
    const okRes = mockRes();
    await getAvailableSlots({ query: { serviceId: '1', date: day } }, okRes, strictNext);
    assert.equal(okRes.statusCode, 200);
    assert.ok(Array.isArray(okRes.body.data));
    assert.ok(okRes.body.data.length > 0);
    assert.equal(okRes.body.meta.duration, 60);
    const badRes = mockRes();
    await getAvailableSlots({ query: { serviceId: '1', staffId: 'abc', date: day } }, badRes, strictNext);
    assert.equal(badRes.statusCode, 400);
  });

/* ---------------- Double-book nhÃ¡nh báº¥t ká»³ nhÃ¢n viÃªn ---------------- */

  test('hai khÃ¡ch cÃ¹ng Ä‘áº·t má»™t giá» thÃ¬ má»™t ngÆ°á»i nháº­n 409', async () => {
    /* NgÃ y ngoÃ i 8 ngÃ y seed (chá»‰ nhÃ¢n viÃªn cÃ¡ch ly cÃ³ ca) Ä‘á»ƒ cháº¯c cháº¯n
       chá»‰ má»™t ngÆ°á»i Ä‘á»§ Ä‘iá»u kiá»‡n â€” náº¿u khÃ´ng request thua sáº½ rÆ¡i sang
       nhÃ¢n viÃªn khÃ¡c (Ä‘Ãºng thiáº¿t káº¿) vÃ  test khÃ´ng cÃ²n kiá»ƒm tra Ä‘Æ°á»£c
       viá»‡c chen nhau. */
    const { sid, day } = await makeStaff(19, 9);
    const startsAt = momentOf(day, '10:00');
    const input = {
      serviceId: 1, staffId: null, customerId: 9001,
      startsAt, duration: 60, bufferTime: 15, price: 200000,
      source: 'MOBILE', actorRole: 'CUSTOMER', actorName: 'Khach Test',
    };

    async function attempt() {
      const connection = await testPool.getConnection();
      await connection.beginTransaction();
      try {
        const record = await createBookingTx(connection, { ...input });
        await connection.commit();
        return { ok: true, record };
      } catch (error) {
        await connection.rollback();
        return { ok: false, status: error.status ?? 500 };
      } finally {
        connection.release();
      }
    }

    const [first, second] = await Promise.all([attempt(), attempt()]);
    const codes = [first.ok, second.ok].sort();
    assert.deepEqual(codes, [false, true]);
    const loser = first.ok ? second : first;
    assert.equal(loser.status, 409);

    const [[count]] = await testPool.query(
      `SELECT COUNT(*) AS n FROM booking
        WHERE staff_id = ? AND DATE(start_time) = ? AND status = 'PENDING'`, [sid, day]);
    assert.equal(Number(count.n), 1);
  });

  /* ---------------- Trang chá»§ khÃ´ng rÃ² rá»‰ há»“ sÆ¡ khÃ¡ch ---------------- */

  function mockHomeReq({ token = null, query = {} } = {}) {
    return {
      protocol: 'http',
      query,
      get: (name) => {
        if (String(name).toLowerCase() === 'host') return 'localhost:3000';
        if (String(name).toLowerCase() === 'authorization' && token) return `Bearer ${token}`;
        return null;
      },
    };
  }

  test('/api/home vÃ´ danh khÃ´ng tráº£ há»“ sÆ¡ dÃ¹ cÃ³ customerId trÃªn query', async () => {
    const res = mockRes();
    await getHome(mockHomeReq({ query: { customerId: '9001' } }), res, strictNext);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.customer, null);
    assert.equal(res.body.data.upcomingAppointment, null);
    assert.ok(res.body.data.featuredServices.length > 0);
    assert.ok(res.body.data.featuredArtists.length > 0);
  });

  test('/api/home tráº£ Ä‘Ãºng há»“ sÆ¡ cá»§a ngÆ°á»i Ä‘ang Ä‘Äƒng nháº­p', async () => {
    const { signToken } = await import('../src/lib/auth.js');
    const token = signToken({ userId: 9001, role: 'CUSTOMER' });
    const res = mockRes();
    await getHome(mockHomeReq({ token, query: { customerId: '9003' } }), res, strictNext);
    assert.equal(res.statusCode, 200);
    /* Query Ä‘Ã²i 9003 nhÆ°ng token lÃ  9001 â€” pháº£i tráº£ 9001. */
    assert.equal(res.body.data.customer.name, 'Khach Test');
  });

  /* ---------------- Thá»i gian phá»¥c vá»¥ thá»±c táº¿ ---------------- */

  test('actualServiceMinutes tÃ­nh tá»« má»‘c báº¯t Ä‘áº§u, thiáº¿u má»‘c thÃ¬ giá»¯ dá»± kiáº¿n', async () => {
    const { sid, day } = await makeStaff(20, 3);
    const timedId = await makeBooking({ staffId: sid, day, status: 'COMPLETED' });
    await testPool.query(
      `INSERT INTO booking_event (booking_id, event_type, detail, actor_role, actor_name, created_at)
       VALUES (?, 'SERVICE_STARTED', 'Bat dau', 'STAFF', 'NV Guard 20', DATE_SUB(NOW(), INTERVAL 90 MINUTE))`,
      [timedId]);

    const connection = await testPool.getConnection();
    try {
      const actual = await actualServiceMinutes(connection, timedId, 60);
      assert.ok(Math.abs(actual - 90) <= 1, `pháº£i ra ~90 phÃºt, nháº­n ${actual}`);

      const plainId = await makeBooking({ staffId: sid, day, status: 'COMPLETED', from: '14:00:00', to: '15:15:00' });
      assert.equal(await actualServiceMinutes(connection, plainId, 60), 60);
    } finally {
      connection.release();
    }
  });

  /* ---------------- Dot va ra soat toan bo ---------------- */

  test('isDate tu choi ngay khong ton tai', () => {
    assert.equal(isDate('2026-10-06'), true);
    assert.equal(isDate('2026-02-30'), false);
    assert.equal(isDate('2026-13-01'), false);
    assert.equal(isDate('2026-00-10'), false);
    assert.equal(isDate('06/10/2026'), false);
    assert.equal(isDate(''), false);
    assert.equal(isDate(null), false);
  });

  test('register tra dung customer_id cua bang customer', async () => {
    const phone = '0933555001';
    await testPool.query('DELETE FROM users WHERE phone = ?', [phone]);
    const res = mockRes();
    await register(
      {
        body: {
          fullName: 'Khach Guard Moi', phone, email: 'khachguardmoi@test.local',
          password: 'Test@1234',
        },
      },
      res, strictNext,
    );
    assert.equal(res.statusCode, 201);
    const returnedId = res.body.data.user.customerId;
    const [[row]] = await testPool.query(
      `SELECT c.customer_id FROM customer c JOIN users u ON u.user_id = c.user_id
        WHERE u.phone = ? LIMIT 1`, [phone]);
    assert.equal(Number(returnedId), Number(row.customer_id));
    await testPool.query('DELETE FROM users WHERE phone = ?', [phone]);
  });

  test('patchPayment DEPOSITED khong amount thi giu so cu', async () => {
    const { sid, day } = await makeStaff(22, 3);
    const bookingId = await makeBooking({ staffId: sid, day });
    await testPool.query(
      `INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
       VALUES (?,?, 'CASH', 'DEPOSITED', NOW())`, [bookingId, 50000]);
    const [[pay]] = await testPool.query(
      'SELECT payment_id FROM payment WHERE booking_id = ? LIMIT 1', [bookingId]);

    const res = mockRes();
    await patchPayment(
      { params: { id: String(pay.payment_id) }, body: { status: 'DEPOSITED', method: 'BANK_TRANSFER' }, user: { name: 'Admin Test' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.amount, 50000);
    assert.equal(res.body.data.method, 'BANK_TRANSFER');
  });

  test('mobile dat lich bo trong staffId thi backend tu chon', async () => {
    const { sid, day } = await makeStaff(23, 4);
    const res = mockRes();
    await createCustomerBooking(
      {
        body: { serviceId: 1, date: day, time: '10:00', note: '' },
        user: { customerId: 9001, name: 'Khach Test' },
      },
      res, strictNext,
    );
    assert.equal(res.statusCode, 201);
    /* Nhan vien seed 9001 cung du dieu kien va it lich khong kem - quan trong la backend tu chon duoc (truoc day thieu staffId la 400), khong phai nhat thiet trung nguoi cach ly. */
    assert.ok(['9001', String(sid)].includes(res.body.data.staffId));
  });

  test('go nhan vien khoi dich vu khong xoa dich vu', async () => {
    const res = mockRes();
    await removeServiceFromStaff(
      { params: { id: '9001', serviceId: '2' } }, res, strictNext,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.unassigned, true);
    const [[svc]] = await testPool.query(
      'SELECT service_id FROM services WHERE service_id = 2 LIMIT 1');
    assert.ok(svc, 'dich vu phai con trong danh muc');
    await testPool.query(
      'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (9001, 2)');
  });

  test('updateStaff email trung thi 409 chu khong 500', async () => {
    const res = mockRes();
    await updateStaff(
      { params: { id: '9001' }, body: { email: 'nv2@test.local' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 409);
  });

  test('deleteCategory con mau nail thi 409', async () => {
    const [design] = await testPool.query(
      `INSERT INTO nail_designs (design_name, image, category_id, is_trending, status)
       VALUES ('Mau test', '/uploads/test.jpg', 1, 0, 'ACTIVE')`);
    const res = mockRes();
    await deleteCategory({ params: { id: '1' } }, res, strictNext);
    assert.equal(res.statusCode, 409);
    await testPool.query('DELETE FROM nail_designs WHERE design_id = ?', [design.insertId]);
  });

  test('assignServices dich vu khong ton tai thi 404', async () => {
    const res = mockRes();
    await assignServices(
      { params: { id: '9001' }, body: { serviceIds: [999999] } }, res, strictNext,
    );
    assert.equal(res.statusCode, 404);
  });

  test('chi tiet lich: chu xem duoc, nguoi khac 404', async () => {
    const { sid, day } = await makeStaff(24, 3);
    const bookingId = await makeBooking({ customerId: 9001, staffId: sid, day });
    const okRes = mockRes();
    const mockGet = (name) => (String(name).toLowerCase() === 'host' ? 'localhost:3000' : null);
    await getBookingDetail({ params: { id: String(bookingId) }, user: { customerId: 9001 }, protocol: 'http', get: mockGet }, okRes, strictNext);
    assert.equal(okRes.statusCode, 200);
    assert.equal(okRes.body.data.id, String(bookingId));
    assert.ok(Array.isArray(okRes.body.data.addons));
    assert.ok(Array.isArray(okRes.body.data.images));
    const badRes = mockRes();
    await getBookingDetail({ params: { id: String(bookingId) }, user: { customerId: 9401 }, protocol: 'http', get: mockGet }, badRes, strictNext);
    assert.equal(badRes.statusCode, 404);
  });
});

/* Khau tru luong: muon + vang khong phep + nghi EMERGENCY quy ra tien. */
describe('Goi y khau tru luong', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });
  test('muon 10p + vang 1 ngay + nghi dot xuat 1 ca dung so', async () => {
    const connection = await connect();
    try {
      await connection.query(
        'UPDATE staff SET base_salary = 26000000, commission_rate = 0 WHERE staff_id = 9001');
      for (const day of ['2020-01-10', '2020-01-11', '2020-01-12']) {
        await connection.query(
          "INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status) VALUES (9001, ?, '09:00:00', '18:00:00', 'AVAILABLE') ON DUPLICATE KEY UPDATE start_time = '09:00:00', end_time = '18:00:00', status = 'AVAILABLE'",
          [day]);
      }
      await connection.query(
        "INSERT INTO staff_attendance (staff_id, work_date, check_in_at) VALUES (9001, '2020-01-10', '2020-01-10 09:20:00') ON DUPLICATE KEY UPDATE check_in_at = '2020-01-10 09:20:00', check_out_at = NULL");
      await connection.query(
        "INSERT INTO staff_leave_request (staff_id, start_datetime, end_datetime, reason, leave_type, status) VALUES (9001, '2020-01-12 09:00:00', '2020-01-12 18:00:00', 'Sot', 'EMERGENCY', 'APPROVED')");

      const { suggestDeduction } = await import('../src/controllers/payroll.controller.js');
      const res = mockRes();
      await suggestDeduction(
        { query: { staffId: '9001', month: '2020-01' } }, res, strictNext);
      assert.equal(res.statusCode, 200);
      if (res.statusCode !== 200) console.log('DEBUG suggest body:', JSON.stringify(res.body));
      const d = res.body.data;
      assert.equal(d.lateMinutes, 10);
      assert.equal(d.absentDays, 1);
      assert.equal(d.unpaidLeaveMinutes, 540);
      // muon 10p (~20833) + vang 1 cong (1000000) + nghi 540p (1125000)
      assert.equal(d.suggestedDeduction, 2145833);

      await connection.query(
        "DELETE FROM staff_attendance WHERE staff_id = 9001 AND work_date IN ('2020-01-10','2020-01-11','2020-01-12')");
      await connection.query(
        "DELETE FROM staff_schedule WHERE staff_id = 9001 AND work_date IN ('2020-01-10','2020-01-11','2020-01-12')");
      await connection.query('DELETE FROM staff_leave_request WHERE staff_id = 9001');
      await connection.query('UPDATE staff SET base_salary = 0, commission_rate = 0 WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });

  test('nghi NORMAL ca ngay thi khong tru', async () => {
    const connection = await connect();
    try {
      await connection.query(
        'UPDATE staff SET base_salary = 26000000 WHERE staff_id = 9001');
      await connection.query(
        "INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status) VALUES (9001, '2020-02-10', '09:00:00', '18:00:00', 'AVAILABLE') ON DUPLICATE KEY UPDATE status = 'AVAILABLE'");
      await connection.query(
        "INSERT INTO staff_leave_request (staff_id, start_datetime, end_datetime, reason, leave_type, status) VALUES (9001, '2020-02-10 09:00:00', '2020-02-10 18:00:00', 'Phep nam', 'NORMAL', 'APPROVED')");

      const { suggestDeduction } = await import('../src/controllers/payroll.controller.js');
      const res = mockRes();
      await suggestDeduction(
        { query: { staffId: '9001', month: '2020-02' } }, res, strictNext);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.suggestedDeduction, 0);

      await connection.query(
        "DELETE FROM staff_schedule WHERE staff_id = 9001 AND work_date = '2020-02-10'");
      await connection.query('DELETE FROM staff_leave_request WHERE staff_id = 9001');
      await connection.query('UPDATE staff SET base_salary = 0 WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });

  test('thang sai dinh dang thi 400', async () => {
    const { suggestDeduction } = await import('../src/controllers/payroll.controller.js');
    const res = mockRes();
    await suggestDeduction({ query: { staffId: '9001', month: '2020-13' } }, res, strictNext);
    assert.equal(res.statusCode, 400);
  });
});

/* Hoi quy: overview tung 500 vi query dich vu noi bat nham alias pay.amount. */
describe('Tong quan Admin', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });

  test('overview range=7 tra 200 va du so lieu', async () => {
    const { getOverview } = await import('../src/controllers/admin.controller.js');
    const res = mockRes();
    const mockGet = (name) => (String(name).toLowerCase() === 'host' ? 'localhost:3000' : null);
    await getOverview(
      { query: { range: '7' }, protocol: 'http', get: mockGet }, res, strictNext);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.data.today && typeof res.body.data.today.total === 'number');
    assert.ok(Array.isArray(res.body.data.topServices));
    for (const row of res.body.data.topServices) {
      assert.equal(typeof row.revenue, 'number');
    }
  });
});

/* Smoke controller: moi endpoint doc cua Admin + flow cham cong/nghi dot
   xuat phai tra 200/201, khong 500 kieu overview cu (sai alias SQL). */
describe('Smoke controller Admin va Staff', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });

  const hostGet = (name) => (String(name).toLowerCase() === 'host' ? 'localhost:3000' : null);
  const adminReq = (query = {}) => ({ query, protocol: 'http', get: hostGet });

  test('tat ca endpoint doc tra 200', async () => {
    const admin = await import('../src/controllers/admin.controller.js');
    const reqCtl = await import('../src/controllers/request.controller.js');
    const attCtl = await import('../src/controllers/attendance.controller.js');
    const payCtl = await import('../src/controllers/payroll.controller.js');
    const week = dayPlus(1).slice(0, 10);
    const weekEnd = dayPlus(3).slice(0, 10);

    const calls = [
      [admin.getOverview, adminReq({ range: '7' })],
      [admin.listServices, adminReq()],
      [admin.listStaff, adminReq()],
      [admin.listCustomers, adminReq()],
      [admin.listSchedule, adminReq({ from: week, to: weekEnd })],
      [admin.listReviews, adminReq()],
      [admin.listPayments, adminReq()],
      [admin.getReports, adminReq()],
      [reqCtl.listLeaveRequests, adminReq()],
      [reqCtl.listScheduleRequests, adminReq()],
      [attCtl.listAttendanceAdmin, adminReq({ from: week, to: weekEnd })],
      [payCtl.listPayrolls, adminReq()],
      [payCtl.previewPayroll, adminReq({ staffId: '9001', month: '2020-01' })],
      [payCtl.suggestDeduction, adminReq({ staffId: '9001', month: '2020-01' })],
    ];
    for (const [fn, req] of calls) {
      const res = mockRes();
      await fn(req, res, strictNext);
      assert.equal(res.statusCode, 200, 'endpoint ' + fn.name + ' phai 200, nhan ' + res.statusCode);
    }
  });

  test('vong doi payroll DRAFT -> CONFIRMED -> PAID khoa so', async () => {
    const payCtl = await import('../src/controllers/payroll.controller.js');
    const adminUser = { userId: 9004 };
    const base = { staffId: 9001, month: '2020-03', bonus: 100000, deduction: 20000 };

    const draft = mockRes();
    await payCtl.upsertDraft({ body: base, user: adminUser }, draft, strictNext);
    assert.equal(draft.statusCode, 201);
    const pid = draft.body.data.id;
    assert.equal(draft.body.data.totalSalary, 100000 - 20000);

    const bad = mockRes();
    await payCtl.payPayroll({ params: { id: pid }, body: {}, user: adminUser }, bad, strictNext);
    assert.equal(bad.statusCode, 409);

    const confirmed = mockRes();
    await payCtl.confirmPayroll({ params: { id: pid }, body: {}, user: adminUser }, confirmed, strictNext);
    assert.equal(confirmed.statusCode, 200);

    const paid = mockRes();
    await payCtl.payPayroll(
      { params: { id: pid }, body: { paymentMethod: 'cash' }, user: adminUser }, paid, strictNext);
    assert.equal(paid.statusCode, 200);

    const locked = mockRes();
    await payCtl.upsertDraft({ body: base, user: adminUser }, locked, strictNext);
    assert.equal(locked.statusCode, 409);

    const detail = mockRes();
    await payCtl.getPayroll({ params: { id: pid } }, detail, strictNext);
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.body.data.status, 'PAID');

    const connection = await connect();
    try {
      await connection.query('DELETE FROM payroll WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });

  test('cham cong check-in 2 lan thi 409, checkout xong moi het', async () => {
    const attCtl = await import('../src/controllers/attendance.controller.js');
    const user = { staffId: 9001, userId: 9002 };
    const in1 = mockRes();
    await attCtl.checkIn({ user }, in1, strictNext);
    assert.equal(in1.statusCode, 201);
    const in2 = mockRes();
    await attCtl.checkIn({ user }, in2, strictNext);
    assert.equal(in2.statusCode, 409);
    const out = mockRes();
    await attCtl.checkOut({ user }, out, strictNext);
    assert.equal(out.statusCode, 200);

    const connection = await connect();
    try {
      await connection.query(
        'DELETE FROM staff_attendance WHERE staff_id = 9001 AND work_date = CURDATE()');
    } finally {
      await connection.end();
    }
  });

  test('nghi dot xuat tu duyet va chan booking moi ngay', async () => {
    const reqCtl = await import('../src/controllers/request.controller.js');
    const { checkStaffAvailable } = await import('../src/lib/staff-availability.js');
    const now = new Date();
    const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0')
      + ':' + String(d.getMinutes()).padStart(2, '0');
    const start = new Date(now.getTime() + 60 * 60000);
    const end = new Date(now.getTime() + 3 * 60 * 60000);
    const user = { staffId: 9001, userId: 9002, name: 'Nhan vien Test' };

    const created = mockRes();
    await reqCtl.createLeaveRequest(
      { body: { startDatetime: fmt(start), endDatetime: fmt(end), reason: 'Sot', leave_type: 'EMERGENCY' }, user },
      created, strictNext);
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.data.status, 'APPROVED');

    const blocked = await checkStaffAvailable({
      staffId: 9001, serviceId: 1,
      startsAt: fmt(start), endsAt: fmt(end),
    });
    assert.equal(blocked.ok, false);

    const connection = await connect();
    try {
      await connection.query('DELETE FROM staff_leave_request WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });
});

/* Bao cao theo ky: doanh thu = COMPLETED + PAID, tien thu theo ngay tra. */
describe('Bao cao theo ky', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });

  async function makePaidBooking(connection, { day, from, to, status, payStatus, amount, payDate }) {
    const [b] = await connection.query(
      'INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, ?, \'MOBILE\')',
      [day + ' ' + from, day + ' ' + to, status]);
    await connection.query(
      'INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date) VALUES (?, ?, \'CASH\', ?, ?)',
      [b.insertId, amount, payStatus, payDate]);
    /* Tien thu doc tu so giao dich (nhu controller ghi), khong phai bang payment. */
    if (payStatus === 'PAID' || payStatus === 'DEPOSITED') {
      await connection.query(
        "INSERT INTO payment_transaction (booking_id, type, amount, payment_method, paid_at, created_by) VALUES (?, ?, ?, 'CASH', ?, NULL)",
        [b.insertId, payStatus === 'PAID' ? 'FINAL' : 'DEPOSIT', amount, payDate]);
    }
    return b.insertId;
  }

  test('doanh thu chi tinh COMPLETED+PAID, tien thu theo ngay tra', async () => {
    const connection = await connect();
    const ids = [];
    try {
      ids.push(await makePaidBooking(connection,
        { day: '2020-05-10', from: '09:00:00', to: '10:15:00', status: 'COMPLETED', payStatus: 'PAID', amount: 200000, payDate: '2020-05-10 10:30:00' }));
      ids.push(await makePaidBooking(connection,
        { day: '2020-05-11', from: '09:00:00', to: '10:15:00', status: 'CONFIRMED', payStatus: 'PAID', amount: 200000, payDate: '2020-05-11 09:30:00' }));
      ids.push(await makePaidBooking(connection,
        { day: '2020-05-12', from: '09:00:00', to: '10:15:00', status: 'CANCELLED', payStatus: 'DEPOSITED', amount: 50000, payDate: '2020-05-09 08:00:00' }));
      /* Khach tu huy -> cua hang giu coc. */
      await connection.query(
        "UPDATE booking SET cancelled_by = 'CUSTOMER', cancel_reason = 'Doi lich', cancelled_at = NOW() WHERE booking_id = ?",
        [ids[ids.length - 1]]);
      const [d] = await connection.query(
        "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, '2020-05-13 09:00:00', '2020-05-13 10:15:00', 'NO_SHOW', 'MOBILE')");
      ids.push(d.insertId);

      const { getReports } = await import('../src/controllers/admin.controller.js');
      const res = mockRes();
      await getReports({ query: { from: '2020-05-01', to: '2020-05-31' } }, res, strictNext);
      assert.equal(res.statusCode, 200);
      const r = res.body.data;
      assert.equal(r.from, '2020-05-01');
      assert.equal(r.summary.bookings, 4);
      assert.equal(r.summary.completed, 1);
      assert.equal(r.summary.serviceRevenue, 200000);
      assert.equal(r.summary.cashPaid, 400000);
      assert.equal(r.summary.cashDeposit, 50000);
      assert.equal(r.summary.forfeitedCount, 1);
      assert.equal(r.summary.forfeitedAmount, 50000);
      assert.equal(r.summary.completionRate, 33);
      assert.equal(r.byService[0].completed, 1);
      assert.equal(r.byService[0].revenue, 200000);
      assert.equal(r.byCustomer[0].completed, 1);
    } finally {
      for (const id of ids) {
        await connection.query('DELETE FROM payment WHERE booking_id = ?', [id]);
        await connection.query('DELETE FROM booking WHERE booking_id = ?', [id]);
      }
      await connection.end();
    }
  });

  test('khoang ngay sai thi 400', async () => {
    const { getReports } = await import('../src/controllers/admin.controller.js');
    const res = mockRes();
    await getReports({ query: { from: '2020-05-31', to: '2020-05-01' } }, res, strictNext);
    assert.equal(res.statusCode, 400);
  });
});

/* Tien coc, hoan coc, ban giao va chot luong. */
describe('Hoan coc va ban giao', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });

  const adminUser = { userId: 9004, name: 'Quan tri Test' };

  async function makeDepositBooking(connection, day) {
    const [b] = await connection.query(
      "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'CONFIRMED', 'MOBILE')",
      [day + ' 09:00:00', day + ' 10:15:00']);
    await connection.query(
      "INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date) VALUES (?, 60000, 'ONLINE', 'DEPOSITED', ?)",
      [b.insertId, day + ' 08:00:00']);
    await connection.query(
      "INSERT INTO payment_transaction (booking_id, type, amount, payment_method, paid_at, created_by) VALUES (?, 'DEPOSIT', 60000, 'ONLINE', ?, NULL)",
      [b.insertId, day + ' 08:00:00']);
    return b.insertId;
  }

  test('Admin huy lich da coc thi hoan coc, khong tinh coc giu lai', async () => {
    const { patchBooking } = await import('../src/controllers/booking-admin.controller.js');
    const connection = await connect();
    const day = dayPlus(9);
    let bookingId = null;
    try {
      bookingId = await makeDepositBooking(connection, day);
      const res = mockRes();
      await patchBooking(
        { params: { id: String(bookingId) }, body: { status: 'CANCELLED', cancelReason: 'Nhan vien om, khong co nguoi thay' }, user: adminUser },
        res, strictNext);
      assert.equal(res.statusCode, 200);

      const [[pay]] = await connection.query(
        'SELECT payment_status AS status FROM payment WHERE booking_id = ?', [bookingId]);
      assert.equal(pay.status, 'REFUNDED');
      const [[txn]] = await connection.query(
        "SELECT amount FROM payment_transaction WHERE booking_id = ? AND type = 'REFUND'", [bookingId]);
      assert.equal(Number(txn.amount), -60000);

      const { getReports } = await import('../src/controllers/admin.controller.js');
      const rep = mockRes();
      await getReports({ query: { from: day, to: day } }, rep, strictNext);
      assert.equal(rep.body.data.summary.forfeitedCount, 0);
    } finally {
      if (bookingId) {
        await connection.query('DELETE FROM payment_transaction WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM payment WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM booking_event WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
      }
      await connection.end();
    }
  });

  test('ban giao lich PROCESSING sang nhan vien khac duoc, doi gio thi khong', async () => {
    const { patchBooking } = await import('../src/controllers/booking-admin.controller.js');
    const connection = await connect();
    const day = dayPlus(10);
    let bookingId = null;
    try {
      await connection.query(
        'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (9002, 1)');
      await connection.query(
        "INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status) VALUES (9002, ?, '08:00:00', '18:00:00', 'AVAILABLE') ON DUPLICATE KEY UPDATE status = 'AVAILABLE'",
        [day]);
      const [b] = await connection.query(
        "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'PROCESSING', 'MOBILE')",
        [day + ' 09:00:00', day + ' 10:15:00']);
      bookingId = b.insertId;

      const noTime = mockRes();
      await patchBooking(
        { params: { id: String(bookingId) }, body: { staffId: 9002, time: '14:00' }, user: adminUser },
        noTime, strictNext);
      assert.equal(noTime.statusCode, 409);

      const ok = mockRes();
      await patchBooking(
        { params: { id: String(bookingId) }, body: { staffId: 9002 }, user: adminUser },
        ok, strictNext);
      assert.equal(ok.statusCode, 200);
      const [[row]] = await connection.query(
        'SELECT staff_id AS staffId FROM booking WHERE booking_id = ?', [bookingId]);
      assert.equal(Number(row.staffId), 9002);
    } finally {
      if (bookingId) {
        await connection.query('DELETE FROM booking_event WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
      }
      await connection.query('DELETE FROM staff_schedule WHERE staff_id = 9002');
      await connection.end();
    }
  });

  test('chot luong bi chan khi con lich hoan thanh chua thu', async () => {
    const payCtl = await import('../src/controllers/payroll.controller.js');
    const connection = await connect();
    let bookingId = null;
    try {
      const [b] = await connection.query(
        "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, '2020-06-10 09:00:00', '2020-06-10 10:15:00', 'COMPLETED', 'MOBILE')");
      bookingId = b.insertId;

      const draft = mockRes();
      await payCtl.upsertDraft(
        { body: { staffId: 9001, month: '2020-06', bonus: 0, deduction: 0 }, user: adminUser },
        draft, strictNext);
      assert.equal(draft.statusCode, 201);

      const blocked = mockRes();
      await payCtl.confirmPayroll(
        { params: { id: draft.body.data.id }, body: {}, user: adminUser }, blocked, strictNext);
      assert.equal(blocked.statusCode, 409);
    } finally {
      await connection.query('DELETE FROM payroll WHERE staff_id = 9001');
      if (bookingId) await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
      await connection.end();
    }
  });

  test('coc thang truoc tra not thang sau, tien thu dung thang', async () => {
    const { savePayment } = await import('../src/controllers/payment.controller.js');
    const { getReports } = await import('../src/controllers/admin.controller.js');
    const connection = await connect();
    let bookingId = null;
    try {
      bookingId = await makeDepositBooking(connection, '2020-09-10');
      await connection.query(
        "UPDATE booking SET status = 'COMPLETED' WHERE booking_id = ?", [bookingId]);

      const paid = mockRes();
      await savePayment(
        { params: { id: String(bookingId) }, body: { status: 'PAID', method: 'CASH' }, user: adminUser },
        paid, strictNext);
      assert.equal(paid.statusCode, 200);

      const sept = mockRes();
      await getReports({ query: { from: '2020-09-01', to: '2020-09-30' } }, sept, strictNext);
      assert.equal(sept.body.data.summary.cashDeposit, 60000);

      const [[txn]] = await connection.query(
        "SELECT amount FROM payment_transaction WHERE booking_id = ? AND type = 'FINAL'", [bookingId]);
      assert.equal(Number(txn.amount), 140000);
    } finally {
      if (bookingId) {
        await connection.query('DELETE FROM payment_transaction WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM payment WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM booking_event WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
      }
      await connection.end();
    }
  });
});

/* Chinh sach huy lich theo tien dang giu. */
describe('Huy lich va tien hoan', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });

  const adminUser = { userId: 9004, name: 'Quan tri Test' };

  async function makePaidBooking(connection, day) {
    const [b] = await connection.query(
      "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'CONFIRMED', 'MOBILE')",
      [day + ' 09:00:00', day + ' 10:15:00']);
    await connection.query(
      "INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date) VALUES (?, 200000, 'CASH', 'PAID', ?)",
      [b.insertId, day + ' 08:00:00']);
    await connection.query(
      "INSERT INTO payment_transaction (booking_id, type, amount, payment_method, paid_at, created_by) VALUES (?, 'DEPOSIT', 60000, 'ONLINE', ?, NULL), (?, 'FINAL', 140000, 'CASH', ?, NULL)",
      [b.insertId, day + ' 08:00:00', b.insertId, day + ' 08:30:00']);
    return b.insertId;
  }

  async function wipe(connection, bookingId) {
    await connection.query('DELETE FROM payment_transaction WHERE booking_id = ?', [bookingId]);
    await connection.query('DELETE FROM payment WHERE booking_id = ?', [bookingId]);
    await connection.query('DELETE FROM booking_event WHERE booking_id = ?', [bookingId]);
    await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
  }

  test('Admin huy lich PAID thi hoan toan bo', async () => {
    const { patchBooking } = await import('../src/controllers/booking-admin.controller.js');
    const connection = await connect();
    const day = dayPlus(11);
    let bookingId = null;
    try {
      bookingId = await makePaidBooking(connection, day);
      const res = mockRes();
      await patchBooking(
        { params: { id: String(bookingId) }, body: { status: 'CANCELLED', cancelReason: 'Shop dong cua dot xuat' }, user: adminUser },
        res, strictNext);
      assert.equal(res.statusCode, 200);
      const [[pay]] = await connection.query(
        'SELECT payment_status AS status FROM payment WHERE booking_id = ?', [bookingId]);
      assert.equal(pay.status, 'REFUNDED');
      const [[txn]] = await connection.query(
        "SELECT COALESCE(SUM(amount), 0) AS net FROM payment_transaction WHERE booking_id = ?", [bookingId]);
      assert.equal(Number(txn.net), 0);
    } finally {
      if (bookingId) await wipe(connection, bookingId);
      await connection.end();
    }
  });

  test('Khach huy lich PAID thi chi mat coc, hoan phan con lai', async () => {
    const { cancelBooking } = await import('../src/controllers/booking.controller.js');
    const connection = await connect();
    const day = dayPlus(12);
    let bookingId = null;
    try {
      bookingId = await makePaidBooking(connection, day);
      const res = mockRes();
      await cancelBooking(
        { params: { id: String(bookingId) }, body: { reason: 'Ban dot xuat' }, user: { customerId: 9001, name: 'Khach Test' } },
        res, strictNext);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.forfeited, 60000);
      assert.equal(res.body.data.refunded, 140000);
      const [[pay]] = await connection.query(
        'SELECT payment_status AS status, amount FROM payment WHERE booking_id = ?', [bookingId]);
      assert.equal(pay.status, 'DEPOSITED');
      assert.equal(Number(pay.amount), 60000);
    } finally {
      if (bookingId) await wipe(connection, bookingId);
      await connection.end();
    }
  });

  test('dich vu chi xuat hien qua add-on van co trong bao cao', async () => {
    const { getReports } = await import('../src/controllers/admin.controller.js');
    const connection = await connect();
    let bookingId = null;
    try {
      const [b] = await connection.query(
        "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, '2020-07-10 09:00:00', '2020-07-10 10:15:00', 'COMPLETED', 'MOBILE')");
      bookingId = b.insertId;
      await connection.query(
        'INSERT INTO booking_addon (booking_id, service_id, service_name, quantity, price) VALUES (?, 2, ?, 1, 100000)',
        [bookingId, 'Dich vu phu']);
      await connection.query(
        "INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date) VALUES (?, 300000, 'CASH', 'PAID', '2020-07-10 11:00:00')",
        [bookingId]);

      const res = mockRes();
      await getReports({ query: { from: '2020-07-01', to: '2020-07-31' } }, res, strictNext);
      assert.equal(res.statusCode, 200);
      const main = res.body.data.byService.find((x) => x.name === 'Son Gel Cao Cap');
      const addon = res.body.data.byService.find((x) => x.name === 'Dich vu phu');
      assert.ok(main, 'dich vu chinh phai co');
      assert.ok(addon, 'dich vu chi qua add-on phai co');
      assert.equal(main.revenue, 200000);
      assert.equal(addon.revenue, 100000);
      assert.equal(addon.addonBookings, 1);
    } finally {
      if (bookingId) {
        await connection.query('DELETE FROM booking_addon WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM payment WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
      }
      await connection.end();
    }
  });

  test('bieu do thang thanh toan doc theo ngay tien vao ket', async () => {
    const { listPayments } = await import('../src/controllers/admin.controller.js');
    const connection = await connect();
    let bookingId = null;
    try {
      const [b] = await connection.query(
        "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source) VALUES (9001, 9001, 1, 200000, 60, 15, '2020-08-10 09:00:00', '2020-08-10 10:15:00', 'COMPLETED', 'MOBILE')");
      bookingId = b.insertId;
      await connection.query(
        "INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date) VALUES (?, 200000, 'CASH', 'PAID', '2020-08-10 11:00:00')",
        [bookingId]);
      await connection.query(
        "INSERT INTO payment_transaction (booking_id, type, amount, payment_method, paid_at, created_by) VALUES (?, 'FINAL', 200000, 'CASH', '2020-08-10 11:00:00', NULL)",
        [bookingId]);

      const res = mockRes();
      await listPayments({ query: {} }, res, strictNext);
      assert.equal(res.statusCode, 200);
      const row = res.body.meta.months.find((m) => m.month === '2020-08');
      assert.ok(row, 'thang co giao dich phai xuat hien');
      assert.equal(Number(row.paidAmount), 200000);
    } finally {
      if (bookingId) {
        await connection.query('DELETE FROM payment_transaction WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM payment WHERE booking_id = ?', [bookingId]);
        await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
      }
      await connection.end();
    }
  });
});

/* Lich hen xem duoc ca ngay hom qua. */
describe('Scope lich hen qua khu', () => {
  before(async () => {
    await ensureReady();
    dbConfig._setPoolForTests(testPool);
  });

  test('scope yesterday tra dung lich hom qua', async () => {
    const { listBookings } = await import('../src/controllers/booking-admin.controller.js');
    const connection = await connect();
    const yd = (() => { const d = new Date(Date.now() - 86400000); return d.toISOString().slice(0, 10); })();
    const [b] = await connection.query(
      "INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration, buffer_time, start_time, end_time, status, source, note) VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'COMPLETED', 'MOBILE', '[TEST] hom qua')",
      [yd + ' 09:00:00', yd + ' 10:15:00']);
    const bookingId = b.insertId;
    try {
      const res = mockRes();
      await listBookings({ query: { scope: 'yesterday' } }, res, strictNext);
      assert.equal(res.statusCode, 200);
      assert.ok(res.body.data.some((r) => String(r.id) === String(bookingId)), 'phai thay lich hom qua');
    } finally {
      await connection.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
      await connection.end();
    }
  });
});
