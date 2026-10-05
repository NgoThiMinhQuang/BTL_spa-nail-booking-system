/* ===== Kiểm tra khả dụng của nhân viên cho một khung giờ =====

   Đây là bộ luật trung tâm của hệ thống: mọi đường đặt lịch — khách đặt
   trên Mobile, quản trị tạo lịch khách vãng lai, quản trị đổi người hoặc
   đổi giờ — đều hỏi đúng hàm ở đây. Trước đây mỗi nơi tự viết một
   câu kiểm tra riêng nên có lúc quản trị cho phép cái mà Mobile chặn.

   Nhân viên nhận được lịch khi thỏa đồng thời:
     1. Tài khoản còn ACTIVE
     2. Được gán dịch vụ này (staff_service)
     3. Trong ngày đó có ca làm AVAILABLE và giờ nằm trong ca
     4. Không có yêu cầu nghỉ nào được duyệt chồng lên khung giờ
     5. Không trùng lịch khác, tính cả khoảng nghỉ giữa hai lịch

   Một điểm rất dễ sai: so sánh thời gian phải thống nhất một đơn vị. Ở đây
   mọi thứ được quy về **phút tính từ 00:00 của ngày xét** rồi mới so
   `start < busy.to && end > busy.from`. Trước đây một vế là timestamp
   Unix (new Date(...).getTime()) còn vế kia là `minute * 60000`, hai đại
   lượng khác nhau khiến phần kiểm tra trùng lịch trả về kết quả tùy tiện. */

import { pool } from '../config/database.js';
import { clockOf, dayOf } from './booking-labels.js';

/* ================================================================
   Đổi đơn vị thời gian
   ================================================================ */

