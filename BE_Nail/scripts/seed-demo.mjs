/* Seed DU LIEU THU cho moi truong phat trien/demo.
 *
 * Khac cac migration cu (002/005 tu nhoi du lieu gia moi lan migrate):
 *  - Chi chay khi goi RIENG:  npm run db:seed-demo
 *  - Tai khoan dang nhap DUOC (mat khau 123456, bcrypt that).
 *  - Lich nao cung nhat quan thanh toan: COMPLETED kem PAID + giao dich
 *    FINAL, CONFIRMED tuong lai kem DEPOSITED hoac chua thu, huy/khong den
 *    giu coc DEPOSITED. Bao cao khong bao gio hien so vo ly.
 *  - Mọi lich demo danh dau note '[DEMO]' de db:demo-reset xoa chinh xac.
 *  - Chay lai nhieu lan an toan (bo qua cai da co).
 *
 * DB that cua cua hang: KHONG chay script nay.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'nail_management',
  multipleStatements: true,
});

const STAFF = [
  { phone: '0901000001', name: 'Nguyen Thi Lan', exp: 5, specialty: 'Chuyen vien Nail' },
  { phone: '0901000002', name: 'Tran Thu Ha', exp: 4, specialty: 'Chuyen vien Spa' },
  { phone: '0901000003', name: 'Le Thao Vy', exp: 2, specialty: 'Chuyen vien Nail' },
  { phone: '0901000004', name: 'Pham Minh Anh', exp: 3, specialty: 'Chuyen vien Goi dau' },
  { phone: '0901000005', name: 'Hoang Kim Ngan', exp: 2, specialty: 'Chuyen vien Spa' },
];

const CUSTOMERS = [
  ['Tran Thi Mai', '0910000001', 'mai.tran@gmail.com'],
  ['Nguyen Thu Ha', '0910000002', 'ha.nguyen@gmail.com'],
  ['Le Kim Chi', '0910000003', 'chi.le@gmail.com'],
  ['Pham Yen', '0910000004', 'yen.pham@gmail.com'],
  ['Hoang Minh', '0910000005', 'minh.hoang@gmail.com'],
  ['Tran Ngoc Anh', '0910000006', 'anh.tran@gmail.com'],
  ['Do Thao Vy', '0910000007', 'vy.do@gmail.com'],
  ['Nguyen Phuong Linh', '0910000008', 'linh.nguyen@gmail.com'],
  ['Vu Khanh Duy', '0910000009', 'duy.vu@gmail.com'],
  ['Bui Thu Ha', '0910000010', 'bha.bui@gmail.com'],
  ['Dang Thu Trang', '0910000011', 'trang.dang@gmail.com'],
  ['Le Hoang Long', '0910000012', 'long.le@gmail.com'],
  ['Huynh Mai Anh', '0910000013', 'maihanh.huynh@gmail.com'],
  ['Ta Quoc Bao', '0910000014', 'bao.ta@gmail.com'],
];

const hash = await bcrypt.hash('123456', 10);
const pad = (n) => String(n).padStart(2, '0');
const dayText = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* 1. Nhan vien: avatar de NULL (hien chu cai dau, trung thuc hon anh sai nguoi). */
const staffIds = [];
for (const s of STAFF) {
  await connection.query(
    `INSERT INTO users (full_name, phone, email, password, avatar, role, status)
     VALUES (?,?,?,?,NULL,'STAFF','ACTIVE')
     ON DUPLICATE KEY UPDATE password = VALUES(password), role = 'STAFF', status = 'ACTIVE'`,
    [s.name, s.phone, `${s.phone}@nailhouse.local`, hash],
  );
  const [[u]] = await connection.query('SELECT user_id FROM users WHERE phone = ?', [s.phone]);
  await connection.query(
    `INSERT INTO staff (user_id, experience_year, specialty, base_salary, commission_rate)
     VALUES (?, ?, ?, 7000000, 10)
     ON DUPLICATE KEY UPDATE experience_year = VALUES(experience_year),
       specialty = VALUES(specialty), base_salary = VALUES(base_salary),
       commission_rate = VALUES(commission_rate)`,
    [u.user_id, s.exp, s.specialty],
  );
  const [[st]] = await connection.query('SELECT staff_id FROM staff WHERE user_id = ?', [u.user_id]);
  staffIds.push(st.staff_id);
  await connection.query(
    `INSERT IGNORE INTO staff_service (staff_id, service_id)
     SELECT ?, service_id FROM services WHERE status = 'ACTIVE'`, [st.staff_id]);
  for (let d = 0; d < 14; d++) {
    await connection.query(
      `INSERT IGNORE INTO staff_schedule (staff_id, work_date, start_time, end_time, status)
       VALUES (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), '09:00:00', '18:00:00', 'AVAILABLE')`,
      [st.staff_id, d]);
  }
}
console.log(`Nhan vien demo: ${staffIds.length} (mat khau 123456).`);

