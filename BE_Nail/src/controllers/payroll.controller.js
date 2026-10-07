/* ===== Phiếu lương theo tháng =====

   Công thức duy nhất (backend tự tính, không cho sửa trực tiếp):
     total_salary = base_salary + commission_amount + bonus - deduction
     commission_amount = service_revenue * commission_rate / 100

   service_revenue chỉ cộng lịch COMPLETED có payment PAID trong tháng
   (DATE_FORMAT(start_time,'%Y-%m') = period). PENDING/CONFIRMED/PROCESSING/
   CANCELLED/NO_SHOW và DEPOSITED đều không tính — khách mới cọc chứ nhân
   viên chưa chắc đã làm xong. Đổi nhân viên trước khi COMPLETED thì hoa
   hồng thuộc người thực sự hoàn thành (booking.staff_id hiện tại).

   Trạng thái: DRAFT -> CONFIRMED -> PAID. PAID thì khóa mọi thay đổi để
   sửa giá dịch vụ sau này không làm đổi lịch sử lương. */

import { pool } from '../config/database.js';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

function readPeriod(value) {
  const text = String(value ?? '').trim();
  return PERIOD.test(text) ? text : null;
}

function readMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 1000000000) return null;
  return Math.round(n);
}

function readRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* Doanh thu + số lịch COMPLETED+PAID của một nhân viên trong tháng. */
async function staffRevenue(runner, staffId, period) {
  const [rows] = await runner.query(
    `SELECT b.booking_id AS bookingId, s.service_name AS serviceName,
            b.start_time AS startsAt, p.amount AS paidAmount
       FROM booking b
       JOIN services s ON s.service_id = b.service_id
       JOIN payment p ON p.booking_id = b.booking_id AND p.payment_status = 'PAID'
      WHERE b.staff_id = ? AND b.status = 'COMPLETED'
        AND DATE_FORMAT(b.start_time, '%Y-%m') = ?
      ORDER BY b.start_time`,
    [staffId, period],
  );
  const revenue = rows.reduce((sum, r) => sum + Number(r.paidAmount ?? 0), 0);
  return { rows, revenue, count: rows.length };
}

function totals({ base, rate, revenue, bonus, deduction }) {
  const commission = Math.round((revenue * rate) / 100);
  const total = Math.max(0, Math.round(base + commission + bonus - deduction));
  return { commission, total };
}

/* ================================================================
   GỢI Ý KHẤU TRỪ từ chấm công + nghỉ duyệt
   ----------------------------------------------------------------
   Chuẩn công tháng = 26 ngày × 8 giờ (quy ước phổ biến cho spa).
     perDay = base / 26 · perMinute = base / (26 × 8 × 60)
   Nghỉ NORMAL đã duyệt = nghỉ có lương: không trừ.
   Nghỉ EMERGENCY đã duyệt = nghỉ không lương: trừ đúng số phút nghỉ
     chồng lên ca làm. Vắng cả ngày không phép (có ca, không check-in,
     không nghỉ duyệt) = trừ 1 công. Đi muộn quá 10 phút ân hạn = trừ
     theo phút. Kết quả chỉ là GỢI Ý đưa vào ô deduction — Admin vẫn
     quyết định con số cuối khi tính phiếu.
   ================================================================ */

const STANDARD_DAYS = 26;
const GRACE_MINUTES = 10;

