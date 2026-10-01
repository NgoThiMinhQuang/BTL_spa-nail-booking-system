/* ===== Kiểm tra khả dụng của nhân viên cho một khung giờ =====

   Trang Quản lý lịch hẹn cần hỏi "nhân viên này còn nhận lịch được không?"
   trước khi xác nhận hay đổi người. Trả lời phải nêu rõ lý do bị từ chối
   để Admin không phải tự suy đoán:
     - không còn làm việc (users.status)
     - không thực hiện được dịch vụ này (staff_service)
     - không có ca trong ngày, hoặc ca đã OFF
     - giờ đặt nằm ngoài ca
     - trùng với lịch khác

   Cùng một bộ luật dùng lại cho cả POST /bookings và PATCH /bookings/:id
   nên không có chuyện một đường kiểm tra còn đường kia bỏ sót. */

import { pool } from '../config/database.js';
import { clockOf, dayOf } from './booking-labels.js';

/**
 * Trả về `{ ok: true, staffName }` nếu nhân viên nhận được lịch,
 * hoặc `{ ok: false, reason }` bằng tiếng Việt để hiện thẳng cho Admin.
 * `reason` luôn kèm số liệu cụ thể, không trả lời chung chung kiểu "không ổn".
 */
export async function checkStaffAvailable({
  bookingId = null, staffId, serviceId, startsAt, endsAt,
}) {
  const [[staff]] = await pool.query(
    `SELECT st.staff_id, u.full_name, u.status
       FROM staff st JOIN users u ON u.user_id = st.user_id
      WHERE st.staff_id = ? LIMIT 1`, [staffId]);

  if (!staff) return { ok: false, reason: 'Nhân viên không tồn tại trong hệ thống.' };
  if (staff.status !== 'ACTIVE') {
    return { ok: false, reason: `${staff.full_name} đã ngừng làm việc.` };
  }

  const [[canDo]] = await pool.query(
    `SELECT 1 AS ok FROM staff_service WHERE staff_id = ? AND service_id = ? LIMIT 1`,
    [staffId, serviceId]);
  if (!canDo) {
    return { ok: false, reason: `${staff.full_name} không thực hiện được dịch vụ này.` };
  }

  const day = dayOf(startsAt);
  const [[shift]] = await pool.query(
    `SELECT start_time AS startTime, end_time AS endTime, status
       FROM staff_schedule WHERE staff_id = ? AND work_date = ? LIMIT 1`,
    [staffId, day]);

  if (!shift) return { ok: false, reason: `${staff.full_name} không có ca làm ngày ${day}.` };
  if (shift.status === 'OFF') return { ok: false, reason: `${staff.full_name} đã nghỉ ngày ${day}.` };

  const from = clockOf(shift.startTime);
  const to = clockOf(shift.endTime);
  if (clockOf(startsAt) < from || clockOf(endsAt) > to) {
    return {
      ok: false,
      reason: `${staff.full_name} chỉ làm từ ${from} đến ${to} ngày ${day}.`,
    };
  }

  /* Trùng lịch: hai khoảng thời gian có phần chồng nhau. bookingId bị loại
     khỏi điều kiện để lịch đang xét không tự đụng độ với chính nó. */
  const [[clash]] = await pool.query(
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
      LIMIT 1`,
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

/** Các khung giờ còn trống của một nhân viên trong ngày, dùng cho hộp đổi lịch. */
export async function freeSlotsForStaff({ staffId, serviceId, day, stepMinutes = 30 }) {
  const [[shift]] = await pool.query(
    `SELECT start_time AS startTime, end_time AS endTime
       FROM staff_schedule
      WHERE staff_id = ? AND work_date = ? AND status = 'AVAILABLE' LIMIT 1`,
    [staffId, day]);
  if (!shift) return [];

  const [[svc]] = await pool.query(
    `SELECT duration, buffer_time AS bufferTime FROM services WHERE service_id = ? LIMIT 1`,
    [serviceId]);
  const need = (Number(svc?.duration ?? 0) + Number(svc?.bufferTime ?? 0)) * 60000;

  const [booked] = await pool.query(
    `SELECT start_time AS startTime, end_time AS endTime FROM booking
      WHERE staff_id = ? AND DATE(start_time) = ?
        AND status IN ('PENDING','CONFIRMED','PROCESSING')
      ORDER BY start_time`, [staffId, day]);

  const toMinutes = (value) => {
    const [h, m] = String(value).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  const toClock = (minutes) =>
    `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  const busy = booked.map((row) => ({
    from: new Date(row.startTime).getTime(),
    to: new Date(row.endTime).getTime(),
  }));

  const shiftStart = toMinutes(shift.startTime);
  const shiftEnd = toMinutes(shift.endTime);
  const slots = [];

  for (let minute = shiftStart; minute * 60000 + need <= shiftEnd * 60000; minute += stepMinutes) {
    const from = minute * 60000;
    const to = from + need;
    const overlaps = busy.some((slot) => from < slot.to && to > slot.from);
    if (!overlaps) slots.push(toClock(minute));
  }

  return slots;
}

/** Những người thỏa cả ba điều kiện: còn làm việc, làm được dịch vụ này,
    và có ca trong ngày. Đây là danh sách ứng viên cho lựa chọn "Bất kỳ
    nhân viên phù hợp" — cùng một bộ luật với `listAvailableStaff`. */
export async function eligibleStaffIds({ serviceId, day }) {
  const [rows] = await pool.query(
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
 * Chọn một nhân viên phù hợp cho khung giờ, dùng khi Admin không chỉ định
 * người ("Bất kỳ nhân viên phù hợp").
 *
 * Cố tình gọi lại `checkStaffAvailable` cho từng người thay vì viết một
 * cách xếp khác: nếu hai nơi có hai bộ luật riêng thì sớm muộn chúng lệch
 * nhau, và lịch sẽ bị cho vào chỗ tưởng còn trống rồi mới báo lỗi.
 *
 * Ưu tiên người ít lịch hơn trong ngày để lịch không dồn về một người.
 */
export async function pickStaffForSlot({ serviceId, startsAt, endsAt }) {
  const day = dayOf(startsAt);
  const ids = await eligibleStaffIds({ serviceId, day });
  if (!ids.length) return { ok: false, reason: 'Không có nhân viên nào làm được dịch vụ này trong ngày đã chọn.' };

  const [busy] = await pool.query(
    `SELECT staff_id, COUNT(*) AS n FROM booking
      WHERE DATE(start_time) = ? AND status IN ('PENDING','CONFIRMED','PROCESSING')
      GROUP BY staff_id`, [day]);
  const load = new Map(busy.map((row) => [row.staff_id, Number(row.n)]));

  const ranked = [...ids].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0) || a - b);
  for (const id of ranked) {
    const check = await checkStaffAvailable({ staffId: id, serviceId, startsAt, endsAt });
    if (check.ok) return { ...check, staffId: id };
  }
  return { ok: false, reason: 'Khung giờ này không còn nhân viên phù hợp nào nhận được.' };
}

/**
 * Khung giờ còn trống mà BẤT KỲ ứng viên nào cũng nhận được.
 *
 * Trả về hai danh sách: `slots` là các giờ còn ai đó nhận được, và `byStaff`
 * là ứng viên còn trống để backend tự chọn. Giao diện chỉ hiện `slots`;
 * người được chọn thật sự quyết định lúc tạo lịch, không phải lúc bấm chuột.
 */
export async function freeSlotsForAnyStaff({ serviceId, day, stepMinutes = 30 }) {
  const ids = await eligibleStaffIds({ serviceId, day });
  const perStaff = await Promise.all(ids.map(async (id) => ({
    id,
    slots: await freeSlotsForStaff({ staffId: id, serviceId, day, stepMinutes }),
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
