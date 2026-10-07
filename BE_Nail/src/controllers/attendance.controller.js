/* ===== Chấm công thực tế (check-in / check-out) =====

   Ca làm (staff_schedule) là kế hoạch, chấm công là thực tế ai đến lúc nào.
   Một ngày một dòng (UNIQUE staff_id + work_date).

   Luật:
     - Chỉ check-in trong ngày có ca AVAILABLE.
     - Đang nghỉ đã duyệt (kể cả EMERGENCY) thì không check-in được.
     - Đã check-in thì không check-in lại; chưa check-in thì không check-out.
     - Đi muộn / về sớm tính lúc đọc (so với giờ ca), không lưu cứng để
       sau này đổi quy định giờ giấc không phải sửa dữ liệu cũ. */

import { pool } from '../config/database.js';
import { approvedLeaveOverlaps } from '../lib/staff-availability.js';

/* Giờ địa phương YYYY-MM-DD. */
function todayText(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toMysqlDatetime(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* 'HH:mm:ss' hoặc Date -> phút từ 00:00. */
function minutesOf(value) {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
  const m = /^(\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getHours() * 60 + d.getMinutes();
}

/* Ân hạn 10 phút: ca 09:00, đến 09:08 vẫn tính đúng giờ. */
const GRACE_MINUTES = 10;

function verdict(checkInAt, checkOutAt, shiftStart, shiftEnd) {
  if (!checkInAt) return { status: 'MISSING', lateMinutes: 0, earlyMinutes: 0, workMinutes: 0 };
  const late = Math.max(0, minutesOf(checkInAt) - minutesOf(shiftStart) - GRACE_MINUTES);
  let early = 0;
  let work = 0;
  if (checkOutAt) {
    early = Math.max(0, minutesOf(shiftEnd) - minutesOf(checkOutAt));
    work = Math.max(0, Math.round((new Date(checkOutAt) - new Date(checkInAt)) / 60000));
  }
  return {
    status: late > 0 ? 'LATE' : 'ON_TIME',
    lateMinutes: late,
    earlyMinutes: early,
    workMinutes: work,
  };
}

/* Nhân viên check-in cho chính mình, chỉ trong hôm nay. */
export async function checkIn(req, res, next) {
  try {
    const staffId = req.user.staffId;
    if (!staffId) return res.status(403).json({ message: 'Tài khoản này không gắn với hồ sơ nhân viên.' });
    const day = todayText();
    const now = new Date();

    const [[shift]] = await pool.query(
      `SELECT start_time AS startTime, end_time AS endTime, status
         FROM staff_schedule WHERE staff_id = ? AND work_date = ? LIMIT 1`,
      [staffId, day],
    );
    if (!shift || shift.status !== 'AVAILABLE') {
      return res.status(409).json({ message: 'Hôm nay bạn không có ca làm việc nên không chấm công được.' });
    }

    const leave = await approvedLeaveOverlaps({
      staffId,
      startsAt: toMysqlDatetime(now),
      endsAt: toMysqlDatetime(new Date(now.getTime() + 60000)),
    });
    if (leave) {
      return res.status(409).json({ message: 'Bạn đang trong kỳ nghỉ đã duyệt nên không chấm công được.' });
    }

    const [[existing]] = await pool.query(
      `SELECT attendance_id, check_in_at AS checkInAt FROM staff_attendance
        WHERE staff_id = ? AND work_date = ? LIMIT 1`,
      [staffId, day],
    );
    if (existing?.checkInAt) {
      return res.status(409).json({ message: 'Hôm nay bạn đã check-in rồi.' });
    }

    const stamp = toMysqlDatetime(now);
    if (existing) {
      await pool.query(
        `UPDATE staff_attendance SET check_in_at = ?, updated_at = NOW() WHERE attendance_id = ?`,
        [stamp, existing.attendance_id],
      );
    } else {
      await pool.query(
        `INSERT INTO staff_attendance (staff_id, work_date, check_in_at) VALUES (?,?,?)`,
        [staffId, day, stamp],
      );
    }

    const v = verdict(stamp, null, shift.startTime, shift.endTime);
    res.status(201).json({
      data: {
        workDate: day, checkInAt: stamp, checkOutAt: null,
        ...v,
        message: v.lateMinutes > 0 ? `Đã check-in lúc ${stamp.slice(11, 16)} (muộn ${v.lateMinutes} phút).` : 'Đã check-in.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/* Nhân viên check-out cho chính mình, chỉ trong hôm nay. */
export async function checkOut(req, res, next) {
  try {
    const staffId = req.user.staffId;
    if (!staffId) return res.status(403).json({ message: 'Tài khoản này không gắn với hồ sơ nhân viên.' });
    const day = todayText();
    const now = new Date();

    const [[row]] = await pool.query(
      `SELECT a.attendance_id AS id, a.check_in_at AS checkInAt, a.check_out_at AS checkOutAt,
              sc.start_time AS shiftStart, sc.end_time AS shiftEnd
         FROM staff_attendance a
         LEFT JOIN staff_schedule sc ON sc.staff_id = a.staff_id AND sc.work_date = a.work_date
        WHERE a.staff_id = ? AND a.work_date = ? LIMIT 1`,
      [staffId, day],
    );
    if (!row?.checkInAt) {
      return res.status(409).json({ message: 'Bạn chưa check-in hôm nay nên chưa check-out được.' });
    }
    if (row.checkOutAt) {
      return res.status(409).json({ message: 'Hôm nay bạn đã check-out rồi.' });
    }
    if (now < new Date(row.checkInAt)) {
      return res.status(400).json({ message: 'Giờ check-out không hợp lệ.' });
    }

    const stamp = toMysqlDatetime(now);
    await pool.query(
      `UPDATE staff_attendance SET check_out_at = ?, updated_at = NOW() WHERE attendance_id = ?`,
      [stamp, row.id],
    );
    const v = verdict(row.checkInAt, stamp, row.shiftStart ?? '09:00:00', row.shiftEnd ?? '18:00:00');
    res.json({
      data: {
        workDate: day, checkInAt: row.checkInAt, checkOutAt: stamp, ...v,
        message: `Đã check-out lúc ${stamp.slice(11, 16)}.`,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* Lịch sử chấm công của chính nhân viên. Mặc định 30 ngày gần nhất. */
export async function listMyAttendance(req, res, next) {
  try {
    const staffId = req.user.staffId;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to ?? '')) ? String(req.query.to) : todayText();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from ?? ''))
      ? String(req.query.from)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 29); return todayText(d); })();

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(a.work_date,'%Y-%m-%d') AS workDate,
              a.check_in_at AS checkInAt, a.check_out_at AS checkOutAt, a.note,
              TIME_FORMAT(sc.start_time,'%H:%i') AS shiftStart,
              TIME_FORMAT(sc.end_time,'%H:%i') AS shiftEnd,
              (SELECT 1 FROM staff_leave_request lr WHERE lr.staff_id = a.staff_id
                 AND lr.status = 'APPROVED' AND DATE(lr.start_datetime) <= a.work_date
                 AND DATE(lr.end_datetime) >= a.work_date LIMIT 1) AS onLeave
         FROM (SELECT DISTINCT work_date, staff_id FROM staff_schedule WHERE staff_id = ? AND work_date BETWEEN ? AND ?
               UNION
               SELECT work_date, staff_id FROM staff_attendance WHERE staff_id = ? AND work_date BETWEEN ? AND ?) d
         LEFT JOIN staff_attendance a ON a.staff_id = d.staff_id AND a.work_date = d.work_date
         LEFT JOIN staff_schedule sc ON sc.staff_id = d.staff_id AND sc.work_date = d.work_date
        ORDER BY d.work_date DESC LIMIT 62`,
      [staffId, from, to, staffId, from, to],
    );

    res.json({
      data: rows.map((r) => ({
        workDate: r.workDate,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        shiftStart: r.shiftStart,
        shiftEnd: r.shiftEnd,
        note: r.note,
        onLeave: Boolean(r.onLeave),
        ...verdict(r.checkInAt, r.checkOutAt, r.shiftStart ?? '09:00', r.shiftEnd ?? '18:00'),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* Admin xem chấm công toàn cửa hàng trong khoảng (tối đa 62 ngày). */
export async function listAttendanceAdmin(req, res, next) {
  try {
    const from = String(req.query.from ?? '').trim();
    const to = String(req.query.to ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: 'Khoảng ngày không hợp lệ.' });
    }
    const span = Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
    if (span < 0 || span > 62) {
      return res.status(400).json({ message: 'Khoảng ngày tối đa 62 ngày.' });
    }

    const [rows] = await pool.query(
      `SELECT st.staff_id AS staffId, u.full_name AS staffName,
              DATE_FORMAT(d.work_date,'%Y-%m-%d') AS workDate,
              a.check_in_at AS checkInAt, a.check_out_at AS checkOutAt,
              TIME_FORMAT(sc.start_time,'%H:%i') AS shiftStart,
              TIME_FORMAT(sc.end_time,'%H:%i') AS shiftEnd,
              (SELECT 1 FROM staff_leave_request lr WHERE lr.staff_id = st.staff_id
                 AND lr.status = 'APPROVED' AND DATE(lr.start_datetime) <= d.work_date
                 AND DATE(lr.end_datetime) >= d.work_date LIMIT 1) AS onLeave
         FROM staff st
         JOIN users u ON u.user_id = st.user_id
         JOIN (SELECT DISTINCT work_date FROM staff_schedule WHERE work_date BETWEEN ? AND ?
               UNION
               SELECT DISTINCT work_date FROM staff_attendance WHERE work_date BETWEEN ? AND ?) d
         LEFT JOIN staff_schedule sc ON sc.staff_id = st.staff_id AND sc.work_date = d.work_date
         LEFT JOIN staff_attendance a ON a.staff_id = st.staff_id AND a.work_date = d.work_date
        WHERE u.status = 'ACTIVE' AND (sc.schedule_id IS NOT NULL OR a.attendance_id IS NOT NULL)
        ORDER BY d.work_date DESC, u.full_name ASC LIMIT 2000`,
      [from, to, from, to],
    );

    res.json({
      data: rows.map((r) => ({
        ...r,
        staffId: String(r.staffId),
        onLeave: Boolean(r.onLeave),
        ...verdict(r.checkInAt, r.checkOutAt, r.shiftStart ?? '09:00', r.shiftEnd ?? '18:00'),
      })),
      meta: {
        late: rows.filter((r) => r.checkInAt && minutesOf(r.checkInAt) - minutesOf(r.shiftStart ?? '09:00') - GRACE_MINUTES > 0).length,
        missing: rows.filter((r) => !r.checkInAt && !r.onLeave).length,
      },
    });
  } catch (error) {
    next(error);
  }
}
