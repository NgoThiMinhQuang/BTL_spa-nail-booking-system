/* ===== Test nghiệp vụ lịch hẹn =====

   Chạy bằng:  node --test tests/

   Bộ test này dựng một database riêng (nail_management_test), nạp
   Databasse.sql rồi chạy các migration, nên không đụng vào dữ liệu
   thật của dự án. Sau đó kiểm tra đúng những luật dễ sai nhất:

     - Máy trạng thái lịch hẹn (chuyển nào được, chuyển nào bị chặn)
     - Chống đặt trùng, tính cả khoảng nghỉ giữa hai lịch
     - Khung giờ còn trống (lỗi so sánh timestamp với phút)
     - Chụp giá: đổi giá dịch vụ không làm đổi lịch cũ
     - Máy trạng thái thanh toán
     - Doanh thu chỉ tính lịch đã thu tiền

   Mỗi test tự dựng lại dữ liệu cần thiết nên chạy độc lập, không phụ
   thuộc thứ tự. */

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
  actualServiceMinutes, createBooking as createBookingTx, momentOf,
} from '../src/lib/booking-service.js';
import { clockOfMinutes, minutesOfClock } from '../src/lib/staff-availability.js';
import * as dbConfig from '../src/config/database.js';
/* Controller test chạy trên database test nhờ _setPoolForTests (xem
   src/config/database.js): mọi test bên dưới gọi controller nhưng không
   chạm vào database thật. */
import { addAddon, removeAddon } from '../src/controllers/booking-admin.controller.js';
import { addCustomerImage } from '../src/controllers/booking.controller.js';
import { savePayment } from '../src/controllers/payment.controller.js';
import { approveScheduleRequest } from '../src/controllers/request.controller.js';
import { deleteService, setStaffStatus } from '../src/controllers/catalog.controller.js';

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

/**
 * Dựng database test một lần, các lần gọi sau dùng lại kết quả.
 *
 * Mọi test gọi `connect()` đều phải chờ việc dựng xong, nên không phụ thuộc
 * thứ tự mà trình chạy test thi hành hook — trước đây có test chạy trước khi
 * dữ liệu sẵn sàng và báo lỗi khoá ngoại rất khó hiểu.
 */
function ensureReady() {
  setupPromise ??= setup();
  return setupPromise;
}

/** Kết nối tới database test (tự chờ dựng xong nếu chưa). */
async function connect() {
  await ensureReady();
  const connection = await mysql.createConnection({ ...config, database: TEST_DB });
  const [[row]] = await connection.query('SELECT COUNT(*) AS n FROM staff');
  if (!row.n) {
    /* Phải đóng kết nối trước khi ném lỗi: kết nối còn mở thì node không
       bao giờ thoát, và toàn bộ output của lần chạy sẽ bị nuốt. */
    await connection.end();
    throw new Error(
      'Bảng staff trong database test bị trống dù đã seed. '
      + 'Có khả năng hai tiến trình test cùng chạy trên một database test.');
  }
  return connection;
}