/* 2. Khach hang. */
const customerIds = [];
for (const [name, phone, email] of CUSTOMERS) {
  await connection.query(
    `INSERT INTO users (full_name, phone, email, password, avatar, role, status)
     VALUES (?,?,?,?,NULL,'CUSTOMER','ACTIVE')
     ON DUPLICATE KEY UPDATE password = VALUES(password)`,
    [name, phone, email, hash],
  );
  const [[u]] = await connection.query('SELECT user_id FROM users WHERE phone = ?', [phone]);
  await connection.query('INSERT IGNORE INTO customer (user_id) VALUES (?)', [u.user_id]);
  const [[c]] = await connection.query('SELECT customer_id FROM customer WHERE user_id = ?', [u.user_id]);
  customerIds.push(c.customer_id);
}
console.log(`Khach hang demo: ${customerIds.length}.`);

/* 3. Dich vu dang ban (id + gia + thoi luong chup that tu bang services). */
const [services] = await connection.query(
  `SELECT service_id, price, duration, COALESCE(buffer_time, 0) AS buffer_time
     FROM services WHERE status = 'ACTIVE' ORDER BY service_id`);
if (!services.length) throw new Error('Chua co dich vu ACTIVE nao de seed lich.');

async function addBooking({ customerId, staffId, service, dayOffset, hour, minute, status, payStatus }) {
  const start = `${dayText(dayOffset)} ${pad(hour)}:${pad(minute)}:00`;
  const totalMin = Number(service.duration) + Number(service.buffer_time);
  const end = new Date(new Date(`${dayText(dayOffset)}T${pad(hour)}:${pad(minute)}:00`).getTime() + totalMin * 60000);
  const endText = `${dayText(dayOffset)} ${pad(end.getHours())}:${pad(end.getMinutes())}:00`;

  const [[exists]] = await connection.query(
    `SELECT booking_id FROM booking
      WHERE customer_id = ? AND staff_id = ? AND service_id = ? AND DATE(start_time) = ?
        AND note LIKE '[DEMO]%' LIMIT 1`,
    [customerId, staffId, service.service_id, dayText(dayOffset)]);
  if (exists) return exists.booking_id;

  const [b] = await connection.query(
    `INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration,
       buffer_time, start_time, end_time, status, source, note)
     VALUES (?,?,?,?,?,?,?,?,?, 'MOBILE', '[DEMO] Lich thu phuc vu demo')`,
    [customerId, staffId, service.service_id, service.price, service.duration,
      service.buffer_time, start, endText, status]);
  const bookingId = b.insertId;
  const total = Number(service.price);

  if (payStatus === 'PAID') {
    await connection.query(
      `INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
       VALUES (?,?, 'CASH', 'PAID', ?)`, [bookingId, total, endText]);
    await connection.query(
      `INSERT INTO payment_transaction (booking_id, type, amount, payment_method, paid_at, created_by)
       VALUES (?, 'FINAL', ?, 'CASH', ?, NULL)`, [bookingId, total, endText]);
  } else if (payStatus === 'DEPOSITED') {
    const deposit = Math.round(total * 0.3);
    await connection.query(
      `INSERT INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
       VALUES (?,?,'ONLINE','DEPOSITED', NOW())`, [bookingId, deposit]);
    await connection.query(
      `INSERT INTO payment_transaction (booking_id, type, amount, payment_method, paid_at, created_by)
       VALUES (?, 'DEPOSIT', ?, 'ONLINE', NOW(), NULL)`, [bookingId, deposit]);
  }
  return bookingId;
}

