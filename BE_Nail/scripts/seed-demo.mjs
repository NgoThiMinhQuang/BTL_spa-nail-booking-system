/* Seed DU LIEU THU MINH HOA cho moi truong phat trien/demo.
 *
 * Chi chay khi goi RIENG:  npm run db:seed-demo
 *  - Ten tieng Viet co dau, SDT/email hop le, dia chi пользователя that o TPHCM.
 *  - Tai khoan dang nhap DUOC (mat khau 123456, bcrypt that).
 *  - Luong theo tham nien (co ban 6.5-8tr, hoa hong 8-12%).
 *  - Lich nao cung nhat quan thanh toan: COMPLETED kem PAID + giao dich
 *    FINAL, CONFIRMED tuong lai kem DEPOSITED hoac chua thu, huy/vang
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
  { phone: '0901000001', name: 'Nguyễn Thị Lan', exp: 5, specialty: 'Chuyên viên Nail', base: 8000000, rate: 12 },
  { phone: '0901000002', name: 'Trần Thu Hà', exp: 4, specialty: 'Chuyên viên Spa', base: 7500000, rate: 10 },
  { phone: '0901000003', name: 'Lê Thảo Vy', exp: 2, specialty: 'Chuyên viên Nail', base: 6500000, rate: 8 },
  { phone: '0901000004', name: 'Phạm Minh Anh', exp: 3, specialty: 'Chuyên viên Gội đầu', base: 7000000, rate: 10 },
  { phone: '0901000005', name: 'Hoàng Kim Ngân', exp: 2, specialty: 'Chuyên viên Spa', base: 6500000, rate: 8 },
];

const CUSTOMERS = [
  ['Trần Thị Mai', '0910000001', 'mai.tran@gmail.com', 'Quận 1, TP. Hồ Chí Minh', '1996-05-12', 'Thích tone hồng nhạt, thường đặt lịch cuối tuần.'],
  ['Nguyễn Thu Hà', '0910000002', 'ha.nguyen@gmail.com', 'Quận 7, TP. Hồ Chí Minh', '1994-11-03', 'Dị ứng mùi acetone mạnh, nhớ mở quạt khi làm.'],
  ['Lê Kim Chi', '0910000003', 'chi.le@gmail.com', 'TP. Thủ Đức, TP. Hồ Chí Minh', '1998-08-21', 'Ưu tiên nail art tối giản, màu trung tính.'],
  ['Phạm Yến', '0910000004', 'yen.pham@gmail.com', 'Quận 3, TP. Hồ Chí Minh', '1995-02-14', 'Hay đặt lịch gần trưa, cần làm nhanh.'],
  ['Hoàng Minh', '0910000005', 'minh.hoang@gmail.com', 'Bình Thạnh, TP. Hồ Chí Minh', '1993-07-30', 'Khách nam, thích màu trung tính.'],
  ['Trần Ngọc Anh', '0910000006', 'anh.tran@gmail.com', 'Quận 5, TP. Hồ Chí Minh', '1997-12-09', ''],
  ['Đỗ Thảo Vy', '0910000007', 'vy.do@gmail.com', 'Tân Bình, TP. Hồ Chí Minh', '1999-04-17', 'Sinh nhật 17/04, nhớ chúc mừng khi khách ghé.'],
  ['Nguyễn Phương Linh', '0910000008', 'linh.nguyen@gmail.com', 'Quận 2, TP. Hồ Chí Minh', '1992-09-25', 'Khách VIP, ưu tiên giữ khung giờ đẹp.'],
  ['Vũ Khánh Duy', '0910000009', 'duy.vu@gmail.com', 'Gò Vấp, TP. Hồ Chí Minh', '1996-01-08', ''],
  ['Bùi Thu Hà', '0910000010', 'bha.bui@gmail.com', 'Quận 8, TP. Hồ Chí Minh', '1994-06-11', 'Chỉ quan tâm dịch vụ chăm sóc móng.'],
  ['Đặng Thu Trang', '0910000011', 'trang.dang@gmail.com', 'Phú Nhuận, TP. Hồ Chí Minh', '1997-03-19', 'Hay đi cùng bạn, đặt lịch song song.'],
  ['Lê Hoàng Long', '0910000012', 'long.le@gmail.com', 'Quận 11, TP. Hồ Chí Minh', '1993-10-02', 'Móng yếu, cần dưỡng kỹ trước khi sơn.'],
  ['Huỳnh Mai Anh', '0910000013', 'maihanh.huynh@gmail.com', 'Bình Chánh, TP. Hồ Chí Minh', '1998-11-27', ''],
  ['Tạ Quốc Bảo', '0910000014', 'bao.ta@gmail.com', 'Củ Chi, TP. Hồ Chí Minh', '1995-08-05', 'Chỉ liên hệ qua Zalo.'],
];

const hash = await bcrypt.hash('123456', 10);
const pad = (n) => String(n).padStart(2, '0');
const dayText = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* 1. Nhan vien: avatar NULL (hien chu cai dau, trung thuc hon anh sai nguoi). */
const staffIds = [];
for (const s of STAFF) {
  await connection.query(
    `INSERT INTO users (full_name, phone, email, password, avatar, role, status)
     VALUES (?,?,?,?,NULL,'STAFF','ACTIVE')
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password = VALUES(password),
       role = 'STAFF', status = 'ACTIVE'`,
    [s.name, s.phone, `${s.phone}@nailhouse.local`, hash],
  );
  const [[u]] = await connection.query('SELECT user_id FROM users WHERE phone = ?', [s.phone]);
  await connection.query(
    `INSERT INTO staff (user_id, experience_year, specialty, base_salary, commission_rate)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE experience_year = VALUES(experience_year),
       specialty = VALUES(specialty), base_salary = VALUES(base_salary),
       commission_rate = VALUES(commission_rate)`,
    [u.user_id, s.exp, s.specialty, s.base, s.rate],
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

/* 2. Khach hang kem ho so. */
const customerIds = [];
for (const [name, phone, email, address, birthday, note] of CUSTOMERS) {
  await connection.query(
    `INSERT INTO users (full_name, phone, email, password, avatar, role, status)
     VALUES (?,?,?,?,NULL,'CUSTOMER','ACTIVE')
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password = VALUES(password)`,
    [name, phone, email, hash],
  );
  const [[u]] = await connection.query('SELECT user_id FROM users WHERE phone = ?', [phone]);
  await connection.query('INSERT IGNORE INTO customer (user_id) VALUES (?)', [u.user_id]);
  const [[c]] = await connection.query('SELECT customer_id FROM customer WHERE user_id = ?', [u.user_id]);
  await connection.query(
    'UPDATE customer SET address = ?, birthday = ?, note = ? WHERE customer_id = ?',
    [address, birthday, note || null, c.customer_id]);
  customerIds.push(c.customer_id);
}
console.log(`Khach hang demo: ${customerIds.length}.`);

/* 3. Dich vu dang ban (gia + thoi luong chup that tu bang services). */
const [services] = await connection.query(
  `SELECT service_id, service_name, price, duration, COALESCE(buffer_time, 0) AS buffer_time
     FROM services WHERE status = 'ACTIVE' ORDER BY service_id`);
if (!services.length) throw new Error('Chua co dich vu ACTIVE nao de seed lich.');
const extraService = services.length > 1 ? services[1] : services[0];

async function addBooking({ customerId, staffId, service, dayOffset, hour, minute, status, payStatus, withAddon }) {
  const date = dayText(dayOffset);
  const start = `${date} ${pad(hour)}:${pad(minute)}:00`;
  const totalMin = Number(service.duration) + Number(service.buffer_time);
  const end = new Date(new Date(`${date}T${pad(hour)}:${pad(minute)}:00`).getTime() + totalMin * 60000);
  const endText = `${date} ${pad(end.getHours())}:${pad(end.getMinutes())}:00`;

  const [[exists]] = await connection.query(
    `SELECT booking_id FROM booking
      WHERE customer_id = ? AND staff_id = ? AND service_id = ? AND DATE(start_time) = ?
        AND note LIKE '[DEMO]%' LIMIT 1`,
    [customerId, staffId, service.service_id, date]);
  if (exists) return exists.booking_id;

  const [b] = await connection.query(
    `INSERT INTO booking (customer_id, staff_id, service_id, service_price, service_duration,
       buffer_time, start_time, end_time, status, source, note)
     VALUES (?,?,?,?,?,?,?,?,?, 'MOBILE', '[DEMO] Lich thu phuc vu demo')`,
    [customerId, staffId, service.service_id, service.price, service.duration,
      service.buffer_time, start, endText, status]);
  const bookingId = b.insertId;
  let total = Number(service.price);

  if (withAddon) {
    await connection.query(
      `INSERT INTO booking_addon (booking_id, service_id, service_name, quantity, price, added_by_role)
       VALUES (?,?,?,?,?, 'STAFF')`,
      [bookingId, extraService.service_id, extraService.service_name, 1, extraService.price]);
    total += Number(extraService.price);
  }

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
const slots = [[9, 0], [10, 30], [13, 30], [15, 0], [16, 30], [11, 0]];
const completedIds = [];
for (let i = 0; i < CUSTOMERS.length; i++) {
  const staffId = staffIds[i % staffIds.length];
  for (let k = 0; k < 3; k++) {
    const service = services[(i + k) % services.length];
    const [hour, minute] = slots[(i + k) % slots.length];
    const id = await addBooking({
      customerId: customerIds[i], staffId, service,
      dayOffset: pastOffsets[(i + k) % pastOffsets.length],
      hour, minute, status: 'COMPLETED', payStatus: 'PAID',
      withAddon: (i + k) % 4 === 0,
    });
    completedIds.push(id);
  }
}
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
  const [hour, minute] = slots[(i + 3) % slots.length];
  await addBooking({
    customerId: customerIds[i], staffId, service,
    dayOffset: 1 + (i % 6), hour, minute,
    status: 'CONFIRMED', payStatus: i % 2 === 0 ? 'DEPOSITED' : 'UNPAID',
  });
}

/* 6. Vai danh gia that tu lich hoan thanh. */
const comments = [
  [5, 'Làm cẩn thận, màu lên đẹp đúng ý mình.'],
  [5, 'Nhân viên tư vấn nhiệt tình, chắc chắn quay lại.'],
  [4, 'Dịch vụ ổn, chờ hơi lâu một chút giờ cao điểm.'],
  [5, 'Móng bền, ba tuần rồi vẫn đẹp.'],
  [4, 'Hài lòng, lần sau sẽ thử thêm nail art.'],
];
let reviewCount = 0;
for (let i = 0; i < Math.min(10, completedIds.length); i += 2) {
  const bookingId = completedIds[i];
  const [[done]] = await connection.query('SELECT 1 FROM review WHERE booking_id = ? LIMIT 1', [bookingId]);
  if (done) continue;
  const [[bk]] = await connection.query(
    'SELECT customer_id FROM booking WHERE booking_id = ?', [bookingId]);
  const [rating, comment] = comments[(i / 2) % comments.length];
  await connection.query(
    'INSERT INTO review (booking_id, customer_id, rating, comment) VALUES (?,?,?,?)',
    [bookingId, bk.customer_id, rating, comment]);
  reviewCount++;
}

console.log(`Lich demo: qua khu + tuong lai + huy/vang. Danh gia demo: ${reviewCount}.`);
console.log('Xong. Dang nhap demo (mat khau 123456): admin 0900000000, NV 0901000001-5, khach 0910000001-14.');
await connection.end();