async function setup() {
  /* 1. Tạo database test nếu chưa có.
     Dùng IF NOT EXISTS thay vì DROP/CREATE: xoá cả database phải chờ
     mọi kết nối khác đóng hết nên rất chậm và dễ treo khi còn ai đang
     mở database. Bên trong, Database.sql vẫn xoá và dựng lại từng bảng
     nên dữ liệu cũ trong đó không ảnh hưởng. */
  const admin = await mysql.createConnection(config);
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS ${TEST_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  /* 2. Nạp schema gốc rồi chạy các migration theo đúng thứ tự mà
      `npm run db:migrate` sẽ chạy.

      Database.sql cố ý ghi cứng tên database là nail_management để chạy
      tay không cần tham số. Ở đây thay bằng tên database test, đồng thời
      cắt bỏ phần đầu file (DROP/CREATE DATABASE và USE) để không bao
      giờ xoá nhầm database thật khi chạy npm test. */
  db = await mysql.createConnection({ ...config, database: TEST_DB });
  const raw = await fs.readFile(path.join(root, 'DB/Database.sql'), 'utf8');
  const start = raw.indexOf('DROP TABLE IF EXISTS');
  /* Cắt từ `DROP TABLE IF EXISTS` nên phải bật lại câu tắt kiểm tra khoá
     ngoại (nằm ở phần đầu file, đã bị cắt) — không có nó thì không xoá
     được bảng cha như `users` khi bảng con còn tham chiếu. */
  await db.query('SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n'
    + raw.slice(start).replaceAll('nail_management', TEST_DB));

  const dir = path.join(root, 'DB/migrations');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.query(await fs.readFile(path.join(dir, file), 'utf8'));
    /* Chặn lỗi rất dễ gặp: một file migration lỡ viết `USE <database>;` sẽ
       đổi database đang dùng giữa chừng, và mọi câu lệnh phía sau chạy vào
       database khác — thường là database THẬT. Lỗi này không báo gì,
       chỉ thấy dữ liệu test "tự biến mất". */
    const [[where]] = await db.query('SELECT DATABASE() AS name');
    if (where.name !== TEST_DB) {
      throw new Error(
        `Migration ${file} đã đổi sang database "${where.name}" `
        + `thay vì "${TEST_DB}". File đó nhiều khả năng có câu \`USE ...;\` `
        + 'cần bỏ đi.');
    }
  }

  /* 3. Dữ liệu tối thiểu cho test. */
  await seed(db);
  await db.end();

  return db;
}

before(ensureReady);

/* Giữ database test lại giữa các lần chạy. Lần sau Database.sql dựng lại
   toàn bộ bảng nên vẫn sạch, nhưng khỏi phải chờ DROP DATABASE — thao tác
   đó chậm và treo nếu còn kết nối nào chưa đóng. Muốn dọn thì chạy:
      DROP DATABASE nail_management_test;

   Đồng thời đóng luôn connection pool của src/config/database.js: pool
   giữ socket mở nên nếu không đóng, node sẽ không bao giờ thoát dù test
   đã chạy xong. */
after(async () => {
  const { pool } = await import('../src/config/database.js');
  await pool.end();
});

async function seed(connection) {
  const hash = await bcrypt.hash('Test@1234', 10);

  /* Dọn dữ liệu test cũ trước. Database.sql đã dựng lại bảng nên thường
     không còn gì, nhưng dọn ở đây cho phép chạy lại seed() an toàn. */
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['booking_event', 'booking_image', 'booking_addon', 'review_images',
    'review', 'payment', 'booking', 'staff_leave_request', 'staff_schedule_request',
    'staff_schedule', 'staff_service', 'staff', 'customer', 'users']) {
    await connection.query(`DELETE FROM ${table}`);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  /* Tài khoản: 1 khách, 2 nhân viên, 1 quản trị, 1 nhân viên đã khoá. */
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
     ON DUPLICATE vì Database.sql đã có sẵn 3 dịch vụ mẫu (mã 1..3) và
     dùng lại chúng cho gọn, không cần tạo mã riêng. */
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

  /* Kiểm tra ngay: nếu seed hỏng mà không báo, các test phía dưới sẽ hỏng
     theo kiểu khó hiểu (lỗi khoá ngoại ở test chứ không phải ở seed). */
  for (const table of ['users', 'staff', 'customer', 'staff_schedule']) {
    const [row] = await connection.query(`SELECT COUNT(*) AS n FROM ${table}`);
    if (!row[0].n) throw new Error(`seed(): bảng ${table} không có dữ liệu`);
  }
}

/* ================================================================
   1. MÁY TRẠNG THÁI LỊCH HẸN
   ================================================================ */

