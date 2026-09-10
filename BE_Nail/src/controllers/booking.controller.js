import { pool } from '../config/database.js';

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING'];

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

function toMysqlDateTime(date, time) {
  return `${date} ${time}:00`;
}

function minutesToTime(totalMinutes) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

export async function getAvailableSlots(req, res, next) {
  try {
    const serviceId = Number(req.query.serviceId);
    const staffId = Number(req.query.staffId);
    const date = String(req.query.date ?? '');
    if (!Number.isInteger(serviceId) || !Number.isInteger(staffId) || !isDate(date)) {
      return res.status(400).json({ message: 'Dịch vụ, chuyên viên hoặc ngày không hợp lệ.' });
    }

    const [[serviceRows], [scheduleRows], [bookingRows]] = await Promise.all([
      pool.query(`SELECT s.duration, s.buffer_time AS bufferTime
        FROM services s JOIN staff_service ss ON ss.service_id=s.service_id
        WHERE s.service_id=? AND ss.staff_id=? AND s.status='ACTIVE' LIMIT 1`, [serviceId, staffId]),
      pool.query(`SELECT start_time AS startTime,end_time AS endTime FROM staff_schedule
        WHERE staff_id=? AND work_date=? AND status='AVAILABLE' ORDER BY start_time`, [staffId, date]),
      pool.query(`SELECT start_time AS startTime,end_time AS endTime FROM booking
        WHERE staff_id=? AND DATE(start_time)=? AND status IN (?) ORDER BY start_time`, [staffId, date, ACTIVE_STATUSES]),
    ]);

    if (!serviceRows[0]) return res.status(404).json({ message: 'Chuyên viên không thực hiện dịch vụ này.' });
    const occupiedMinutes = Number(serviceRows[0].duration) + Number(serviceRows[0].bufferTime ?? 0);
    const now = new Date();
    const slots = [];

    for (const schedule of scheduleRows) {
      const shiftStart = timeToMinutes(schedule.startTime);
      const shiftEnd = timeToMinutes(schedule.endTime);
      for (let start = shiftStart; start + occupiedMinutes <= shiftEnd; start += 30) {
        const time = minutesToTime(start);
        const startsAt = new Date(`${date}T${time}:00`);
        const end = start + occupiedMinutes;
        const overlaps = bookingRows.some((booking) => {
          const bookedStart = new Date(booking.startTime).getHours() * 60 + new Date(booking.startTime).getMinutes();
          const bookedEnd = new Date(booking.endTime).getHours() * 60 + new Date(booking.endTime).getMinutes();
          return start < bookedEnd && end > bookedStart;
        });
        if (startsAt > now && !overlaps) slots.push(time);
      }
    }
    res.json({ data: slots, meta: { duration: Number(serviceRows[0].duration), bufferTime: Number(serviceRows[0].bufferTime ?? 0) } });
  } catch (error) { next(error); }
}

export async function createBooking(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const customerId = Number(req.body.customerId ?? 1);
    const serviceId = Number(req.body.serviceId);
    const staffId = Number(req.body.staffId);
    const date = String(req.body.date ?? '');
    const time = String(req.body.time ?? '');
    const note = String(req.body.note ?? '').trim().slice(0, 1000) || null;
    if (![customerId, serviceId, staffId].every(Number.isInteger) || !isDate(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: 'Thông tin đặt lịch không hợp lệ.' });
    }

    await connection.beginTransaction();
    const [serviceRows] = await connection.query(`SELECT s.duration,s.buffer_time AS bufferTime
      FROM services s JOIN staff_service ss ON ss.service_id=s.service_id
      WHERE s.service_id=? AND ss.staff_id=? AND s.status='ACTIVE' LIMIT 1 FOR UPDATE`, [serviceId, staffId]);
    if (!serviceRows[0]) { await connection.rollback(); return res.status(409).json({ message: 'Chuyên viên không phù hợp với dịch vụ.' }); }

    const startsAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startsAt.getTime() + (Number(serviceRows[0].duration) + Number(serviceRows[0].bufferTime ?? 0)) * 60000);
    if (startsAt <= new Date()) { await connection.rollback(); return res.status(409).json({ message: 'Không thể đặt lịch trong quá khứ.' }); }

    const [scheduleRows] = await connection.query(`SELECT 1 FROM staff_schedule WHERE staff_id=? AND work_date=?
      AND status='AVAILABLE' AND start_time<=TIME(?) AND end_time>=TIME(?) LIMIT 1`, [staffId, date, startsAt, endAt]);
    if (!scheduleRows[0]) { await connection.rollback(); return res.status(409).json({ message: 'Khung giờ nằm ngoài ca làm của chuyên viên.' }); }

    const [conflicts] = await connection.query(`SELECT booking_id FROM booking WHERE staff_id=? AND status IN (?)
      AND start_time<? AND end_time>? LIMIT 1 FOR UPDATE`, [staffId, ACTIVE_STATUSES, endAt, startsAt]);
    if (conflicts[0]) { await connection.rollback(); return res.status(409).json({ message: 'Khung giờ vừa được người khác đặt. Vui lòng chọn giờ khác.' }); }

    const [result] = await connection.query(`INSERT INTO booking
      (customer_id,staff_id,service_id,start_time,end_time,status,note) VALUES (?,?,?,?,?,'PENDING',?)`,
      [customerId, staffId, serviceId, startsAt, endAt, note]);
    await connection.commit();
    res.status(201).json({ data: { id: String(result.insertId), customerId: String(customerId), serviceId: String(serviceId), staffId: String(staffId), startsAt: startsAt.toISOString(), endsAt: endAt.toISOString(), status: 'pending', note } });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
}
