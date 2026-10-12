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
import { isDate } from '../lib/booking-service.js';
import { adminEmailList, createNotification, pushToUser, sendEmailAlert, sendTelegramAlert } from '../lib/notifications.js';

/* 'YYYY-MM-DD HH:mm' → 'HH:mm ngày DD/MM' để nhắn cho khách. */
function fmtSlot(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value ?? '');
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ngày ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

/* Giờ HH:mm chặt: 00:00–23:59. Regex cũ /^\d{2}:\d{2}/ không neo cuối
   (lọt "12:34:56") và cho qua cả "99:99". */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ================================================================
   YÊU CẦU NGHỈ
   ================================================================ */

function readMoment(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return null;
  return new Date(text.replace(' ', 'T'));
}

/* Lịch đang có khách mà ca mới không chứa hết — dùng chung cho duyệt yêu
   cầu đổi ca và Admin xếp ca trực tiếp. newStart/newEnd null nghĩa là
   xoá ca: bất kỳ lịch nào trong ngày cũng vướng. */
async function findStrandedBookings(connection, staffId, day, newStart, newEnd) {
  const [rows] = await connection.query(
    `SELECT b.booking_id AS id, b.start_time AS startsAt, b.end_time AS endsAt,
            s.service_name AS serviceName,
            COALESCE(u.full_name, b.guest_name, 'khách vãng lai') AS customerName
       FROM booking b
       JOIN services s ON s.service_id = b.service_id
       LEFT JOIN customer c ON c.customer_id = b.customer_id
       LEFT JOIN users u ON u.user_id = c.user_id
      WHERE b.staff_id = ? AND DATE(b.start_time) = ?
        AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
        ${newStart == null ? '' : 'AND NOT (b.start_time >= ? AND b.end_time <= ?)'}
      ORDER BY b.start_time LIMIT 50`,
    newStart == null
      ? [staffId, day]
      : [staffId, day, `${day} ${newStart}`, `${day} ${newEnd}`],
  );
  return rows.map((row) => ({
    id: String(row.id),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    serviceName: row.serviceName,
    customerName: row.customerName,
  }));
}

function strandedMessage(action, day, start, end, bookings) {
  if (action === 'REMOVE') {
    return `Nhân viên này đang có ${bookings.length} lịch trong ngày ${day}. `
      + 'Vui lòng đổi nhân viên, đổi giờ hoặc hủy các lịch đó trước khi duyệt xoá ca.';
  }
  return `Ca mới (${start.slice(0, 5)}–${end.slice(0, 5)} `
    + `ngày ${day}) bỏ rơi ${bookings.length} lịch đã có khách. `
    + 'Vui lòng đổi nhân viên, đổi giờ hoặc hủy các lịch đó trước khi duyệt.';
}

/* Cột TIME driver có thể trả về chuỗi 'HH:mm:ss' hoặc object Date tuỳ
   cấu hình — chuẩn hoá về 'HH:mm:ss' trước khi ghép vào câu so sánh.
   Nếu lọt object Date vào String().slice(0,8) sẽ ra "Wed Oct " và điều
   kiện chặn duyệt ca sai hoàn toàn. */
function timeText(value) {
  if (value instanceof Date) return value.toTimeString().slice(0, 8);
  return String(value).slice(0, 8);
}
/* Nhóm lý do nghỉ đột xuất: chọn nhanh, ghi chú chi tiết không bắt buộc
   để tránh bắt nhân viên khai quá nhiều thông tin riêng tư khi gặp sự cố. */
export const REASON_CATEGORIES = {
  HEALTH: 'Vấn đề sức khỏe',
  FAMILY: 'Việc gia đình khẩn cấp',
  PERSONAL: 'Sự cố cá nhân',
  OTHER: 'Lý do khác',
};

