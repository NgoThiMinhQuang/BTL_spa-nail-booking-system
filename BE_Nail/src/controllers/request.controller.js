/* ===== Yêu cầu nghỉ và yêu cầu lịch làm việc =====

   Hai nghiệp vụ mà trước đây hệ thống chưa có:

     Nghỉ        — nhân viên xin nghỉ, Admin duyệt hoặc từ chối.
                   Trước đây nghỉ được ghi bằng staff_schedule.status =
                   'OFF', thiếu hẳn khái niệm "chờ duyệt" và không biết
                   ai duyệt lúc nào.

     Lịch làm    — nhân viên xin thêm hoặc bỏ ca, Admin duyệt. Chỉ khi
                   duyệt mới được đụng tới staff_schedule.

   Cả hai đều đi qua một bước duyệt của Admin với luật chặn rõ ràng:
   duyệt nghỉ trong khi lịch đang có khách là phải xử lý lịch đó trước
   (đổi nhân viên, đổi giờ hoặc hủy), vì không thể vừa cho nhân viên
   nghỉ vừa giữ lịch của họ. */

import { pool } from '../config/database.js';

/* ================================================================
   YÊU CẦU NGHỈ
   ================================================================ */

function readMoment(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return null;
  return new Date(text.replace(' ', 'T'));
}

/**
 * Nhân viên xin nghỉ. Chỉ tạo được cho chính mình — staffId lấy từ token.
 * Không có đường tự duyệt: nhân viên tạo ở trạng thái PENDING và không
 * có endpoint nào cho phép họ đổi nó.
 */
export async function createLeaveRequest(req, res, next) {
  try {
    const startsAt = readMoment(req.body?.startDatetime);
    const endsAt = readMoment(req.body?.endDatetime);
    const reason = String(req.body?.reason ?? '').trim().slice(0, 500) || null;

    if (!startsAt || !endsAt) {
      return res.status(400).json({
        message: 'Cần nhập thời gian bắt đầu và kết thúc (định dạng YYYY-MM-DD HH:mm).',
      });
    }
    if (endsAt <= startsAt) {
      return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });
    }
    if (endsAt <= new Date()) {
      return res.status(400).json({ message: 'Không thể xin nghỉ cho khoảng thời gian đã qua.' });
    }

    /* Trùng với một yêu cầu đang chờ duyệt thì không tạo lần nữa, tránh
       Admin phải duyệt hai cái giống nhau. */
    const [[pending]] = await pool.query(
      `SELECT leave_request_id FROM staff_leave_request
        WHERE staff_id = ? AND status = 'PENDING'
          AND start_datetime < ? AND end_datetime > ? LIMIT 1`,
      [req.user.staffId, endsAt, startsAt],
    );
    if (pending) {
      return res.status(409).json({
        message: 'Bạn đã có một yêu cầu nghỉ còn đang chờ quản trị duyệt '
          + 'trong khoảng thời gian này.',
      });
    }

    const [result] = await pool.query(
      `INSERT INTO staff_leave_request (staff_id, start_datetime, end_datetime, reason)
       VALUES (?,?,?,?)`, [req.user.staffId, startsAt, endsAt, reason]);

    res.status(201).json({
      data: {
        id: String(result.insertId),
        staffId: String(req.user.staffId),
        staffName: req.user.name,
        startDatetime: startsAt,
        endDatetime: endsAt,
        reason,
        status: 'PENDING',
      },
    });
  } catch (error) {
    next(error);
  }
}