/** 'HH:mm' hoặc Date → số phút kể từ 00:00 của ngày đó. */
export function minutesOfClock(value) {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
  const text = String(value ?? '');
  /* Cột TIME của staff_schedule trả về 'HH:mm:ss' hoặc Date do driver. */
  if (/^\d{2}:\d{2}/.test(text)) {
    const [hour, minute] = text.slice(0, 5).split(':').map(Number);
    return hour * 60 + minute;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getHours() * 60 + date.getMinutes();
}

/** Số phút → 'HH:mm'. */
export function clockOfMinutes(minutes) {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Khoảng [from, to) có chồng nhau với khoảng [a, b) không. */
const overlaps = (from, to, a, b) => from < b && to > a;

/** Ngày 'YYYY-MM-DD' của một mốc thời gian, theo giờ địa phương. */
const dayOfStart = (startsAt) => dayOf(startsAt);

/* ================================================================
   Yêu cầu nghỉ đã được duyệt
   ---------------------------------------------------------------
   staff_leave_request.status = 'APPROVED' là nguồn sự thật về ngày
   nghỉ. Trước đó hệ thống dùng staff_schedule.status = 'OFF' để đánh
   dấu nghỉ, thiếu hẳn khái niệm "yêu cầu nghỉ chờ duyệt" và không
   biết ai duyệt, duyệt lúc nào.
   ================================================================ */

/** Có yêu cầu nghỉ đã duyệt nào chồng lên khoảng thời gian này không? */
export async function approvedLeaveOverlaps({ staffId, startsAt, endsAt }) {
  const [rows] = await pool.query(
    `SELECT lr.leave_request_id AS id, lr.start_datetime AS startDatetime,
            lr.end_datetime AS endDatetime, lr.reason,
            COALESCE(u.full_name, 'Nhân viên') AS staffName
       FROM staff_leave_request lr
       LEFT JOIN staff st ON st.staff_id = lr.staff_id
       LEFT JOIN users u ON u.user_id = st.user_id
      WHERE lr.staff_id = ? AND lr.status = 'APPROVED'
        AND lr.start_datetime < ? AND lr.end_datetime > ?
      LIMIT 1`,
    [staffId, endsAt, startsAt],
  );
  return rows[0] ?? null;
}

/* ================================================================
   Khả dụng cho một khung giờ cụ thể
   ================================================================ */

/**
 * Trả về `{ ok: true, staffName }` nếu nhân viên nhận được lịch,
 * hoặc `{ ok: false, reason }` bằng tiếng Việt để hiện thẳng ra giao diện.
 * `reason` luôn kèm số liệu cụ thể, không trả lời chung chung kiểu "không ổn".
 *
 * `forUpdate` chỉ dùng trong giao dịch tạo/sửa lịch: câu kiểm tra trùng
 * đọc dưới dạng locking read để thấy lịch vừa được request khác commit.
 * Nếu không, ở isolation mặc định REPEATABLE READ thì SELECT thường chỉ
 * thấy snapshot lúc request bắt đầu — kiểm tra lại sau khi khoá cũng
 * mù như không kiểm tra.
 */
export async function checkStaffAvailable({
  bookingId = null, staffId, serviceId, startsAt, endsAt, runner = pool, forUpdate = false,
}) {
  const [[staff]] = await runner.query(
    `SELECT st.staff_id, u.full_name, u.status
       FROM staff st JOIN users u ON u.user_id = st.user_id
      WHERE st.staff_id = ? LIMIT 1`, [staffId]);

  if (!staff) return { ok: false, reason: 'Nhân viên không tồn tại trong hệ thống.' };
  if (staff.status !== 'ACTIVE') {
    return { ok: false, reason: `${staff.full_name} đã ngừng làm việc.` };
  }

  const [[canDo]] = await runner.query(
    `SELECT 1 AS ok FROM staff_service WHERE staff_id = ? AND service_id = ? LIMIT 1`,
    [staffId, serviceId]);
  if (!canDo) {
    return { ok: false, reason: `${staff.full_name} không thực hiện được dịch vụ này.` };
  }

  const day = dayOfStart(startsAt);
  const [[shift]] = await runner.query(
    `SELECT start_time AS startTime, end_time AS endTime, status
       FROM staff_schedule WHERE staff_id = ? AND work_date = ? LIMIT 1`,
    [staffId, day]);

  if (!shift) return { ok: false, reason: `${staff.full_name} không có ca làm ngày ${day}.` };
  if (shift.status === 'OFF') return { ok: false, reason: `${staff.full_name} đã nghỉ ngày ${day}.` };

  const from = minutesOfClock(shift.startTime);
  const to = minutesOfClock(shift.endTime);
  const startMinute = minutesOfClock(startsAt);
  const endMinute = minutesOfClock(endsAt);
  if (startMinute < from || endMinute > to) {
    return {
      ok: false,
      reason: `${staff.full_name} chỉ làm từ ${clockOfMinutes(from)} đến ${clockOfMinutes(to)} ngày ${day}.`,
    };
  }

  /* Nghỉ đã được duyệt: đây là lý do nghỉ cần bảng riêng thay vì chỉ ghi
     ca OFF — một ca OFF không cho biết ai xin nghỉ và Admin duyệt lúc nào. */
  const leave = await approvedLeaveOverlaps({ staffId, startsAt, endsAt });
  if (leave) {
    return {
      ok: false,
      reason: `${staff.full_name} đang được nghỉ `
        + `(${clockOf(leave.startDatetime)} ngày ${dayOfStart(leave.startDatetime)} `
        + `– ${clockOf(leave.endDatetime)} ngày ${dayOfStart(leave.endDatetime)}).`,
    };
  }

  /* Trùng lịch: hai khoảng thời gian có phần chồng nhau. bookingId bị loại
     khỏi điều kiện để lịch đang xét không tự đụng độ với chính nó. */
  const [[clash]] = await runner.query(
    `SELECT b.booking_id AS id, b.start_time AS startsAt, b.end_time AS endsAt,
            s.service_name AS serviceName,
            COALESCE(u.full_name, b.guest_name, 'khách vãng lai') AS customerName
       FROM booking b
       JOIN services s ON s.service_id = b.service_id
       /* LEFT JOIN: lịch khách vãng lai không có customer_id. Dùng JOIN
         thường thì lịch đó biến mất khỏi kết quả và ta cho hai khách
         trùng giờ — đúng thứ mà phần "chống đặt trùng" sinh ra để chặn. */
       LEFT JOIN customer c ON c.customer_id = b.customer_id
       LEFT JOIN users u ON u.user_id = c.user_id
      WHERE b.staff_id = ?
        AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
        AND b.start_time < ? AND b.end_time > ?
        AND (? IS NULL OR b.booking_id <> ?)
      LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [staffId, endsAt, startsAt, bookingId, bookingId]);

  if (clash) {
    return {
      ok: false,
      reason: `${staff.full_name} đã có lịch #${clash.id} `
        + `(${clockOf(clash.startsAt)}–${clockOf(clash.endsAt)}) `
        + `cho khách ${clash.customerName}.`,
      conflict: {
        id: String(clash.id),
        serviceName: clash.serviceName,
        customerName: clash.customerName,
        startsAt: clash.startsAt,
        endsAt: clash.endsAt,
      },
    };
  }

  return { ok: true, staffName: staff.full_name };
}

/** Các nhân viên có thể nhận lịch cho dịch vụ này, kèm lý do những người bị loại. */
export async function listAvailableStaff({ bookingId = null, serviceId, startsAt, endsAt }) {
  const [rows] = await pool.query(
    `SELECT st.staff_id AS id, u.full_name AS name, st.specialty, u.avatar AS avatarUrl,
            (SELECT ROUND(AVG(r.rating), 1) FROM review r
               JOIN booking b ON b.booking_id = r.booking_id
              WHERE b.staff_id = st.staff_id) AS realRating,
            (SELECT COUNT(*) FROM review r2
               JOIN booking b2 ON b2.booking_id = r2.booking_id
              WHERE b2.staff_id = st.staff_id) AS reviewCount
       FROM staff st
       JOIN users u ON u.user_id = st.user_id
       JOIN staff_service ss ON ss.staff_id = st.staff_id
      WHERE ss.service_id = ? AND u.status = 'ACTIVE'
      ORDER BY u.full_name`, [serviceId]);

  const available = [];
  const blocked = [];

  for (const row of rows) {
    const check = await checkStaffAvailable({
      bookingId, staffId: row.id, serviceId, startsAt, endsAt,
    });
    const item = {
      id: String(row.id),
      name: row.name,
      specialty: row.specialty,
      rating: row.realRating == null ? null : Number(row.realRating),
      reviewCount: Number(row.reviewCount),
      avatarUrl: row.avatarUrl,
    };
    if (check.ok) available.push(item);
    else blocked.push({ ...item, reason: check.reason, conflict: check.conflict ?? null });
  }

  return { available, blocked };
}

/* ================================================================
   Khung giờ còn trống
   ================================================================ */

/**
 * Các khung giờ còn trống của một nhân viên trong ngày.
 *
 * @param {number}  serviceId   dịch vụ cần đủ thời lượng + buffer
 * @param {number}  duration    thời lượng dịch vụ (phút). Lịch đang xét thì
 *                              lấy từ snapshot booking.service_duration
 *                              để đổi giờ một lịch cũ không bị kéo dài.
 * @param {number}  bufferTime  khoảng nghỉ sau dịch vụ (phút)
 * @param {number}  bookingId   lịch đang sửa, để không tự loại chính nó
 */
export async function freeSlotsForStaff({
  bookingId = null, staffId, serviceId, day, duration, bufferTime, stepMinutes = 30, runner = pool,
}) {
  const [[shift]] = await runner.query(
    `SELECT start_time AS startTime, end_time AS endTime
       FROM staff_schedule
      WHERE staff_id = ? AND work_date = ? AND status = 'AVAILABLE' LIMIT 1`,
    [staffId, day]);
  if (!shift) return [];

  /* Thời lượng lấy từ tham số; không truyền thì đọc từ dịch vụ. Đây là
     lý do một lịch cũ đã đặt trước khi dịch vụ đổi thời lượng vẫn giữ
     đúng độ dài tại thời điểm khách đặt. */
  let need = Number(duration);
  if (!Number.isFinite(need)) {
    const [[svc]] = await runner.query(
      `SELECT duration, buffer_time AS bufferTime FROM services WHERE service_id = ? LIMIT 1`,
      [serviceId]);
    if (!svc) return [];
    need = Number(svc.duration ?? 0) + Number(svc.bufferTime ?? 0);
  } else {
    need += Number(bufferTime ?? 0);
  }

  const [booked] = await runner.query(
    `SELECT start_time AS startTime, end_time AS endTime FROM booking
      WHERE staff_id = ? AND DATE(start_time) = ?
        AND status IN ('PENDING','CONFIRMED','PROCESSING')
        AND (? IS NULL OR booking_id <> ?)
      ORDER BY start_time`, [staffId, day, bookingId, bookingId]);

  /* Quy tất cả về phút trong ngày rồi mới so sánh — trước đây một vế là
     timestamp Unix còn vế kia là `minute * 60000`, lệch đơn vị nên phần
     kiểm tra trùng lịch cho kết quả không đáng tin. */
  const busy = booked.map((row) => ({
    from: minutesOfClock(row.startTime),
    to: minutesOfClock(row.endTime),
  }));

  /* Lịch đã được duyệt nghỉ trong ngày cũng chiếm chỗ, dù ca làm vẫn mở. */
  const [leaves] = await runner.query(
    `SELECT start_datetime AS startDatetime, end_datetime AS endDatetime
       FROM staff_leave_request
      WHERE staff_id = ? AND status = 'APPROVED'
        AND DATE(start_datetime) <= ? AND DATE(end_datetime) >= ?`,
    [staffId, day, day]);
  const away = leaves.map((row) => ({
    from: minutesOfClock(row.startDatetime),
    to: minutesOfClock(row.endDatetime),
  }));

  const shiftStart = minutesOfClock(shift.startTime);
  const shiftEnd = minutesOfClock(shift.endTime);
  const slots = [];

  for (let minute = shiftStart; minute + need <= shiftEnd; minute += stepMinutes) {
    if (!overlaps(minute, minute + need, shiftStart, shiftEnd)) continue;
    if (busy.some((slot) => overlaps(minute, minute + need, slot.from, slot.to))) continue;
    if (away.some((slot) => overlaps(minute, minute + need, slot.from, slot.to))) continue;
    slots.push(clockOfMinutes(minute));
  }

  return slots;
}

/** Những người thỏa ba điều kiện: còn làm việc, làm được dịch vụ này,
    và có ca trong ngày. Đây là danh sách ứng viên cho lựa chọn "Bất kỳ
    nhân viên phù hợp" — cùng một bộ luật với `listAvailableStaff`. */
export async function eligibleStaffIds({ serviceId, day, runner = pool }) {
  const [rows] = await runner.query(
    `SELECT st.staff_id AS id
       FROM staff st
       JOIN users u ON u.user_id = st.user_id
       JOIN staff_service ss ON ss.staff_id = st.staff_id AND ss.service_id = ?
       JOIN staff_schedule sc ON sc.staff_id = st.staff_id
                           AND sc.work_date = ? AND sc.status = 'AVAILABLE'
      WHERE u.status = 'ACTIVE'
      ORDER BY u.full_name`, [serviceId, day]);
  return rows.map((row) => row.id);
}

/**
 * Xếp ứng viên theo số lịch trong ngày (ít lịch lên trước).
 * Tách riêng để cả `pickStaffForSlot` (chỉ xem) và `claimStaffForSlot`
 * (chọn thật trong giao dịch) dùng chung một thứ tự.
 */
export async function rankedEligibleStaff({ serviceId, startsAt, runner = pool }) {
  const day = dayOfStart(startsAt);
  const ids = await eligibleStaffIds({ serviceId, day, runner });
  if (!ids.length) return [];

  const [busy] = await runner.query(
    `SELECT staff_id, COUNT(*) AS n FROM booking
      WHERE DATE(start_time) = ? AND status IN ('PENDING','CONFIRMED','PROCESSING')
      GROUP BY staff_id`, [day]);
  const load = new Map(busy.map((row) => [row.staff_id, Number(row.n)]));
  return [...ids].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0) || a - b);
}