describe('Máy trạng thái lịch hẹn', () => {
  test('luồng chính đi đúng thứ tự', () => {
    assert.equal(canTransition('PENDING', 'CONFIRMED').ok, true);
    assert.equal(canTransition('CONFIRMED', 'PROCESSING').ok, true);
    assert.equal(canTransition('PROCESSING', 'COMPLETED').ok, true);
  });

  test('các nhánh phụ đúng nghiệp vụ', () => {
    assert.equal(canTransition('PENDING', 'CANCELLED').ok, true);
    assert.equal(canTransition('CONFIRMED', 'CANCELLED').ok, true);
    assert.equal(canTransition('CONFIRMED', 'NO_SHOW').ok, true);
  });

  test('các đường đi sai đều bị chặn', () => {
    /* Những đường này trước đây lọt lên vì mỗi controller tự liệt kê
       trạng thái riêng. */
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
      assert.equal(result.ok, false, `KHÔNG được phép ${from} → ${to}`);
      assert.ok(result.reason.length > 0, 'phải kèm lý do để hiện ra giao diện');
    }
  });

  test('trạng thái kết thúc không đi được đâu nữa', () => {
    for (const end of ['COMPLETED', 'CANCELLED', 'NO_SHOW']) {
      assert.deepEqual(ALLOWED_TRANSITIONS[end], []);
      for (const to of ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) {
        assert.equal(canTransition(end, to).ok, false, `${end} → ${to} phải bị chặn`);
      }
    }
  });

  test('không chuyển sang trạng thái không tồn tại', () => {
    assert.equal(canTransition('PENDING', 'FOO').ok, false);
    assert.equal(canTransition('PENDING', '').ok, false);
  });

  test('nhân viên chỉ được bắt đầu và hoàn thành', () => {
    assert.equal(canStaffTransition('CONFIRMED', 'PROCESSING').ok, true);
    assert.equal(canStaffTransition('PROCESSING', 'COMPLETED').ok, true);
    /* Xác nhận, hủy, đánh dấu không đến không phải việc của nhân viên. */
    assert.equal(canStaffTransition('PENDING', 'CONFIRMED').ok, false);
    assert.equal(canStaffTransition('CONFIRMED', 'CANCELLED').ok, false);
    assert.equal(canStaffTransition('CONFIRMED', 'NO_SHOW').ok, false);
  });

  test('nhân viên không bỏ qua bước bắt buộc', () => {
    assert.equal(canStaffTransition('PENDING', 'COMPLETED').ok, false);
    assert.equal(canStaffTransition('PENDING', 'PROCESSING').ok, false);
  });
});

/* ================================================================
   2. ĐỔI ĐƠN VỊ THỜI GIAN
   ---------------------------------------------------------------
   Đây là lỗi gốc của phần khung giờ còn trống: một vế là timestamp Unix
   (new Date(...).getTime()) còn vế kia là `minute * 60000` — lệch đơn
   vị nên phần kiểm tra trùng lịch cho kết quả tuỳ tiện.
   ================================================================ */

describe('Đổi đơn vị thời gian', () => {
  test('Date và chuỗi HH:mm cho cùng số phút', () => {
    assert.equal(minutesOfClock(new Date(2026, 0, 5, 9, 30)), 570);
    assert.equal(minutesOfClock('09:30:00'), 570);
    assert.equal(minutesOfClock('09:30'), 570);
  });

  test('giữa khoảng giờ qua nửa đêm vẫn đúng', () => {
    /* Ca đêm 22:00 – 02:00: '02:00' là 120 phút trong ngày, không phải
       24:00. Hàm chỉ dùng để so trong cùng một ngày nên nhất quán là đủ. */
    assert.equal(minutesOfClock('00:00'), 0);
    assert.equal(minutesOfClock('23:45'), 1425);
    assert.equal(clockOfMinutes(1425), '23:45');
    assert.equal(clockOfMinutes(570), '09:30');
  });

  test('vòng lặp qua lại không lệch', () => {
    for (let minute = 0; minute < 1440; minute += 7) {
      assert.equal(minutesOfClock(clockOfMinutes(minute)), minute);
    }
  });
});

/* ================================================================
   3. CHỐNG ĐẶT TRÙNG
   ================================================================ */

describe('Chống đặt trùng lịch', () => {
  /** Khoảng [from, to) có chồng [a, b) không — cùng công thức backend dùng. */
  const overlaps = (from, to, a, b) => from < b && to > a;

  test('lịch nằm trong lịch khác thì trùng', () => {
    /* A: 09:00–10:15  →  540–615
       B: 09:30–10:30  →  570–630
       B bắt đầu lúc 09:30, tức là A còn đang phục vụ → trùng. */
    assert.equal(overlaps(570, 630, 540, 615), true);
    /* B bắt đầu trước khi A kết thúc → trùng. */
    assert.equal(overlaps(600, 660, 540, 615), true);
  });

  test('khung giờ chạm đúng giờ kết thúc thì không trùng', () => {
    /* A: 09:00–10:15, trong đó 10:00–10:15 là khoảng nghỉ của nhân viên.
       B bắt đầu 10:00 → vẫn trùng, vì nhân viên còn bị chiếm tới 10:15. */
    assert.equal(overlaps(600, 660, 540, 615), true, '10:00 vẫn nằm trong khoảng bị chiếm');
    /* B bắt đầu đúng 10:15 → hợp lệ. */
    assert.equal(overlaps(615, 675, 540, 615), false, '10:15 là khung giờ hợp lệ đầu tiên');
  });

  test('hai khoảng liền nhau không trùng', () => {
    assert.equal(overlaps(615, 690, 540, 615), false);
  });

  test('lịch trùng hoàn toàn bị phát hiện', () => {
    assert.equal(overlaps(540, 615, 540, 615), true);
  });
});