function clockMinutes(value) {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
  const m = /^(\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getHours() * 60 + d.getMinutes();
}

/* Tính gợi ý khấu trừ, dùng chung cho endpoint và test. */
export async function suggestDeductionFor(runner, staffId, period, baseSalary) {
  const base = Number(baseSalary ?? 0);
  const perMinute = base / (STANDARD_DAYS * 8 * 60);
  const perDay = base / STANDARD_DAYS;

  const [shifts] = await runner.query(
    `SELECT DATE_FORMAT(work_date,'%Y-%m-%d') AS workDate,
            TIME_FORMAT(start_time,'%H:%i') AS shiftStart,
            TIME_FORMAT(end_time,'%H:%i') AS shiftEnd
       FROM staff_schedule
      WHERE staff_id = ? AND DATE_FORMAT(work_date,'%Y-%m') = ?
        AND status = 'AVAILABLE'
      ORDER BY work_date`,
    [staffId, period],
  );
  const [checks] = await runner.query(
    `SELECT DATE_FORMAT(work_date,'%Y-%m-%d') AS workDate, check_in_at AS checkInAt
       FROM staff_attendance WHERE staff_id = ? AND DATE_FORMAT(work_date,'%Y-%m') = ?`,
    [staffId, period],
  );
  const [leaves] = await runner.query(
    `SELECT start_datetime AS startAt, end_datetime AS endAt, leave_type AS leaveType
       FROM staff_leave_request
      WHERE staff_id = ? AND status = 'APPROVED'
        AND DATE_FORMAT(start_datetime,'%Y-%m') <= ?
        AND DATE_FORMAT(end_datetime,'%Y-%m') >= ?`,
    [staffId, period, period],
  );

  const checkByDay = new Map(checks.map((c) => [c.workDate, c.checkInAt]));
  let lateMinutes = 0;
  let lateDays = 0;
  let absentDays = 0;
  let unpaidLeaveMinutes = 0;
  const details = [];

  for (const shift of shifts) {
    const shiftStart = new Date(`${shift.workDate}T${shift.shiftStart}:00`);
    const shiftEnd = new Date(`${shift.workDate}T${shift.shiftEnd}:00`);
    const shiftLen = Math.max(0, Math.round((shiftEnd - shiftStart) / 60000));

    /* Phút nghỉ chồng lên ca, tách theo loại. */
    let normalCovered = 0;
    let emergencyCovered = 0;
    for (const leave of leaves) {
      const from = new Date(leave.startAt);
      const to = new Date(leave.endAt);
      const overlap = Math.max(0, Math.round((Math.min(to, shiftEnd) - Math.max(from, shiftStart)) / 60000));
      if (overlap <= 0) continue;
      if ((leave.leaveType ?? 'NORMAL') === 'EMERGENCY') emergencyCovered += overlap;
      else normalCovered += overlap;
    }
    normalCovered = Math.min(normalCovered, shiftLen);
    emergencyCovered = Math.min(emergencyCovered, shiftLen - normalCovered);

    if (normalCovered >= shiftLen) {
      details.push({ workDate: shift.workDate, kind: 'PAID_LEAVE', minutes: shiftLen, amount: 0 });
      continue;
    }
    if (emergencyCovered > 0) {
      const amount = Math.round(emergencyCovered * perMinute);
      unpaidLeaveMinutes += emergencyCovered;
      details.push({ workDate: shift.workDate, kind: 'UNPAID_LEAVE', minutes: emergencyCovered, amount });
    }

    const checkIn = checkByDay.get(shift.workDate);
    if (!checkIn) {
      /* Vắng cả ngày không phép = 1 công; đã nghỉ đột xuất một phần thì
         phần còn lại tính pro-rata theo phút. */
      if (emergencyCovered > 0 || normalCovered > 0) {
        const rest = shiftLen - normalCovered - emergencyCovered;
        const amount = Math.round(rest * perMinute);
        if (rest > 0) details.push({ workDate: shift.workDate, kind: 'ABSENT', minutes: rest, amount });
      } else {
        const amount = Math.round(perDay);
        absentDays += 1;
        details.push({ workDate: shift.workDate, kind: 'ABSENT', minutes: shiftLen, amount });
      }
      continue;
    }
    if (emergencyCovered === 0 && normalCovered === 0) {
      const late = Math.max(0, clockMinutes(checkIn) - clockMinutes(shift.shiftStart) - GRACE_MINUTES);
      if (late > 0) {
        const amount = Math.round(late * perMinute);
        lateMinutes += late;
        lateDays += 1;
        details.push({ workDate: shift.workDate, kind: 'LATE', minutes: late, amount });
      } else {
        details.push({ workDate: shift.workDate, kind: 'ON_TIME', minutes: 0, amount: 0 });
      }
    }
  }

  const suggested = details.reduce((sum, d) => sum + d.amount, 0);
  return {
    baseSalary: Math.round(base),
    perMinuteRate: Math.round(perMinute * 100) / 100,
    perDayRate: Math.round(perDay),
    lateMinutes,
    lateDays,
    absentDays,
    unpaidLeaveMinutes,
    unpaidLeaveDays: Math.round((unpaidLeaveMinutes / (8 * 60)) * 100) / 100,
    suggestedDeduction: suggested,
    details,
  };
}

/* GET /api/admin/payrolls/suggest-deduction?staffId=&month= — chỉ gợi ý,
   không ghi gì vào phiếu. */
export async function suggestDeduction(req, res, next) {
  try {
    const staffId = Number(req.query.staffId);
    const period = readPeriod(req.query.month);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return res.status(400).json({ message: 'Mã nhân viên không hợp lệ.' });
    }
    if (!period) return res.status(400).json({ message: 'Tháng phải dạng YYYY-MM.' });

    const [[staff]] = await pool.query(
      `SELECT st.staff_id, u.full_name AS name, COALESCE(st.base_salary, 0) AS baseSalary
         FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE st.staff_id = ? LIMIT 1`,
      [staffId],
    );
    if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });

    const result = await suggestDeductionFor(pool, staffId, period, staff.baseSalary);
    res.json({
      data: {
        staffId: String(staffId), staffName: staff.name, periodMonth: period, ...result,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* Tính thử (không lưu) — để Admin xem trước khi chốt. */
export async function previewPayroll(req, res, next) {
  try {
    const staffId = Number(req.query.staffId);
    const period = readPeriod(req.query.month);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return res.status(400).json({ message: 'Mã nhân viên không hợp lệ.' });
    }
    if (!period) return res.status(400).json({ message: 'Tháng phải dạng YYYY-MM.' });
    if (period > currentPeriod()) {
      return res.status(400).json({ message: 'Không tính lương cho tháng trong tương lai.' });
    }

    const [[staff]] = await pool.query(
      `SELECT st.staff_id, u.full_name AS name,
              COALESCE(st.base_salary, 0) AS baseSalary,
              COALESCE(st.commission_rate, 0) AS commissionRate
         FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE st.staff_id = ? LIMIT 1`,
      [staffId],
    );
    if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });

    const base = Number(staff.baseSalary ?? 0);
    const rate = Number(staff.commissionRate ?? 0);
    const { revenue, count } = await staffRevenue(pool, staffId, period);
    const bonus = readMoney(req.query.bonus) ?? 0;
    const deduction = readMoney(req.query.deduction) ?? 0;
    const { commission, total } = totals({ base, rate, revenue, bonus, deduction });

    res.json({
      data: {
        staffId: String(staffId), staffName: staff.name, periodMonth: period,
        baseSalary: base, commissionRate: rate,
        serviceRevenue: Math.round(revenue), completedCount: count,
        commissionAmount: commission, bonus, deduction, totalSalary: total,
        status: 'DRAFT',
      },
    });
  } catch (error) {
    next(error);
  }
}