/** Danh sách yêu cầu nghỉ của chính nhân viên đang đăng nhập. */
export async function listMyLeaveRequests(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT lr.leave_request_id AS id, lr.start_datetime AS startDatetime,
              lr.end_datetime AS endDatetime, lr.reason, lr.status,
              lr.review_note AS reviewNote, lr.created_at AS createdAt,
              lr.reviewed_at AS reviewedAt,
              COALESCE(u.full_name, '') AS reviewerName
         FROM staff_leave_request lr
         LEFT JOIN users u ON u.user_id = lr.reviewed_by
        WHERE lr.staff_id = ?
        ORDER BY lr.start_datetime DESC LIMIT 60`, [req.user.staffId]);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        startDate: row.startDatetime,
        endDate: row.endDatetime,
      })),
      meta: {
        pending: rows.filter((row) => row.status === 'PENDING').length,
        approved: rows.filter((row) => row.status === 'APPROVED').length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Danh sách yêu cầu nghỉ cho Admin, kèm số lịch đang bị ảnh hưởng.
 * Số này là lý do Admin phải xử lý lịch trước khi duyệt nghỉ.
 */
export async function listLeaveRequests(req, res, next) {
  try {
    const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(String(req.query.status).toUpperCase())
      ? String(req.query.status).toUpperCase() : null;

    const [rows] = await pool.query(
      `SELECT lr.leave_request_id AS id, lr.staff_id AS staffId,
              u.full_name AS staffName, st.specialty,
              lr.start_datetime AS startDatetime, lr.end_datetime AS endDatetime,
              lr.reason, lr.status, lr.review_note AS reviewNote,
              lr.created_at AS createdAt, lr.reviewed_at AS reviewedAt,
              rv.full_name AS reviewerName,
              (SELECT COUNT(*) FROM booking b
                WHERE b.staff_id = lr.staff_id
                  AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
                  AND b.start_time < lr.end_datetime
                  AND b.end_time > lr.start_datetime) AS affectedBookings
         FROM staff_leave_request lr
         JOIN staff st ON st.staff_id = lr.staff_id
         JOIN users u ON u.user_id = st.user_id
         LEFT JOIN users rv ON rv.user_id = lr.reviewed_by
        ${status ? 'WHERE lr.status = ?' : ''}
        ORDER BY FIELD(lr.status,'PENDING','APPROVED','REJECTED'), lr.start_datetime DESC
        LIMIT 200`,
      status ? [status] : [],
    );

    /* Danh sách lịch bị ảnh hưởng: Admin cần biết chính xác phải xử lý
       lịch nào, không chỉ biết có bao nhiêu cái. */
    const ids = rows.map((row) => Number(row.id));
    const affected = new Map();
    if (ids.length) {
      const [detail] = await pool.query(
        `SELECT b.booking_id AS id, lr.leave_request_id AS leaveId,
                b.start_time AS startsAt, b.end_time AS endsAt, b.status,
                COALESCE(cu.full_name, b.guest_name) AS customerName,
                s.service_name AS serviceName
           FROM booking b
           JOIN staff_leave_request lr
             ON lr.staff_id = b.staff_id
            AND lr.status = 'PENDING'
            AND b.start_time < lr.end_datetime
            AND b.end_time > lr.start_datetime
           JOIN services s ON s.service_id = b.service_id
           LEFT JOIN customer cc ON cc.customer_id = b.customer_id
           LEFT JOIN users cu ON cu.user_id = cc.user_id
          WHERE lr.leave_request_id IN (?)
            AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
          ORDER BY b.start_time`, [ids]);
      for (const row of detail) {
        if (!affected.has(row.leaveId)) affected.set(row.leaveId, []);
        affected.get(row.leaveId).push({
          ...row,
          id: String(row.id),
          leaveId: String(row.leaveId),
        });
      }
    }

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        staffId: String(row.staffId),
        affectedBookings: Number(row.affectedBookings),
        affectedList: affected.get(row.id) ?? [],
      })),
      meta: {
        pending: rows.filter((row) => row.status === 'PENDING').length,
        approved: rows.filter((row) => row.status === 'APPROVED').length,
        rejected: rows.filter((row) => row.status === 'REJECTED').length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin duyệt yêu cầu nghỉ.
 *
 * Chặn nếu còn lịch chưa xử lý trong khoảng nghỉ: nhân viên đã nghỉ thì
 * không thể vừa giữ lịch khách. Admin phải đổi nhân viên, đổi giờ hoặc
 * hủy lịch đó trước rồi duyệt nghỉ. Trả kèm danh sách lịch cần xử lý
 * để giao diện hiện ngay ra, không bắt Admin tự đi tìm.
 */
export async function approveLeaveRequest(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ.' });
    const note = String(req.body?.note ?? '').trim().slice(0, 500) || null;

    await connection.beginTransaction();
    const [[request]] = await connection.query(
      `SELECT leave_request_id, staff_id AS staffId, status,
              start_datetime AS startDatetime, end_datetime AS endDatetime
         FROM staff_leave_request WHERE leave_request_id = ? LIMIT 1 FOR UPDATE`, [id],
    );

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu nghỉ.' });
    }
    if (request.status !== 'PENDING') {
      await connection.rollback();
      return res.status(409).json({
        message: `Yêu cầu này đã được xử lý (${request.status.toLowerCase()}).`,
      });
    }

    const [clash] = await connection.query(
      `SELECT b.booking_id AS id, b.start_time AS startsAt, b.end_time AS endsAt,
              s.service_name AS serviceName,
              COALESCE(u.full_name, b.guest_name, 'khách vãng lai') AS customerName
         FROM booking b
         JOIN services s ON s.service_id = b.service_id
         LEFT JOIN customer c ON c.customer_id = b.customer_id
         LEFT JOIN users u ON u.user_id = c.user_id
        WHERE b.staff_id = ? AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
          AND b.start_time < ? AND b.end_time > ?
        ORDER BY b.start_time LIMIT 50`,
      [request.staffId, request.endDatetime, request.startDatetime],
    );

    if (clash.length) {
      await connection.rollback();
      return res.status(409).json({
        message: `Nhân viên này đang có ${clash.length} lịch trong khoảng nghỉ. `
          + 'Vui lòng đổi nhân viên, đổi giờ hoặc hủy các lịch đó trước khi duyệt nghỉ.',
        reason: 'CONFLICTING_BOOKINGS',
        bookings: clash.map((row) => ({
          id: String(row.id),
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          serviceName: row.serviceName,
          customerName: row.customerName,
        })),
      });
    }

    await connection.query(
      `UPDATE staff_leave_request
          SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
        WHERE leave_request_id = ?`,
      [req.user.userId, note, id],
    );

    await connection.commit();
    res.json({ data: { id: String(id), status: 'APPROVED' } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/** Admin từ chối yêu cầu nghỉ. */
export async function rejectLeaveRequest(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ.' });
    const note = String(req.body?.note ?? '').trim().slice(0, 500) || null;

    const [result] = await pool.query(
      `UPDATE staff_leave_request
          SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
        WHERE leave_request_id = ? AND status = 'PENDING'`,
      [req.user.userId, note, id],
    );
    if (!result.affectedRows) {
      return res.status(409).json({ message: 'Yêu cầu không tồn tại hoặc đã được xử lý.' });
    }
    res.json({ data: { id: String(id), status: 'REJECTED' } });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   YÊU CẦU LỊCH LÀM VIỆC
   ================================================================ */

/** Nhân viên xin thêm / bỏ ca. Chỉ tạo cho chính mình, chưa có hiệu lực. */
export async function createScheduleRequest(req, res, next) {
  try {
    const workDate = String(req.body?.workDate ?? '').trim();
    const startTime = String(req.body?.startTime ?? '').trim();
    const endTime = String(req.body?.endTime ?? '').trim();
    const action = ['ADD', 'UPDATE', 'REMOVE'].includes(req.body?.action)
      ? req.body.action : 'ADD';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return res.status(400).json({ message: 'Ngày làm việc không hợp lệ.' });
    }
    if (action !== 'REMOVE' && (!/^\d{2}:\d{2}/.test(startTime) || !/^\d{2}:\d{2}/.test(endTime))) {
      return res.status(400).json({ message: 'Giờ bắt đầu và kết thúc không hợp lệ.' });
    }
    if (action !== 'REMOVE' && startTime.slice(0, 5) >= endTime.slice(0, 5)) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu.' });
    }

    const [[pending]] = await pool.query(
      `SELECT schedule_request_id FROM staff_schedule_request
        WHERE staff_id = ? AND work_date = ? AND status = 'PENDING' LIMIT 1`,
      [req.user.staffId, workDate],
    );
    if (pending) {
      return res.status(409).json({ message: 'Bạn đã có yêu cầu đang chờ duyệt cho ngày này.' });
    }

    const [result] = await pool.query(
      `INSERT INTO staff_schedule_request
         (staff_id, work_date, start_time, end_time, action)
       VALUES (?,?,?,?,?)`,
      [req.user.staffId, workDate, startTime || '00:00:00', endTime || '00:00:00', action],
    );

    res.status(201).json({
      data: {
        id: String(result.insertId),
        staffId: String(req.user.staffId),
        workDate,
        startTime,
        endTime,
        action,
        status: 'PENDING',
      },
    });
  } catch (error) {
    next(error);
  }
}

/** Danh sách yêu cầu lịch làm việc của chính nhân viên. */
export async function listMyScheduleRequests(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT sr.schedule_request_id AS id, sr.work_date AS workDate,
              TIME_FORMAT(sr.start_time, '%H:%i') AS startTime,
              TIME_FORMAT(sr.end_time, '%H:%i') AS endTime,
              sr.action, sr.status, sr.review_note AS reviewNote,
              sr.created_at AS createdAt, sr.reviewed_at AS reviewedAt
         FROM staff_schedule_request sr
        WHERE sr.staff_id = ?
        ORDER BY sr.work_date DESC LIMIT 60`, [req.user.staffId]);

    res.json({ data: rows.map((row) => ({ ...row, id: String(row.id) })) });
  } catch (error) {
    next(error);
  }
}