/**
 * Chọn một nhân viên phù hợp cho khung giờ, dùng khi không chỉ định
 * người ("Bất kỳ nhân viên phù hợp").
 *
 * Cố tình gọi lại `checkStaffAvailable` cho từng người thay vì viết một
 * cách xếp khác: nếu hai nơi có hai bộ luật riêng thì sớm muộn chúng lệch
 * nhau, và lịch sẽ bị cho vào chỗ tưởng còn trống rồi mới báo lỗi.
 *
 * Ưu tiên người ít lịch hơn trong ngày để lịch không dồn về một người.
 */
export async function pickStaffForSlot({ serviceId, startsAt, endsAt, runner = pool }) {
  const ranked = await rankedEligibleStaff({ serviceId, startsAt, runner });
  if (!ranked.length) {
    return { ok: false, reason: 'Không có nhân viên nào làm được dịch vụ này trong ngày đã chọn.' };
  }

  for (const id of ranked) {
    const check = await checkStaffAvailable({
      staffId: id, serviceId, startsAt, endsAt, runner,
    });
    if (check.ok) return { ...check, staffId: id };
  }
  return { ok: false, reason: 'Khung giờ này không còn nhân viên phù hợp nào nhận được.' };
}

/**
 * Chọn NHÂN VIÊN THẬT trong giao dịch tạo lịch ("Bất kỳ nhân viên phù hợp").
 *
 * Khác `pickStaffForSlot` ở đúng một chỗ: sau khi thấy một người còn trống
 * thì KHOÁ nhân viên đó lại (xem lockStaffBookings) rồi HỎI LẠI khả dụng
 * trước khi nhận. Nếu không, hai khách cùng bấm một lúc sẽ cùng thấy một
 * người còn trống và cùng ghi lịch vào người đó — kiểm tra xong rồi mới
 * ghi thì khoá không còn tác dụng.
 *
 * Người vừa bị lấy mất thì bỏ qua, xét người tiếp theo. Hết ứng viên thì
 * trả 409 để khách chọn giờ khác.
 */