/* ================================================================
   4. CHỤP GIÁ (SNAPSHOT)
   ================================================================ */

describe('Chụp giá và thời lượng', () => {
  test('đổi giá dịch vụ không làm đổi lịch cũ', async () => {
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

      /* Tạo lịch như lúc khách đặt: chụp giá 200.000 / 60 phút. */
      const [created] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 200000, 60, 15, ?, ?, 'PENDING', 'MOBILE')`,
        [`${day} 11:00:00`, `${day} 12:15:00`],
      );

      /* Admin đổi giá và thời lượng của dịch vụ. */
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

      assert.equal(Number(row.price), 200000, 'lịch cũ phải giữ giá lúc đặt');
      assert.equal(Number(row.duration), 60, 'lịch cũ phải giữ thời lượng lúc đặt');
      assert.equal(Number(row.bufferTime), 15);

      /* Lịch mới phải nhận giá mới. */
      const [fresh] = await connection.query(
        `INSERT INTO booking
           (customer_id, staff_id, service_id, service_price, service_duration, buffer_time,
            start_time, end_time, status, source)
         VALUES (9001, 9001, 1, 300000, 90, 20, ?, ?, 'PENDING', 'MOBILE')`,
        [`${day} 14:00:00`, `${day} 15:50:00`],
      );
      assert.ok(fresh.insertId > 0);

      /* Trả lại dịch vụ về giá cũ cho các test sau. */
      await connection.query(
        `UPDATE services SET price = 200000, duration = 60, buffer_time = 15 WHERE service_id = 1`);
      await connection.query('DELETE FROM booking WHERE booking_id IN (?, ?)',
        [created.insertId, fresh.insertId]);
    } finally {
      await connection.end();
    }
  });

  test('end_time = start + thời lượng + khoảng nghỉ', async () => {
    const connection = await connect();
    try {
      const [row] = await connection.query(
        `SELECT TIMESTAMPDIFF(MINUTE, start_time, end_time) AS span
           FROM booking WHERE booking_id = (SELECT MAX(booking_id) FROM booking)`);
      /* Nếu có lịch nào từ dữ liệu cũ thì span phải bằng duration + buffer. */
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
   5. MÁY TRẠNG THÁI THANH TOÁN
   ================================================================ */

describe('Máy trạng thái thanh toán', () => {
  test('các bước đi hợp lệ', () => {
    assert.equal(canPaymentTransition('UNPAID', 'DEPOSITED').ok, true);
    assert.equal(canPaymentTransition('UNPAID', 'PAID').ok, true);
    assert.equal(canPaymentTransition('DEPOSITED', 'PAID').ok, true);
  });

  test('PAID không quay lại được — không có nghiệp vụ hoàn tiền', () => {
    assert.equal(canPaymentTransition('PAID', 'UNPAID').ok, false);
    assert.equal(canPaymentTransition('PAID', 'DEPOSITED').ok, false);
    assert.deepEqual(PAYMENT_TRANSITIONS.PAID, []);
  });

  test('DEPOSITED không lùi về UNPAID', () => {
    assert.equal(canPaymentTransition('DEPOSITED', 'UNPAID').ok, false);
  });

  test('ghi đè cùng trạng thái được phép', () => {
    assert.equal(canPaymentTransition('DEPOSITED', 'DEPOSITED').ok, true);
  });
});

/* ================================================================
   6. TÍNH TIỀN CÓ SỐ LƯỢNG
   ---------------------------------------------------------------
   booking_addon có cột quantity. Cộng SUM(price) sẽ tính thiếu: 3 món
   cùng loại giá 40.000 là 120.000 chứ không phải 40.000.
   ================================================================ */

describe('Tính tiền dịch vụ phát sinh', () => {
  test('nhân với số lượng', () => {
    assert.equal(finalAmount({
      servicePrice: 200000,
      addons: [{ price: 40000, quantity: 3 }],
    }), 320000);
  });

  test('cộng nhiều món khác loại', () => {
    assert.equal(finalAmount({
      servicePrice: 200000,
      addons: [
        { price: 40000, quantity: 3 },
        { price: 90000, quantity: 1 },
      ],
    }), 410000);
  });

  test('không có món phát sinh thì bằng giá dịch vụ', () => {
    assert.equal(finalAmount({ servicePrice: 150000 }), 150000);
    assert.equal(finalAmount({ servicePrice: 150000, addons: [] }), 150000);
  });

  test('thiếu quantity thì coi như một', () => {
    assert.equal(finalAmount({
      servicePrice: 100000, addons: [{ price: 50000 }],
    }), 150000);
  });

  test('SUM(price * quantity) của database khớp với hàm JS', async () => {
    const connection = await connect();
    try {
      /* Tạo một lịch rồi thêm dịch vụ phát sinh có số lượng khác nhau,
         để so hai cách tính thật sự khác nhau chứ không chỉ bằng 0 = 0. */
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
      /* 3 × 40.000 + 2 × 50.000 = 220.000. Nếu dùng SUM(price) sẽ ra
         90.000 — đó chính là lỗi mà phần này chặn lại. */
      assert.equal(Number(sum.total), 220000);

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [id]);
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   7. DOANH THU CHỈ TÍNH LỊCH ĐÃ THU TIỀN
   ---------------------------------------------------------------
   COMPLETED + UNPAID phải ra doanh thu bằng 0. Trước đây các báo cáo
   lấy SUM(s.price) của mọi lịch COMPLETED nên lịch chưa thu tiền vẫn
   bị tính vào.
   ================================================================ */

describe('Doanh thu chỉ tính lịch đã thu tiền', () => {
  test('lịch hoàn thành nhưng chưa thu tiền không ra doanh thu', async () => {
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

      /* CHƯA có dòng thanh toán → không có doanh thu. */
      const [[before]] = await connection.query(
        `SELECT COALESCE(SUM(pay.amount), 0) AS revenue
           FROM booking b JOIN payment pay ON pay.booking_id = b.booking_id
          WHERE b.booking_id = ? AND pay.payment_status = 'PAID'`, [id]);
      assert.equal(Number(before.revenue), 0, 'COMPLETED + chưa có payment = 0');

      /* Thêm dòng UNPAID → vẫn bằng 0. */
      await connection.query(
        `INSERT INTO payment (booking_id, amount, payment_status) VALUES (?, 200000, 'UNPAID')`, [id]);
      const [[unpaid]] = await connection.query(
        `SELECT COALESCE(SUM(pay.amount), 0) AS revenue
           FROM booking b JOIN payment pay ON pay.booking_id = b.booking_id
          WHERE b.booking_id = ? AND pay.payment_status = 'PAID'`, [id]);
      assert.equal(Number(unpaid.revenue), 0, 'COMPLETED + UNPAID = 0');

      /* Chuyển sang PAID → mới có doanh thu. */
      await connection.query(`UPDATE payment SET payment_status = 'PAID' WHERE booking_id = ?`, [id]);
      const [[paid]] = await connection.query(
        `SELECT COALESCE(SUM(pay.amount), 0) AS revenue
           FROM booking b JOIN payment pay ON pay.booking_id = b.booking_id
          WHERE b.booking_id = ? AND pay.payment_status = 'PAID'`, [id]);
      assert.equal(Number(paid.revenue), 200000, 'COMPLETED + PAID mới tính doanh thu');

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [id]);
    } finally {
      await connection.end();
    }
  });

  test('tiền cọc không được tính vào doanh thu', async () => {
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
      assert.equal(Number(row.revenue), 0, 'tiền cọc không phải doanh thu');

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [booking.insertId]);
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   8. BẢO VỆ QUYỀN
   ================================================================ */

describe('Phân quyền', () => {
  test('tài khoản bị khoá không lấy được token hợp lệ', async () => {
    const { loadUserFromToken, signToken } = await import('../src/lib/auth.js');
    const connection = await connect();
    const [rows] = await connection.query(
      'SELECT user_id FROM users WHERE user_id = 9005');
    await connection.end();

    /* Token vẫn đúng chữ ký, nhưng tài khoản INACTIVE → loadUserFromToken
       phải trả null thay vì thả qua. */
    const token = signToken({ userId: rows[0].user_id, role: 'STAFF' });
    const user = await loadUserFromToken(token);
    assert.equal(user, null, 'tài khoản INACTIVE phải bị chặn');
  });

  test('token sai chữ ký bị từ chối', async () => {
    const { verifyToken } = await import('../src/lib/auth.js');
    assert.equal(verifyToken('abc.def.ghi'), null);
  });

  test('mỗi lịch chỉ có một đánh giá', async () => {
    const connection = await connect();
    try {
      const [dupe] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review'
            AND COLUMN_NAME = 'booking_id' AND NON_UNIQUE = 0`);
      assert.ok(dupe.length > 0, 'review.booking_id phải có ràng buộc UNIQUE');
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   9. BẢNG MỚI THEO NGHIỆP VỤ
   ================================================================ */

describe('Bảng nghiệp vụ', () => {
  const tables = [
    'staff_leave_request',
    'staff_schedule_request',
    'review_images',
  ];

  for (const table of tables) {
    test(`bảng ${table} tồn tại`, async () => {
      const connection = await connect();
      try {
        const [rows] = await connection.query(
          `SELECT COUNT(*) AS n FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = ?`, [table]);
        assert.equal(Number(rows[0].n), 1, `thiếu bảng ${table}`);
      } finally {
        await connection.end();
      }
    });
  }

  test('danh mục có trạng thái ACTIVE / INACTIVE', async () => {
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

  test('dịch vụ dùng chung một bộ tên trạng thái ACTIVE / INACTIVE', async () => {
    const connection = await connect();
    try {
      const [rows] = await connection.query(
        `SELECT COLUMN_TYPE FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'services'
            AND column_name = 'status'`);
      assert.match(rows[0].COLUMN_TYPE, /INACTIVE/);
      assert.doesNotMatch(rows[0].COLUMN_TYPE, /HIDDEN/,
        'HIDDEN là tên riêng của tầng staff, gây nhầm khi báo cáo');
    } finally {
      await connection.end();
    }
  });

  test('mật khẩu trong bảng users đều là hash', async () => {
    const connection = await connect();
    try {
      const [rows] = await connection.query(
        "SELECT password FROM users WHERE password NOT LIKE '$2%'");
      assert.equal(rows.length, 0, 'không được còn mật khẩu chưa mã hoá');
    } finally {
      await connection.end();
    }
  });

  test('yêu cầu nghỉ có người duyệt và mốc duyệt', async () => {
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
   10. LUẬT DUYỆT NGHỈ
   ================================================================ */

describe('Duyệt yêu cầu nghỉ', () => {
  test('có lịch trong khoảng nghỉ thì không được duyệt', async () => {
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

      /* Đếm lịch chồng lên khoảng nghỉ — đúng điều kiện chặn duyệt. */
      const [clash] = await connection.query(
        `SELECT COUNT(*) AS n FROM booking
          WHERE staff_id = 9001 AND status IN ('PENDING','CONFIRMED','PROCESSING')
            AND start_time < ? AND end_time > ?`,
        [`${day} 12:00:00`, `${day} 08:00:00`],
      );
      assert.equal(Number(clash[0].n), 1, 'phải phát hiện lịch cần xử lý trước');

      /* Sau khi dời lịch ra ngoài khoảng nghỉ thì duyệt được. */
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
      assert.equal(Number(clear[0].n), 0, 'dời lịch ra ngoài thì duyệt được');

      await connection.query('DELETE FROM booking WHERE booking_id = ?', [booking.insertId]);
    } finally {
      await connection.end();
    }
  });

  test('yêu cầu nghỉ đã duyệt làm nhân viên không nhận được lịch', async () => {
    const connection = await connect();
    try {
      const day = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
      await connection.query(
        `INSERT INTO staff_leave_request (staff_id, start_datetime, end_datetime, reason, status)
         VALUES (9001, ?, ?, 'Nghỉ việc gia đình', 'APPROVED')`,
        [`${day} 09:00:00`, `${day} 18:00:00`],
      );

      /* Cùng một điều kiện overlap mà checkStaffAvailable dùng. */
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS n FROM staff_leave_request
          WHERE staff_id = 9001 AND status = 'APPROVED'
            AND start_datetime < ? AND end_datetime > ?`,
        [`${day} 14:00:00`, `${day} 10:00:00`],
      );
      assert.ok(Number(rows[0].n) > 0, 'khung giờ trong khoảng nghỉ phải bị chặn');

      await connection.query('DELETE FROM staff_leave_request WHERE staff_id = 9001');
    } finally {
      await connection.end();
    }
  });
});

/* ================================================================
   BẢN VÁ BẢO VỆ DỮ LIỆU
   ---------------------------------------------------------------
   Các test bên dưới bao phủ đúng những lỗi từng lọt qua bộ test cũ:
   PAID trả thiếu, double-book nhánh "bất kỳ nhân viên", duyệt đổi ca
   khi còn lịch, Staff thêm add-on, ảnh mẫu của khách, xoá add-on sau
   PAID, thời gian phục vụ thực tế, khoá nhân viên còn lịch, xoá dịch
   vụ đang làm add-on, và biên hủy đúng 2 giờ.
   ================================================================ */

/** Response Express giả: chỉ cần status().json() và json(). */
function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

/** next(err) của Express: test nào cũng muốn lỗi hiện ra, không nuốt. */
function strictNext(err) {
  if (err) throw err;
}

const dayPlus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe('Bản vá bảo vệ dữ liệu', () => {
  let testPool = null;
  let realPool = null;

  before(async () => {
    await ensureReady();
    realPool = dbConfig.pool;
    testPool = mysql.createPool({
      ...config, database: TEST_DB, connectionLimit: 10,
      decimalNumbers: true, charset: 'utf8mb4',
    });
    dbConfig._setPoolForTests(testPool);
  });

  after(async () => {
    dbConfig._setPoolForTests(realPool);
    if (testPool) await testPool.end();
  });

  /* Nhân viên test cách ly: không đụng lịch của các test khác. */
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

  /* ---------------- PAID phải bằng đúng tổng ---------------- */

  test('PAID bỏ qua số tiền frontend gửi lên', () => {
    assert.deepEqual(resolvePaymentAmount('PAID', 1, 500000), { ok: true, amount: 500000 });
    assert.deepEqual(resolvePaymentAmount('PAID', 0, 500000), { ok: true, amount: 500000 });
    assert.deepEqual(resolvePaymentAmount('PAID', 999999, 500000), { ok: true, amount: 500000 });
    assert.deepEqual(resolvePaymentAmount('PAID', undefined, 500000), { ok: true, amount: 500000 });
  });

  test('UNPAID và DEPOSITED vẫn kiểm tra khoảng hợp lệ', () => {
    assert.deepEqual(resolvePaymentAmount('DEPOSITED', 100000, 500000), { ok: true, amount: 100000 });
    assert.equal(resolvePaymentAmount('DEPOSITED', 600000, 500000).ok, false);
    assert.equal(resolvePaymentAmount('UNPAID', -1, 500000).ok, false);
    assert.equal(resolvePaymentAmount('UNPAID', Number.NaN, 500000).ok, false);
    assert.equal(resolvePaymentAmount('UNPAID', 500001, 500000).ok, false);
  });

  test('savePayment PAID với amount = 1 vẫn ghi đủ tổng', async () => {
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

  /* ---------------- Khoá add-on sau PAID ---------------- */

  test('removeAddon bị chặn khi lịch đã PAID', async () => {
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

    /* Chưa PAID thì vẫn bỏ được (đường thành công không vỡ). */
    await testPool.query('DELETE FROM payment WHERE booking_id = ?', [bookingId]);
    const res2 = mockRes();
    await removeAddon(
      { params: { id: String(bookingId), addonId: String(addon.insertId) }, user: { role: 'ADMIN', name: 'Admin Test' } },
      res2, strictNext,
    );
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.removed, true);
  });

  /* ---------------- Duyệt đổi ca khi còn lịch ---------------- */

  test('approveScheduleRequest từ chối khi ca mới bỏ rơi lịch', async () => {
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

    /* Xử lý lịch xong thì duyệt được. */
    await testPool.query('DELETE FROM booking WHERE booking_id = ?', [bookingId]);
    const res2 = mockRes();
    await approveScheduleRequest(
      { params: { id: String(request.insertId) }, body: {}, user: { userId: 9004 } },
      res2, strictNext,
    );
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.data.status, 'APPROVED');
  });

  /* ---------------- Nhân viên thêm add-on ---------------- */

  test('staff thêm add-on lúc PROCESSING, bị chặn lúc CONFIRMED', async () => {
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

  test('staff không thêm được add-on vào lịch của người khác', async () => {
    const { sid, day } = await makeStaff(15, 3);
    const bookingId = await makeBooking({ staffId: sid, day, status: 'PROCESSING' });
    const res = mockRes();
    await addAddon(
      { params: { id: String(bookingId) }, body: { serviceId: 2, quantity: 1 }, user: { role: 'STAFF', staffId: 9001, name: 'NV Khac' } },
      res, strictNext,
    );
    assert.equal(res.statusCode, 403);
  });

  /* ---------------- Ảnh mẫu của khách ---------------- */

  test('khách gửi ảnh cho lịch của mình, không gửi được cho lịch người khác', async () => {
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

  /* ---------------- Khoá nhân viên còn lịch ---------------- */

  test('setStaffStatus INACTIVE bị chặn khi còn lịch tương lai', async () => {
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

  /* ---------------- Xoá dịch vụ đang làm add-on ---------------- */

  test('deleteService bị chặn khi dịch vụ nằm trong booking_addon', async () => {
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

  /* ---------------- Biên hủy đúng 2 giờ ---------------- */

  test('CONFIRMED đúng 2:00:00 không hủy được, trên 2 giờ mới được', () => {
    const now = Date.UTC(2026, 5, 1, 12, 0, 0);
    const at = (ms) => new Date(now + ms).toISOString();
    assert.equal(isCancelWindowOpen(at(3 * 3600000), now), true);
    assert.equal(isCancelWindowOpen(at(2 * 3600000 + 60000), now), true);
    assert.equal(isCancelWindowOpen(at(2 * 3600000), now), false);
    assert.equal(isCancelWindowOpen(at(2 * 3600000 - 60000), now), false);
    assert.equal(isCancelWindowOpen(at(-3600000), now), false);
  });

  /* ---------------- Double-book nhánh bất kỳ nhân viên ---------------- */

  test('hai khách cùng đặt một giờ thì một người nhận 409', async () => {
    /* Ngày ngoài 8 ngày seed (chỉ nhân viên cách ly có ca) để chắc chắn
       chỉ một người đủ điều kiện — nếu không request thua sẽ rơi sang
       nhân viên khác (đúng thiết kế) và test không còn kiểm tra được
       việc chen nhau. */
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

  /* ---------------- Thời gian phục vụ thực tế ---------------- */

  test('actualServiceMinutes tính từ mốc bắt đầu, thiếu mốc thì giữ dự kiến', async () => {
    const { sid, day } = await makeStaff(20, 3);
    const timedId = await makeBooking({ staffId: sid, day, status: 'COMPLETED' });
    await testPool.query(
      `INSERT INTO booking_event (booking_id, event_type, detail, actor_role, actor_name, created_at)
       VALUES (?, 'SERVICE_STARTED', 'Bat dau', 'STAFF', 'NV Guard 20', DATE_SUB(NOW(), INTERVAL 90 MINUTE))`,
      [timedId]);

    const connection = await testPool.getConnection();
    try {
      const actual = await actualServiceMinutes(connection, timedId, 60);
      assert.ok(Math.abs(actual - 90) <= 1, `phải ra ~90 phút, nhận ${actual}`);

      const plainId = await makeBooking({ staffId: sid, day, status: 'COMPLETED', from: '14:00:00', to: '15:15:00' });
      assert.equal(await actualServiceMinutes(connection, plainId, 60), 60);
    } finally {
      connection.release();
    }
  });
});