/* Date → 'YYYY-MM-DD HH:mm:ss' cho cột DATETIME. */
function sqlDatetime(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* Ghi nhận nghỉ đột xuất có hiệu lực ngay + toàn bộ việc tiếp theo:
   chặn lịch mới (qua APPROVED), tìm lịch bị ảnh hưởng, báo khách,
   báo Admin (INAPP + push + Telegram + Gmail). Lỗi gửi tin không làm
   hỏng đơn nghỉ. Dùng chung cho mọi đường báo nghỉ đột xuất. */
async function grantEmergencyLeave({ staffId, staffName, startsAt, endsAt, reason, reasonCategory }) {
  /* Trùng với yêu cầu đang chờ hoặc đã duyệt thì không tạo nữa. */
  const [[existing]] = await pool.query(
    `SELECT leave_request_id FROM staff_leave_request
      WHERE staff_id = ? AND status IN ('PENDING','APPROVED')
        AND start_datetime < ? AND end_datetime > ? LIMIT 1`,
    [staffId, endsAt, startsAt],
  );
  if (existing) {
    const error = new Error(
      'Bạn đã có một yêu cầu nghỉ (chờ duyệt hoặc đã duyệt) '
      + 'trong khoảng thời gian này.');
    error.status = 409;
    throw error;
  }

  /* Tự động APPROVED để staff-availability chặn booking mới ngay lập
     tức (approvedLeaveOverlaps chỉ đọc APPROVED). Booking cũ còn lại
     trong khoảng nghỉ giữ nguyên để Admin đổi người / đổi giờ / hủy —
     ngoài đời nhân viên đã nghỉ rồi, không thể bắt hệ thống giả vờ
     họ vẫn đi làm cho đến khi xử lý xong khách. Nếu đang có lịch
     PROCESSING, Admin bàn giao sang người khác (patchBooking cho phép
     đổi người khi PROCESSING) rồi người mới bấm hoàn thành. */
  const [result] = await pool.query(
    `INSERT INTO staff_leave_request
        (staff_id, start_datetime, end_datetime, reason, leave_type,
         reason_category, status, reviewed_by, reviewed_at, review_note)
      VALUES (?,?,?,?,'EMERGENCY',?,'APPROVED',NULL,NOW(),'Hệ thống tự duyệt nghỉ đột xuất')`,
    [staffId, startsAt, endsAt, reason, reasonCategory]);

  /* Booking còn lại từ hiện tại tới hết khoảng nghỉ — COMPLETED giữ
     nguyên, chỉ PENDING/CONFIRMED/PROCESSING cần xử lý. */
  const [remaining] = await pool.query(
    `SELECT COUNT(*) AS n FROM booking b
      WHERE b.staff_id = ? AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
        AND b.start_time < ? AND b.end_time > NOW()`,
    [staffId, endsAt],
  );

  /* Tự động thông báo cho từng khách bị ảnh hưởng NGAY (không đợi
     Admin tìm người thay): ghi hộp thư INAPP + đẩy push tới máy đã
     đăng ký. Không tiết lộ lý do riêng của nhân viên. Lỗi gửi chỉ ghi
     FAILED để thử lại — không được làm hỏng yêu cầu nghỉ. */
  let notified = 0;
  let walkinCount = 0;
  try {
    const [affected] = await pool.query(
      `SELECT b.booking_id AS bookingId, b.start_time AS startsAt,
              s.service_name AS serviceName, u.user_id AS userId,
              COALESCE(u.full_name, b.guest_name) AS customerName,
              COALESCE(u.phone, b.guest_phone) AS phone
         FROM booking b
         JOIN services s ON s.service_id = b.service_id
         LEFT JOIN customer c ON c.customer_id = b.customer_id
         LEFT JOIN users u ON u.user_id = c.user_id
        WHERE b.staff_id = ? AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
          AND b.start_time < ? AND b.end_time > NOW()
        ORDER BY b.start_time`,
      [staffId, endsAt],
    );
    for (const booking of affected) {
      const when = fmtSlot(booking.startsAt);
      const title = 'Lịch hẹn của bạn bị ảnh hưởng';
      const body = `Lịch ${booking.serviceName} lúc ${when} của bạn bị ảnh hưởng `
        + 'do nhân viên bận đột xuất. Mở ứng dụng NailHouse để chọn: '
        + 'hủy lịch hoặc đổi sang nhân viên khác — cửa hàng cũng đang sắp xếp hỗ trợ.';
      if (booking.userId) {
        await createNotification(pool, {
          userId: booking.userId, title, body,
          type: 'LEAVE_DISRUPTION', refType: 'booking', refId: booking.bookingId,
        });
        await pushToUser(pool, {
          userId: booking.userId, title, body,
          type: 'LEAVE_DISRUPTION', refType: 'booking', refId: booking.bookingId,
        });
        notified += 1;
      } else {
        /* Khách vãng lai không có tài khoản: Admin gọi/SMS theo số. */
        walkinCount += 1;
      }
    }
  } catch {
    /* Bỏ qua — yêu cầu nghỉ đã có hiệu lực, gửi lỗi xem ở trang Admin. */
  }

  /* Báo cho Admin NGAY (INAPP + đẩy push tới mọi quản trị viên đang
     làm việc): nghỉ đột xuất tự duyệt nên không nằm trong hàng chờ —
     không báo là Admin không biết để xoay khách kịp. Lỗi gửi không
     được làm hỏng yêu cầu nghỉ. */
  let adminNotified = 0;
  try {
    const [admins] = await pool.query(
      "SELECT user_id AS userId FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'");
    const affected = Number(remaining[0]?.n ?? 0);
    const title = 'Nhân viên báo nghỉ đột xuất';
    const body = `${staffName} vừa báo nghỉ đột xuất từ ${fmtSlot(startsAt)} `
      + `đến ${fmtSlot(endsAt)} (${REASON_CATEGORIES[reasonCategory] ?? 'đột xuất'}). `
      + `Có ${affected} lịch cần xử lý`
      + (notified > 0 ? `, đã báo qua app cho ${notified} khách` : '')
      + (walkinCount > 0 ? `, ${walkinCount} khách vãng lai cần gọi tay` : '')
      + '. Đơn đã tự duyệt — mở trang nghỉ phép để bàn giao lịch.';
    for (const admin of admins) {
      await createNotification(pool, {
        userId: admin.userId, title, body,
        type: 'LEAVE_DISRUPTION', refType: 'leave_request', refId: result.insertId,
      });
      await pushToUser(pool, {
        userId: admin.userId, title, body,
        type: 'LEAVE_DISRUPTION', refType: 'leave_request', refId: result.insertId,
      });
      adminNotified += 1;
    }
  } catch {
    /* Bỏ qua — như kênh khách, lỗi gửi xem ở trang thông báo. */
  }

  /* Kênh khẩn cấp ra điện thoại admin (Telegram): Expo push chỉ tới
     khi máy đã cài app + đăng ký token. Chưa cấu hình thì bỏ qua êm. */
  let telegramSent = 0;
  let emailSent = 0;
  try {
    const affected = Number(remaining[0]?.n ?? 0);
    const urgent =
      `KHẨN: ${staffName} báo nghỉ đột xuất từ ${fmtSlot(startsAt)} đến ${fmtSlot(endsAt)}. `
      + `Có ${affected} lịch cần xử lý`
      + (notified > 0 ? ` (đã báo app cho ${notified} khách)` : '')
      + (walkinCount > 0 ? ` (${walkinCount} khách vãng lai cần gọi)` : '')
      + '. Mở web quản trị để bàn giao lịch.';
    const telegram = await sendTelegramAlert(urgent);
    telegramSent = telegram.sent ?? 0;
    /* Song song gửi Gmail cho admin để có vết lưu + đọc trên máy tính. */
    const emails = adminEmailList();
    if (emails.length > 0) {
      const mailed = await sendEmailAlert({
        to: emails,
        subject: `[KHẨN] ${staffName} báo nghỉ đột xuất`,
        text: `${urgent}\n\nNhóm lý do: ${REASON_CATEGORIES[reasonCategory] ?? '—'}\n`
          + `Ghi chú nhân viên: ${reason || '—'}\n`
          + `Đơn đã tự duyệt. Mở trang nghỉ phép trên web quản trị để bàn giao lịch.`,
      });
      emailSent = mailed.sent ?? 0;
    }
  } catch {
    /* Kênh phụ — không được làm hỏng đơn nghỉ. */
  }

  return {
    id: String(result.insertId),
    staffId: String(staffId),
    staffName,
    startDatetime: startsAt,
    endDatetime: endsAt,
    reason,
    reasonCategory,
    leaveType: 'EMERGENCY',
    status: 'APPROVED',
    affectedBookings: Number(remaining[0]?.n ?? 0),
    notifiedCustomers: notified,
    walkinCustomers: walkinCount,
    notifiedAdmins: adminNotified,
    telegramSent,
    emailSent,
  };
}

/* ================================================================
   Báo nghỉ đột xuất — POST /api/staff/leave-requests/emergency
   ---------------------------------------------------------------
   Biểu mẫu riêng cho sự cố trong ngày (không dùng chung form nghỉ
   phép): nhân viên chỉ chọn nhóm lý do + ghi chú tùy chọn, mọi mốc
   thời gian do server tự xác định từ ca hôm nay — không tin giờ
   frontend gửi lên.

   Quy tắc (ca 09:00–18:00):
     báo 08:30 (chưa tới ca) → nghỉ 09:00–18:00
     báo 11:00 (đang trong ca) → nghỉ 11:00–18:00
     hết ca / không có ca → 409, không tạo đơn
   ================================================================ */
export async function reportEmergencyLeave(req, res, next) {
  try {
    const category = String(req.body?.reasonCategory ?? '').trim().toUpperCase();
    if (!Object.hasOwn(REASON_CATEGORIES, category)) {
      return res.status(400).json({
        message: 'Hãy chọn nhóm lý do nghỉ (sức khỏe, gia đình, cá nhân hoặc khác).',
      });
    }
    const note = String(req.body?.note ?? req.body?.reason ?? '').trim().slice(0, 500) || null;

    /* Ca hôm nay của chính nhân viên này — một ca/ngày (unique) nên
       không cần chọn ca. Ngày và giờ lấy theo giờ địa phương của server
       (giờ Việt Nam), thống nhất với mọi chỗ khác trong codebase — KHÔNG
       dùng CURDATE()/NOW() của DB vì DB có thể chạy múi giờ khác. */
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dayText =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const [[shift]] = await pool.query(
      `SELECT schedule_id AS id,
              TIME_FORMAT(start_time,'%H:%i') AS shiftStart,
              TIME_FORMAT(end_time,'%H:%i') AS shiftEnd, status
         FROM staff_schedule
        WHERE staff_id = ? AND work_date = ? LIMIT 1`,
      [req.user.staffId, dayText]);
    if (!shift || shift.status !== 'AVAILABLE') {
      return res.status(409).json({
        message: 'Bạn không có ca làm việc hôm nay nên không cần báo nghỉ đột xuất.',
      });
    }
    const shiftStart = new Date(`${dayText}T${shift.shiftStart}:00`);
    const shiftEnd = new Date(`${dayText}T${shift.shiftEnd}:00`);
    if (!(shiftEnd > now)) {
      return res.status(409).json({
        message: 'Ca làm việc hôm nay đã kết thúc. '
          + 'Vui lòng liên hệ quản trị viên nếu cần điều chỉnh chấm công.',
      });
    }
    /* Chưa tới ca thì nghỉ cả ca; đang trong ca thì nghỉ từ lúc báo. */
    const startsAt = now < shiftStart ? shiftStart : now;
    const windowSource = now < shiftStart ? 'FULL_SHIFT' : 'MID_SHIFT';

    try {
      const data = await grantEmergencyLeave({
        staffId: req.user.staffId,
        staffName: req.user.name,
        startsAt: sqlDatetime(startsAt),
        endsAt: sqlDatetime(shiftEnd),
        reason: note,
        reasonCategory: category,
      });
      return res.status(201).json({ data: { ...data, windowSource } });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      throw error;
    }
  } catch (error) {
    next(error);
  }
}


/**
 * Nhân viên xin nghỉ phép (có kế hoạch). Chỉ tạo được cho chính mình —
 * staffId lấy từ token. Không có đường tự duyệt: nhân viên tạo ở trạng
 * thái PENDING và không có endpoint nào cho phép họ đổi nó.
 *
 * Đường này chỉ nhận nghỉ thường. Nghỉ đột xuất có biểu mẫu riêng
 * (POST /leave-requests/emergency): server tự tính khoảng nghỉ từ ca
 * hôm nay, không nhận giờ do frontend gửi lên.
 */
export async function createLeaveRequest(req, res, next) {
  try {
    if (String(req.body?.leave_type ?? req.body?.leaveType ?? 'NORMAL')
      .trim().toUpperCase() === 'EMERGENCY') {
      return res.status(400).json({
        message: 'Báo nghỉ đột xuất dùng biểu mẫu riêng, không gửi giờ thủ công. '
          + 'Hãy dùng chức năng "Báo nghỉ đột xuất".',
      });
    }
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

    /* Nghỉ thường: chỉ xin cho tương lai. Ca sáng xin lúc 10:00 cho khoảng
       07:00–15:00 cùng ngày thì 3 tiếng đầu đã qua, duyệt kiểu gì cũng
       dở. Trước đây chỉ chặn end <= now nên khoảng bắt đầu trong quá
       khứ vẫn lọt. */
    if (startsAt <= new Date()) {
      return res.status(400).json({ message: 'Chỉ xin nghỉ cho khoảng thời gian trong tương lai. Nghỉ ngay giữa ca thì dùng "Báo nghỉ đột xuất".' });
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
      `INSERT INTO staff_leave_request (staff_id, start_datetime, end_datetime, reason, leave_type)
       VALUES (?,?,?,?,'NORMAL')`, [req.user.staffId, startsAt, endsAt, reason]);

    res.status(201).json({
      data: {
        id: String(result.insertId),
        staffId: String(req.user.staffId),
        staffName: req.user.name,
        startDatetime: startsAt,
        endDatetime: endsAt,
        reason,
        leaveType: 'NORMAL',
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
              lr.leave_type AS leaveType, lr.reason_category AS reasonCategory,
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
        leaveType: row.leaveType ?? 'NORMAL',
        reasonCategory: row.reasonCategory ?? null,
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
              lr.reason, lr.status, lr.leave_type AS leaveType,
              lr.reason_category AS reasonCategory,
              lr.review_note AS reviewNote,
              lr.created_at AS createdAt, lr.reviewed_at AS reviewedAt,
              rv.full_name AS reviewerName,
              /* Lịch đã bàn giao sang người khác vẫn thuộc sự cố (nhận biết
                 qua STAFF_CHANGED sau lúc tạo đơn) để tiến độ xử lý đúng. */
              (SELECT COUNT(*) FROM booking b
                WHERE b.status IN ('PENDING','CONFIRMED','PROCESSING')
                  AND b.start_time < lr.end_datetime
                  AND b.end_time > lr.start_datetime
                  AND (b.staff_id = lr.staff_id
                    OR EXISTS (SELECT 1 FROM booking_event e
                               WHERE e.booking_id = b.booking_id
                                 AND e.event_type = 'STAFF_CHANGED'
                                 AND e.created_at >= lr.created_at))) AS affectedBookings
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
       lịch nào, không chỉ biết có bao nhiêu cái. Nghỉ đột xuất đã APPROVED
       vẫn còn lịch chờ đổi người / đổi giờ / hủy nên vẫn phải hiện. */
    const ids = rows.map((row) => Number(row.id));
    const affected = new Map();
    if (ids.length) {
      const [detail] = await pool.query(
        `SELECT b.booking_id AS id, lr.leave_request_id AS leaveId,
                b.start_time AS startsAt, b.end_time AS endsAt, b.status,
                b.staff_id AS currentStaffId, su.full_name AS currentStaffName,
                COALESCE(cu.full_name, b.guest_name) AS customerName,
                s.service_name AS serviceName
           FROM booking b
           JOIN staff_leave_request lr
             ON (lr.staff_id = b.staff_id
               OR EXISTS (SELECT 1 FROM booking_event e
                          WHERE e.booking_id = b.booking_id
                            AND e.event_type = 'STAFF_CHANGED'
                            AND e.created_at >= lr.created_at))
            AND (lr.status = 'PENDING'
              OR (lr.leave_type = 'EMERGENCY' AND lr.status = 'APPROVED'))
            AND b.start_time < lr.end_datetime
            AND b.end_time > lr.start_datetime
           JOIN services s ON s.service_id = b.service_id
           LEFT JOIN staff cst ON cst.staff_id = b.staff_id
           LEFT JOIN users su ON su.user_id = cst.user_id
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
          currentStaffId: row.currentStaffId == null ? null : String(row.currentStaffId),
        });
      }
    }

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        staffId: String(row.staffId),
        leaveType: row.leaveType ?? 'NORMAL',
        reasonCategory: row.reasonCategory ?? null,
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

    if (!isDate(workDate)) {
      return res.status(400).json({ message: 'Ngày làm việc không hợp lệ.' });
    }
    /* Chỉ xin đổi ca tương lai: duyệt yêu cầu cho ngày đã qua sẽ sửa
       lịch sử sau khi chấm công, lương và booking đã phát sinh. Muốn sửa
       dữ liệu cũ thì Admin làm đường riêng, không qua duyệt yêu cầu. */
    const now = new Date();
    const todayText =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (workDate < todayText) {
      return res.status(400).json({ message: 'Chỉ gửi yêu cầu đổi ca cho hôm nay trở đi.' });
    }
    if (action !== 'REMOVE' && (!CLOCK.test(startTime) || !CLOCK.test(endTime))) {
      return res.status(400).json({ message: 'Giờ bắt đầu và kết thúc phải dạng HH:mm (00:00–23:59).' });
    }
    if (action !== 'REMOVE' && startTime >= endTime) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu.' });
    }

    /* Mỗi action một ý nghĩa thật: ADD chỉ khi ngày đó chưa có ca,
       UPDATE / REMOVE chỉ khi ngày đó đã có ca. Nếu không, ADD khi đã
       có ca lại chạy giống UPDATE (xoá ca cũ, chèn ca mới) và UPDATE
       khi chưa có ca lại chạy giống ADD. */
    const [[existingShift]] = await pool.query(
      `SELECT schedule_id FROM staff_schedule
        WHERE staff_id = ? AND work_date = ? LIMIT 1`,
      [req.user.staffId, workDate],
    );
    if (action === 'ADD' && existingShift) {
      return res.status(409).json({
        message: 'Ngày này bạn đã có ca làm việc. Muốn đổi giờ thì gửi yêu cầu đổi ca.',
      });
    }
    if ((action === 'UPDATE' || action === 'REMOVE') && !existingShift) {
      return res.status(409).json({
        message: 'Ngày này bạn chưa có ca làm việc nên không đổi hoặc xoá được.',
      });
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
      `SELECT schedule_request_id, staff_id AS staffId,
              DATE_FORMAT(work_date, '%Y-%m-%d') AS workDate,
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

    /* Action phải đúng nghĩa với ca hiện có lúc duyệt: ca có thể đã đổi
       sau khi yêu cầu được gửi. ADD khi đã có ca thì chẳng khác gì
       UPDATE, UPDATE khi chưa có ca thì chẳng khác gì ADD. */
    const [[currentShift]] = await connection.query(
      `SELECT schedule_id FROM staff_schedule
        WHERE staff_id = ? AND work_date = ? LIMIT 1`,
      [request.staffId, request.workDate],
    );
    if (request.action === 'ADD' && currentShift) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Ngày này đã có ca làm việc nên không duyệt thêm ca được. Nhân viên cần gửi lại yêu cầu đổi ca.',
      });
    }
    if ((request.action === 'UPDATE' || request.action === 'REMOVE') && !currentShift) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Ngày này chưa có ca làm việc nên không duyệt đổi hoặc xoá ca được.',
      });
    }

    /* Ca mới (hoặc xoá ca) không được bỏ rơi lịch đã có khách: nhân viên
       có lịch 15:00 mà ca bị sửa thành 08:00–12:00 thì lịch đó không còn
       ai phục vụ. Admin phải đổi nhân viên, đổi giờ hoặc hủy các lịch đó
       trước rồi duyệt — giống luật duyệt nghỉ phép. */
    const day = String(request.workDate).slice(0, 10);
    const newStart = request.action === 'REMOVE' ? null : timeText(request.startTime);
    const newEnd = request.action === 'REMOVE' ? null : timeText(request.endTime);
    const stranded = await findStrandedBookings(connection, request.staffId, day, newStart, newEnd);

    if (stranded.length) {
      await connection.rollback();
      return res.status(409).json({
        message: strandedMessage(request.action, day, newStart ?? '', newEnd ?? '', stranded),
        reason: 'CONFLICTING_BOOKINGS',
        bookings: stranded,
      });
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
  } finally {
    /* Không có finally này thì connection không bao giờ trả về pool:
       duyệt nhiều lần là pool hết connection và backend treo. */
    connection.release();
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

/* ================================================================
   ADMIN XẾP CA TRỰC TIẾP
   ---------------------------------------------------------------
   Khác duyệt yêu cầu (nhân viên đề xuất → Admin đồng ý): ở đây Admin
   chủ động xếp ca cho nhân viên. Cùng một luật bảo vệ lịch đã có khách
   (findStrandedBookings) nên hai đường không lệch nhau.
   ================================================================ */

function readShiftBody(body) {
  const staffId = Number(body?.staffId);
  const workDate = String(body?.workDate ?? '').trim();
  const startTime = String(body?.startTime ?? '').trim().slice(0, 5);
  const endTime = String(body?.endTime ?? '').trim().slice(0, 5);
  if (!Number.isInteger(staffId)) return { error: 'Mã nhân viên không hợp lệ.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { error: 'Ngày làm việc không hợp lệ.' };
  }
  if (workDate < new Date().toISOString().slice(0, 10)) {
    return { error: 'Không xếp ca cho ngày đã qua.' };
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { error: 'Giờ bắt đầu và kết thúc phải dạng HH:mm.' };
  }
  if (startTime >= endTime) {
    return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' };
  }
  return { staffId, workDate, startTime, endTime };
}

/** POST /api/admin/schedule — xếp ca mới (mỗi người một ca/ngày). */
export async function createSchedule(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const parsed = readShiftBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { staffId, workDate, startTime, endTime } = parsed;

    await connection.beginTransaction();
    const [[staff]] = await connection.query(
      `SELECT st.staff_id FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE st.staff_id = ? AND u.status = 'ACTIVE' LIMIT 1`, [staffId]);
    if (!staff) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy nhân viên đang làm việc.' });
    }

    const [[existing]] = await connection.query(
      `SELECT schedule_id FROM staff_schedule
        WHERE staff_id = ? AND work_date = ? LIMIT 1 FOR UPDATE`, [staffId, workDate]);
    if (existing) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Nhân viên đã có ca ngày này. Dùng sửa ca để đổi giờ.',
      });
    }

    const stranded = await findStrandedBookings(
      connection, staffId, workDate, `${startTime}:00`, `${endTime}:00`);
    if (stranded.length) {
      await connection.rollback();
      return res.status(409).json({
        message: strandedMessage('UPDATE', workDate, startTime, endTime, stranded),
        reason: 'CONFLICTING_BOOKINGS',
        bookings: stranded,
      });
    }

    const [result] = await connection.query(
      `INSERT INTO staff_schedule (staff_id, work_date, start_time, end_time, status)
       VALUES (?,?,?,?,'AVAILABLE')`, [staffId, workDate, `${startTime}:00`, `${endTime}:00`]);
    await connection.commit();
    res.status(201).json({
      data: {
        id: String(result.insertId), staffId: String(staffId),
        workDate, startTime, endTime, status: 'AVAILABLE',
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/** PUT /api/admin/schedule/:id — đổi giờ ca (không đổi người/ngày). */
export async function updateSchedule(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã ca không hợp lệ.' });
    const startTime = String(req.body?.startTime ?? '').trim().slice(0, 5);
    const endTime = String(req.body?.endTime ?? '').trim().slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
      return res.status(400).json({ message: 'Giờ bắt đầu phải trước giờ kết thúc (HH:mm).' });
    }

    await connection.beginTransaction();
    const [[shift]] = await connection.query(
      `SELECT schedule_id, staff_id AS staffId,
              DATE_FORMAT(work_date,'%Y-%m-%d') AS workDate
         FROM staff_schedule WHERE schedule_id = ? LIMIT 1 FOR UPDATE`, [id]);
    if (!shift) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy ca làm việc.' });
    }

    /* Khóa sửa lịch sử: ca đã qua gắn với chấm công, lương và booking đã
       phát sinh — sửa giờ quá khứ làm sai hết. Muốn điều chỉnh thì làm
       đường riêng có ghi lý do, không sửa thẳng. */
    const now = new Date();
    const todayText =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (shift.workDate < todayText) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Ca đã qua ngày không sửa được. Liên hệ quản trị để điều chỉnh theo quy trình riêng.',
      });
    }

    const stranded = await findStrandedBookings(
      connection, shift.staffId, shift.workDate, `${startTime}:00`, `${endTime}:00`);
    if (stranded.length) {
      await connection.rollback();
      return res.status(409).json({
        message: strandedMessage('UPDATE', shift.workDate, startTime, endTime, stranded),
        reason: 'CONFLICTING_BOOKINGS',
        bookings: stranded,
      });
    }

    await connection.query(
      `UPDATE staff_schedule SET start_time = ?, end_time = ? WHERE schedule_id = ?`,
      [`${startTime}:00`, `${endTime}:00`, id]);
    await connection.commit();
    res.json({ data: { id: String(id), startTime, endTime } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/** DELETE /api/admin/schedule/:id — xoá ca (chặn khi còn lịch trong ngày). */
export async function deleteSchedule(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã ca không hợp lệ.' });

    await connection.beginTransaction();
    const [[shift]] = await connection.query(
      `SELECT schedule_id, staff_id AS staffId,
              DATE_FORMAT(work_date,'%Y-%m-%d') AS workDate
         FROM staff_schedule WHERE schedule_id = ? LIMIT 1 FOR UPDATE`, [id]);
    if (!shift) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy ca làm việc.' });
    }

    /* Như sửa ca: ca quá khứ đã chốt công/lương, không xoá lịch sử. */
    const now = new Date();
    const todayText =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (shift.workDate < todayText) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Ca đã qua ngày không xoá được.',
      });
    }

    const stranded = await findStrandedBookings(connection, shift.staffId, shift.workDate, null, null);
    if (stranded.length) {
      await connection.rollback();
      return res.status(409).json({
        message: strandedMessage('REMOVE', shift.workDate, '', '', stranded),
        reason: 'CONFLICTING_BOOKINGS',
        bookings: stranded,
      });
    }

    await connection.query('DELETE FROM staff_schedule WHERE schedule_id = ?', [id]);
    await connection.commit();
    res.json({ data: { id: String(id), removed: true } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}