export async function claimStaffForSlot({ connection, serviceId, startsAt, endsAt }) {
  const ranked = await rankedEligibleStaff({ serviceId, startsAt, runner: connection });
  if (!ranked.length) {
    return { ok: false, reason: 'Không có nhân viên nào làm được dịch vụ này trong ngày đã chọn.' };
  }

  for (const id of ranked) {
    await lockStaffBookings({ connection, staffId: id, startsAt, endsAt });
    const check = await checkStaffAvailable({
      staffId: id, serviceId, startsAt, endsAt, runner: connection, forUpdate: true,
    });
    if (check.ok) return { ...check, staffId: id };
  }
  return { ok: false, reason: 'Khung giờ này vừa được đặt. Vui lòng chọn giờ khác.' };
}

/**
 * Khung giờ còn trống mà BẤT KỲ ứng viên nào cũng nhận được.
 *
 * Trả về hai danh sách: `slots` là các giờ còn ai đó nhận được, và `byStaff`
 * là ứng viên còn trống để backend tự chọn. Giao diện chỉ hiện `slots`;
 * người được chọn thật sự quyết định lúc tạo lịch, không phải lúc bấm chuột.
 */
export async function freeSlotsForAnyStaff({ serviceId, day, duration, bufferTime, stepMinutes = 30 }) {
  const ids = await eligibleStaffIds({ serviceId, day });
  const perStaff = await Promise.all(ids.map(async (id) => ({
    id,
    slots: await freeSlotsForStaff({ staffId: id, serviceId, day, duration, bufferTime, stepMinutes }),
  })));

  /* Giờ mà càng nhiều người nhận được thì càng chắc chắn còn nhận được. */
  const order = new Map();
  for (const person of perStaff) {
    for (const slot of person.slots) {
      if (!order.has(slot)) order.set(slot, []);
      order.get(slot).push(person.id);
    }
  }

  return {
    slots: [...order.keys()].sort(),
    byStaff: Object.fromEntries(
      perStaff.filter((person) => person.slots.length).map((person) => [person.id, person.slots]),
    ),
    staffCount: perStaff.filter((person) => person.slots.length).length,
  };
}

/**
 * Chống đặt trùng ở tầng database, dùng chung cho mọi đường tạo lịch.
 *
 * Khoá hai thứ theo đúng thứ tự này:
 *   1. Dòng nhân viên trong bảng staff — request thứ hai muốn đụng vào
 *      cùng người thì phải chờ, KỂ CẢ khi chưa có lịch trùng nào. Chỉ
 *      khoá dòng lịch trùng (SELECT ... FOR UPDATE trên tập rỗng) thì
 *      không chặn được INSERT mới — hai request cùng thấy trống rồi cùng
 *      ghi, đó chính là đường double-book của nhánh "bất kỳ nhân viên".
 *   2. Các dòng lịch trùng khung giờ của người đó.
 */
export async function lockStaffBookings({ connection, staffId, startsAt, endsAt }) {
  await connection.query('SELECT staff_id FROM staff WHERE staff_id = ? FOR UPDATE', [staffId]);
  await connection.query(
    `SELECT booking_id FROM booking
      WHERE staff_id = ? AND status IN ('PENDING','CONFIRMED','PROCESSING')
        AND start_time < ? AND end_time > ?
      LIMIT 1 FOR UPDATE`,
    [staffId, endsAt, startsAt]);
}