/* Tạo hoặc tính lại phiếu nháp (DRAFT). CONFIRMED/PAID không cho tính lại. */
export async function upsertDraft(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const staffId = Number(req.body?.staffId);
    const period = readPeriod(req.body?.month ?? req.body?.periodMonth);
    const bonus = readMoney(req.body?.bonus ?? 0);
    const deduction = readMoney(req.body?.deduction ?? 0);
    const note = String(req.body?.note ?? '').trim().slice(0, 500) || null;

    if (!Number.isInteger(staffId) || staffId <= 0) {
      return res.status(400).json({ message: 'Mã nhân viên không hợp lệ.' });
    }
    if (!period) return res.status(400).json({ message: 'Tháng phải dạng YYYY-MM.' });
    if (period > currentPeriod()) {
      return res.status(400).json({ message: 'Không tính lương cho tháng trong tương lai.' });
    }
    if (bonus === null) return res.status(400).json({ message: 'Thưởng không hợp lệ.' });
    if (deduction === null) return res.status(400).json({ message: 'Khấu trừ không hợp lệ.' });

    await connection.beginTransaction();
    const [[staff]] = await connection.query(
      `SELECT st.staff_id, COALESCE(st.base_salary, 0) AS baseSalary,
              COALESCE(st.commission_rate, 0) AS commissionRate
         FROM staff st WHERE st.staff_id = ? LIMIT 1 FOR UPDATE`,
      [staffId],
    );
    if (!staff) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });
    }

    const [[existing]] = await connection.query(
      `SELECT payroll_id, status FROM payroll WHERE staff_id = ? AND period_month = ? LIMIT 1 FOR UPDATE`,
      [staffId, period],
    );
    if (existing && existing.status !== 'DRAFT') {
      await connection.rollback();
      return res.status(409).json({
        message: `Phiếu lương tháng ${period} đã ${existing.status === 'PAID' ? 'trả (khóa sổ)' : 'chốt'} nên không tính lại được.`,
      });
    }

    const base = Number(staff.baseSalary ?? 0);
    const rate = Number(staff.commissionRate ?? 0);
    const { rows, revenue, count } = await staffRevenue(connection, staffId, period);
    const { commission, total } = totals({ base, rate, revenue, bonus: bonus ?? 0, deduction: deduction ?? 0 });

    let payrollId;
    if (existing) {
      await connection.query(
        `UPDATE payroll SET base_salary = ?, commission_rate = ?, service_revenue = ?,
                completed_count = ?, commission_amount = ?, bonus = ?, deduction = ?,
                total_salary = ?, note = ?, updated_at = NOW()
          WHERE payroll_id = ?`,
        [base, rate, Math.round(revenue), count, commission, bonus ?? 0, deduction ?? 0, total, note, existing.payroll_id],
      );
      payrollId = existing.payroll_id;
      await connection.query(`DELETE FROM payroll_item WHERE payroll_id = ?`, [payrollId]);
    } else {
      const [result] = await connection.query(
        `INSERT INTO payroll
            (staff_id, period_month, base_salary, commission_rate, service_revenue,
             completed_count, commission_amount, bonus, deduction, total_salary,
             status, note, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,'DRAFT',?,?)`,
        [staffId, period, base, rate, Math.round(revenue), count, commission,
          bonus ?? 0, deduction ?? 0, total, note, req.user.userId],
      );
      payrollId = result.insertId;
    }

    /* Chi tiết từng lịch để đối chiếu khi PAID vẫn còn chứng từ. */
    for (const row of rows) {
      const paid = Number(row.paidAmount ?? 0);
      const share = Math.round((paid * rate) / 100);
      await connection.query(
        `INSERT INTO payroll_item
            (payroll_id, booking_id, service_name, starts_at, paid_amount, commission_amount)
         VALUES (?,?,?,?,?,?)`,
        [payrollId, row.bookingId, row.serviceName, row.startsAt, Math.round(paid), share],
      );
    }

    await connection.commit();
    res.status(201).json({
      data: {
        id: String(payrollId), staffId: String(staffId), periodMonth: period,
        baseSalary: base, commissionRate: rate,
        serviceRevenue: Math.round(revenue), completedCount: count,
        commissionAmount: commission, bonus: bonus ?? 0, deduction: deduction ?? 0,
        totalSalary: total, status: 'DRAFT',
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* Danh sách phiếu lương (Admin). Lọc theo tháng / trạng thái. */
export async function listPayrolls(req, res, next) {
  try {
    const period = req.query.month ? readPeriod(req.query.month) : null;
    if (req.query.month && !period) {
      return res.status(400).json({ message: 'Tháng phải dạng YYYY-MM.' });
    }
    const status = ['DRAFT', 'CONFIRMED', 'PAID'].includes(String(req.query.status ?? '').toUpperCase())
      ? String(req.query.status).toUpperCase() : null;

    const where = [];
    const params = [];
    if (period) { where.push('p.period_month = ?'); params.push(period); }
    if (status) { where.push('p.status = ?'); params.push(status); }

    const [rows] = await pool.query(
      `SELECT p.payroll_id AS id, p.staff_id AS staffId, u.full_name AS staffName,
              p.period_month AS periodMonth,
              p.base_salary AS baseSalary, p.commission_rate AS commissionRate,
              p.service_revenue AS serviceRevenue, p.completed_count AS completedCount,
              p.commission_amount AS commissionAmount, p.bonus, p.deduction,
              p.total_salary AS totalSalary, p.status,
              p.paid_at AS paidAt, p.payment_method AS paymentMethod, p.note,
              cb.full_name AS createdByName, pb.full_name AS paidByName
         FROM payroll p
         JOIN staff st ON st.staff_id = p.staff_id
         JOIN users u ON u.user_id = st.user_id
         LEFT JOIN users cb ON cb.user_id = p.created_by
         LEFT JOIN users pb ON pb.user_id = p.paid_by
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.period_month DESC, u.full_name ASC LIMIT 500`,
      params,
    );

    res.json({
      data: rows.map((r) => ({
        ...r,
        id: String(r.id), staffId: String(r.staffId),
        baseSalary: Number(r.baseSalary), commissionRate: Number(r.commissionRate),
        serviceRevenue: Number(r.serviceRevenue), completedCount: Number(r.completedCount),
        commissionAmount: Number(r.commissionAmount), bonus: Number(r.bonus),
        deduction: Number(r.deduction), totalSalary: Number(r.totalSalary),
      })),
      meta: {
        count: rows.length,
        totalSalary: rows.reduce((s, r) => s + Number(r.totalSalary ?? 0), 0),
        paid: rows.filter((r) => r.status === 'PAID').length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* Chi tiết một phiếu + từng lịch tạo nên hoa hồng. */
export async function getPayroll(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã phiếu không hợp lệ.' });

    const [[row]] = await pool.query(
      `SELECT p.payroll_id AS id, p.staff_id AS staffId, u.full_name AS staffName,
              p.period_month AS periodMonth,
              p.base_salary AS baseSalary, p.commission_rate AS commissionRate,
              p.service_revenue AS serviceRevenue, p.completed_count AS completedCount,
              p.commission_amount AS commissionAmount, p.bonus, p.deduction,
              p.total_salary AS totalSalary, p.status,
              p.paid_at AS paidAt, p.payment_method AS paymentMethod, p.note
         FROM payroll p
         JOIN staff st ON st.staff_id = p.staff_id
         JOIN users u ON u.user_id = st.user_id
        WHERE p.payroll_id = ? LIMIT 1`,
      [id],
    );
    if (!row) return res.status(404).json({ message: 'Không tìm thấy phiếu lương.' });

    const [items] = await pool.query(
      `SELECT payroll_item_id AS id, booking_id AS bookingId, service_name AS serviceName,
              starts_at AS startsAt, paid_amount AS paidAmount, commission_amount AS commissionAmount
         FROM payroll_item WHERE payroll_id = ? ORDER BY starts_at`,
      [id],
    );

    res.json({
      data: {
        ...row,
        id: String(row.id), staffId: String(row.staffId),
        baseSalary: Number(row.baseSalary), commissionRate: Number(row.commissionRate),
        serviceRevenue: Number(row.serviceRevenue), completedCount: Number(row.completedCount),
        commissionAmount: Number(row.commissionAmount), bonus: Number(row.bonus),
        deduction: Number(row.deduction), totalSalary: Number(row.totalSalary),
        items: items.map((it) => ({
          ...it,
          id: String(it.id),
          bookingId: it.bookingId == null ? null : String(it.bookingId),
          paidAmount: Number(it.paidAmount), commissionAmount: Number(it.commissionAmount),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function moveStatus(id, userId, from, to, extra = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT payroll_id, status FROM payroll WHERE payroll_id = ? LIMIT 1 FOR UPDATE`, [id]);
    if (!row) {
      await connection.rollback();
      return { error: [404, 'Không tìm thấy phiếu lương.'] };
    }
    if (row.status !== from) {
      await connection.rollback();
      return { error: [409, `Phiếu này đang ở trạng thái ${row.status}, không chuyển được.`] };
    }
    const sets = [`status = '${to}'`];
    const params = [];
    if (to === 'PAID') {
      sets.push('paid_at = NOW()', 'paid_by = ?');
      params.push(userId);
      if (extra.paymentMethod !== undefined) {
        sets.push('payment_method = ?');
        params.push(extra.paymentMethod);
      }
    }
    if (to === 'CONFIRMED') {
      if (extra.note !== undefined) { sets.push('note = ?'); params.push(extra.note); }
    }
    params.push(id);
    await connection.query(`UPDATE payroll SET ${sets.join(', ')} WHERE payroll_id = ?`, params);
    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* DRAFT -> CONFIRMED: chốt số, chuẩn bị trả. */
export async function confirmPayroll(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã phiếu không hợp lệ.' });
    const note = req.body?.note !== undefined
      ? String(req.body.note ?? '').trim().slice(0, 500) || null : undefined;
    const result = await moveStatus(id, req.user.userId, 'DRAFT', 'CONFIRMED', { note });
    if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });
    res.json({ data: { id: String(id), status: 'CONFIRMED' } });
  } catch (error) {
    next(error);
  }
}

/* CONFIRMED -> PAID: trả lương, khóa sổ. */
export async function payPayroll(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã phiếu không hợp lệ.' });
    const paymentMethod = req.body?.paymentMethod !== undefined
      ? String(req.body.paymentMethod ?? '').trim().slice(0, 50) || null : null;
    const result = await moveStatus(id, req.user.userId, 'CONFIRMED', 'PAID', { paymentMethod });
    if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });
    res.json({ data: { id: String(id), status: 'PAID' } });
  } catch (error) {
    next(error);
  }
}

/* CONFIRMED -> DRAFT: mở lại khi chốt nhầm (PAID thì không mở lại). */
export async function reopenPayroll(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã phiếu không hợp lệ.' });
    const result = await moveStatus(id, req.user.userId, 'CONFIRMED', 'DRAFT');
    if (result.error) return res.status(result.error[0]).json({ message: result.error[1] });
    res.json({ data: { id: String(id), status: 'DRAFT' } });
  } catch (error) {
    next(error);
  }
}

/* Lịch sử phiếu lương của chính nhân viên đang đăng nhập. */
export async function listMyPayrolls(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT p.payroll_id AS id, p.period_month AS periodMonth,
              p.base_salary AS baseSalary, p.commission_rate AS commissionRate,
              p.service_revenue AS serviceRevenue, p.completed_count AS completedCount,
              p.commission_amount AS commissionAmount, p.bonus, p.deduction,
              p.total_salary AS totalSalary, p.status,
              p.paid_at AS paidAt, p.payment_method AS paymentMethod, p.note
         FROM payroll p
        WHERE p.staff_id = ?
        ORDER BY p.period_month DESC LIMIT 24`,
      [req.user.staffId],
    );
    res.json({
      data: rows.map((r) => ({
        ...r,
        id: String(r.id),
        baseSalary: Number(r.baseSalary), commissionRate: Number(r.commissionRate),
        serviceRevenue: Number(r.serviceRevenue), completedCount: Number(r.completedCount),
        commissionAmount: Number(r.commissionAmount), bonus: Number(r.bonus),
        deduction: Number(r.deduction), totalSalary: Number(r.totalSalary),
      })),
    });
  } catch (error) {
    next(error);
  }
}