/* 4. Lich qua khu: hoan thanh kem thu du; 1 huy (giu coc) + 1 vang. */
const pastOffsets = [-2, -5, -9, -13, -18, -24];
let completedIds = [];
for (let i = 0; i < CUSTOMERS.length; i++) {
  const staffId = staffIds[i % staffIds.length];
  for (let k = 0; k < 3; k++) {
    const service = services[(i + k) % services.length];
    const id = await addBooking({
      customerId: customerIds[i], staffId, service,
      dayOffset: pastOffsets[(i + k) % pastOffsets.length],
      hour: 9 + ((i * 2 + k) % 8), minute: (i * 15 + k * 10) % 60,
      status: 'COMPLETED', payStatus: 'PAID',
    });
    completedIds.push(id);
  }
}
/* Lich huy cua khach 4 (giu coc) va vang cua khach 8. */
{
  const service = services[0];
  const cancelId = await addBooking({
    customerId: customerIds[3], staffId: staffIds[0], service,
    dayOffset: -6, hour: 14, minute: 0, status: 'CANCELLED', payStatus: 'DEPOSITED',
  });
  await connection.query(
    `UPDATE booking SET cancelled_by = 'CUSTOMER', cancel_reason = '[DEMO] Khach doi lich dot xuat',
       cancelled_at = NOW() WHERE booking_id = ?`, [cancelId]);
  await addBooking({
    customerId: customerIds[7], staffId: staffIds[1], service,
    dayOffset: -4, hour: 10, minute: 30, status: 'NO_SHOW', payStatus: 'DEPOSITED',
  });
}

/* 5. Lich tuong lai: CONFIRMED, mot nua coc online, mot nua chua thu. */
for (let i = 0; i < CUSTOMERS.length; i++) {
  const staffId = staffIds[(i + 2) % staffIds.length];
  const service = services[(i + 1) % services.length];
  await addBooking({
    customerId: customerIds[i], staffId, service,
    dayOffset: 1 + (i % 6), hour: 9 + (i % 8), minute: (i * 20) % 60,
    status: 'CONFIRMED', payStatus: i % 2 === 0 ? 'DEPOSITED' : 'UNPAID',
  });
}

/* 6. Vali danh gia that tu lich hoan thanh (it, diem 4-5). */
const comments = [
  'Lam can than, mau len dep dung y.',
  'Nhan vien tu van nhiet tinh, se quay lai.',
  'Hai long voi dich vu hom nay.',
];
let reviewCount = 0;
for (let i = 0; i < Math.min(8, completedIds.length); i += 2) {
  const bookingId = completedIds[i];
  const [[done]] = await connection.query('SELECT 1 FROM review WHERE booking_id = ? LIMIT 1', [bookingId]);
  if (done) continue;
  const [[b]] = await connection.query(
    'SELECT customer_id FROM booking WHERE booking_id = ?', [bookingId]);
  await connection.query(
    'INSERT INTO review (booking_id, customer_id, rating, comment) VALUES (?,?,?,?)',
    [bookingId, b.customer_id, i % 4 === 0 ? 4 : 5, '[DEMO] ' + comments[i % comments.length]]);
  reviewCount++;
}

console.log(`Lich demo: qua khu + tuong lai + huy/vang. Danh gia demo: ${reviewCount}.`);
console.log('Xong. Dang nhap demo (mat khau 123456): admin 0900000000, NV 0901000001-5, khach 0910000001-14.');
await connection.end();