/** Danh sách yêu cầu lịch làm việc cho Admin. */
export async function listScheduleRequests(req, res, next) {
  try {
    const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(String(req.query.status).toUpperCase())
      ? String(req.query.status).toUpperCase() : null;

    const [rows] = await pool.query(
      `SELECT sr.schedule_request_id AS id, sr.staff_id AS staffId,
              u.full_name AS staffName, st.specialty,
              DATE_FORMAT(sr.work_date, '%Y-%m-%d') AS workDate,
              TIME_FORMAT(sr.start_time, '%H:%i') AS startTime,
              TIME_FORMAT(sr.end_time, '%H:%i') AS endTime,
              sr.action, sr.status, sr.review_note AS reviewNote,
              sr.created_at AS createdAt, sr.reviewed_at AS reviewedAt,
              (SELECT COUNT(*) FROM booking b WHERE b.staff_id = sr.staff_id
                AND DATE(b.start_time) = sr.work_date
                AND b.status IN ('PENDING','CONFIRMED','PROCESSING')) AS affectedBookings
         FROM staff_schedule_request sr
         JOIN staff st ON st.staff_id = sr.staff_id
         JOIN users u ON u.user_id = st.user_id
        ${status ? 'WHERE sr.status = ?' : ''}
        ORDER BY FIELD(sr.status,'PENDING','APPROVED','REJECTED'), sr.work_date DESC
        LIMIT 200`,
      status ? [status] : [],
    );

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        staffId: String(row.staffId),
        affectedBookings: Number(row.affectedBookings),
      })),
      meta: { pending: rows.filter((row) => row.status === 'PENDING').length },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin duyệt yêu cầu lịch làm việc — chỉ khi duyệt mới đụng tới
 * staff_schedule. Trước đây không có bước duyệt này, lịch làm việc bị
 * sửa thẳng nên không biết ai đề nghị, ai duyệt.
 */
export async function approveScheduleRequest(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ.' });
    const note = String(req.body?.note ?? '').trim().slice(0, 500) || null;

    await connection.beginTransaction();
    const [[request]] = await connection.query(
      `SELECT schedule_request_id, staff_id AS staffId, work_date AS workDate,
              start_time AS startTime, end_time AS endTime, action, status
         FROM staff_schedule_request WHERE schedule_request_id = ? LIMIT 1 FOR UPDATE`, [id],
    );

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu lịch làm việc.' });
    }
    if (request.status !== 'PENDING') {
      await connection.rollback();
      return res.status(409).json({ message: 'Yêu cầu này đã được xử lý.' });
    }

    if (request.action === 'REMOVE') {
      await connection.query(
        `DELETE FROM staff_schedule WHERE staff_id = ? AND work_date = ?`,
        [request.staffId, request.workDate],
      );
    } else {
      /* Bỏ ca cũ của ngày đó rồi tạo ca mới: một ngày chỉ có một ca
         làm việc, giữ cả hai sẽ ra hai ca chồng nhau. */
      await connection.query(
        `DELETE FROM staff_schedule WHERE staff_id = ? AND work_date = ?`,
        [request.staffId, request.workDate],
      );
      await connection.query(
        `INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status)
         VALUES (?,?,?,?, 'AVAILABLE')`,
        [request.staffId, request.workDate, request.startTime, request.endTime],
      );
    }

    await connection.query(
      `UPDATE staff_schedule_request
          SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
        WHERE schedule_request_id = ?`,
      [req.user.userId, note, id],
    );

    await connection.commit();
    res.json({ data: { id: String(id), status: 'APPROVED' } });
  } catch (error) {
    await connection.rollback();
    next(error);
  }
}

/** Admin từ chối yêu cầu lịch làm việc. */
export async function rejectScheduleRequest(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ.' });
    const note = String(req.body?.note ?? '').trim().slice(0, 500) || null;

    const [result] = await pool.query(
      `UPDATE staff_schedule_request
          SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
        WHERE schedule_request_id = ? AND status = 'PENDING'`,
      [req.user.userId, note, id],
    );
    if (!result.affectedRows) {
      return res.status(409).json({ message: 'Yêu cầu không tồn tại hoặc đã được xử lý.' });
    }
    res.json({ data: { id: String(id), status: 'REJECTED' } });
  } catch (error) {
    next(error);
  }
}