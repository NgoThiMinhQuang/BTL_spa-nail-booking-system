/* ===== Dịch vụ đặt lịch dùng chung =====

   Trước đây có ba chỗ kiểm tra khả dụng: khách đặt trên Mobile, quản
   trị tạo lịch khách vãng lai, và quản trị sửa lịch. Ba chỗ này viết
   riêng nên không khó chịu: Mobile dùng một câu `start_time < ? AND
   end_time > ?`, quản trị dùng câu khác, và chỉ một chỗ có
   `FOR UPDATE` chống trùng. Hệ quả là có những lúc giao diện báo "còn
   trống" rồi backend lại từ chối vì lý do không liên quan.

   Nay mọi thao tác tạo lịch đi qua đúng một hàm `createBooking` ở đây:
     1. Khoá dòng lịch của nhân viên trong giao dịch
     2. Hỏi lại khả dụng bằng bộ luật ở staff-availability.js
     3. Chụp giá / thời lượng / buffer ngay lúc đặt
     4. Ghi lịch sử

   Nhờ vậy một lịch đặt từ Mobile và một lịch tạo tại quầy là hai thứ
   khác nhau duy nhất ở `source` và thông tin khách. */

import { pool } from '../config/database.js';
import { logEvent } from './booking-events.js';
import {
  checkStaffAvailable, claimStaffForSlot, lockStaffBookings,
} from './staff-availability.js';

/** Ghép ngày 'YYYY-MM-DD' và giờ 'HH:mm' thành Date theo giờ địa phương. */
export function momentOf(day, clock) {
  const [year, month, date] = String(day).split('-').map(Number);
  const [hour, minute] = String(clock).split(':').map(Number);
  return new Date(year, month - 1, date, hour, minute, 0, 0);
}

/** Ngày có đúng định dạng YYYY-MM-DD và tồn tại thật không.
 *
 * Date.parse("2026-02-30T00:00") vẫn pass vì JS tự lăn sang 02/03 —
 * phải đối chiếu ngược từng thành phần mới bắt được ngày không tồn tại. */
export function isDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return false;
  const [, year, month, date] = match.map(Number);
  if (month < 1 || month > 12 || date < 1 || date > 31) return false;
  const built = new Date(year, month - 1, date);
  return built.getFullYear() === year
    && built.getMonth() === month - 1
    && built.getDate() === date;
}

/**
 * Tạo lịch hẹn trong một giao dịch.
 *
 * @param {import('mysql2/promise').PoolConnection} connection giao dịch đang mở
 * @param {object} input
 * @param {number}  input.serviceId
 * @param {number}  [input.staffId]  bỏ trống để backend tự chọn người phù hợp
 * @param {number}  [input.customerId] null với khách chưa có tài khoản
 * @param {string}  [input.guestName] bắt buộc khi không có customerId
 * @param {string}  [input.guestPhone] bắt buộc khi không có customerId
 * @param {Date}    input.startsAt
 * @param {number}  input.duration   thời lượng lúc đặt (phút)
 * @param {number}  input.bufferTime khoảng nghỉ sau dịch vụ (phút)
 * @param {number}  input.price      giá lúc đặt
 * @param {string}  input.source     MOBILE | WALK_IN
 * @param {string}  [input.note]
 * @returns {Promise<{bookingId:number, staffId:number, staffName:string}>}
 * @throws  {Error} kèm `status` và `message` khi không tạo được
 *
 * Bọc ngoài để dịch lỗi deadlock của MySQL thành 409: hai request chen
 * nhau giành khoá nhân viên thì một bên bị database hủy giao dịch — với
 * khách đó chỉ là "khung giờ vừa có người đặt", bấm lại là được, không
 * phải lỗi 500 của máy chủ.
 */
export async function createBooking(connection, input) {
  try {
    return await createBookingTx(connection, input);
  } catch (error) {
    if (error?.code === 'ER_LOCK_DEADLOCK' && !error.status) {
      const busy = new Error('Khung giờ vừa được đặt. Vui lòng chọn giờ khác hoặc thử lại.');
      busy.status = 409;
      throw busy;
    }
    throw error;
  }
}

async function createBookingTx(connection, input) {
  const {
    serviceId, customerId = null, guestName = null, guestPhone = null,
    startsAt, duration, bufferTime, price, source, note = null,
    actorRole = 'CUSTOMER', actorName = null,
  } = input;

  let staffId = Number(input.staffId) || null;
  let staffName = null;

  /* end_time = start + thời lượng + buffer.
     Tức là nhân viên bị chiếm lịch đến cả khoảng nghỉ giữa hai lịch.
     Muốn biết dịch vụ kết thúc lúc nào thì trừ lại buffer — xem
     serviceEndsAt trong API chi tiết lịch. */
  const endsAt = new Date(startsAt.getTime() + (Number(duration) + Number(bufferTime ?? 0)) * 60000);

  /* Không nhận ngày giờ đã qua ở bất kỳ đường nào. */
  if (startsAt <= new Date()) {
    const error = new Error('Không thể đặt lịch trong quá khứ.');
    error.status = 409;
    throw error;
  }

  /* Chặn trùng ở tầng database: khoá dòng lịch của nhân viên trước khi
     hỏi khả dụng. Hai request cùng lúc sẽ phải xếp hàng, không cùng
     nhận một khung giờ. */
  if (staffId) {
    await lockStaffBookings({ connection, staffId, startsAt, endsAt });
  }

  /* Không chỉ định nhân viên: backend tự chọn người ít lịch nhất trong
     ngày. Chọn thật trong giao dịch (khoá + hỏi lại từng người) chứ không
     chỉ "xem" như màn hình khả dụng — nếu không hai khách cùng bấm sẽ
     cùng thấy một người còn trống rồi cùng ghi lịch vào người đó. */
  if (!staffId) {
    const claimed = await claimStaffForSlot({
      connection, serviceId, startsAt, endsAt,
    });
    if (!claimed.ok) {
      const error = new Error(claimed.reason);
      error.status = 409;
      throw error;
    }
    staffId = claimed.staffId;
    staffName = claimed.staffName;
  }

  /* Cổng kiểm tra cuối cho cả hai nhánh (chỉ định người hoặc tự chọn).
     Đọc dưới dạng locking read (xem forUpdate) để thấy lịch vừa được
     request khác commit — nếu không hai request cùng giờ sẽ cùng lọt. */
  const check = await checkStaffAvailable({
    staffId, serviceId, startsAt, endsAt, runner: connection, forUpdate: true,
  });
  if (!check.ok) {
    const error = new Error(`Khung giờ vừa được đặt. ${check.reason}`);
    error.status = 409;
    error.reason = check.reason;
    error.conflict = check.conflict ?? null;
    throw error;
  }
  staffName = staffName ?? check.staffName;

  /* Chụp lại giá, thời lượng và buffer ngay lúc đặt. Sau này Admin đổi
     giá dịch vụ thì lịch này vẫn hiện đúng số tiền khách đã trả —
     đây là điểm khác biệt giữa lịch hẹn và dịch vụ. */
  const [result] = await connection.query(
    `INSERT INTO booking
       (customer_id, guest_name, guest_phone, staff_id, service_id,
        service_price, service_duration, buffer_time,
        start_time, end_time, status, note, source)
     VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING',?,?)`,
    [customerId, guestName, guestPhone, staffId, serviceId,
      price, duration, bufferTime ?? 0,
      startsAt, endsAt, note, source],
  );

  const who = customerId
    ? 'Khách đặt lịch trên ứng dụng Mobile.'
    : `Khách vãng lai tạo lịch tại quầy: ${guestName}.`;

  await logEvent({
    bookingId: result.insertId,
    type: 'CREATED',
    detail: `${who} Dịch vụ nhân viên: ${staffName}.`,
    actorRole,
    actorName,
    connection,
  });

  return { bookingId: result.insertId, staffId, staffName, startsAt, endsAt };
}

/**
 * Đọc dịch vụ và chặn dịch vụ đã ngừng hoạt động.
 * @returns {Promise<{id:number,name:string,price:number,duration:number,bufferTime:number}>}
 */
export async function loadActiveService(runner, serviceId) {
  const [[svc]] = await runner.query(
    `SELECT service_id, service_name, price, duration,
            COALESCE(buffer_time, 0) AS bufferTime, status
       FROM services WHERE service_id = ? LIMIT 1`, [serviceId]);
  if (!svc) {
    const error = new Error('Không tìm thấy dịch vụ.');
    error.status = 404;
    throw error;
  }
  if (svc.status !== 'ACTIVE') {
    const error = new Error('Dịch vụ này đã ngừng hoạt động.');
    error.status = 409;
    throw error;
  }
  return {
    id: Number(svc.service_id),
    name: svc.service_name,
    price: Number(svc.price),
    duration: Number(svc.duration),
    bufferTime: Number(svc.bufferTime),
  };
}

/**
 * Khoá dòng lịch của một người rồi chạy lại kiểm tra khả dụng.
 *
 * Dùng khi quản trị đổi nhân viên hoặc đổi giờ cho một lịch đã có:
 * cần đúng thứ tự này vì `FOR UPDATE` chỉ có tác dụng trong giao dịch.
 */
export async function recheckAfterMove(connection, {
  bookingId, staffId, serviceId, startsAt, duration, bufferTime,
}) {
  const endsAt = new Date(startsAt.getTime() + (Number(duration) + Number(bufferTime ?? 0)) * 60000);
  await lockStaffBookings({ connection, staffId, startsAt, endsAt });
  /* Đọc locking read như nhánh tạo lịch — SELECT thường dưới REPEATABLE
     READ không thấy lịch vừa commit của request khác. */
  const check = await checkStaffAvailable({
    bookingId, staffId, serviceId, startsAt, endsAt, runner: connection, forUpdate: true,
  });
  return { check, endsAt };
}

/** Lấy pool chuẩn — tiện cho các controller không cần giao dịch. */
export { pool };

/**
 * Thời gian phục vụ thực tế (phút): từ mốc nhân viên bấm "bắt đầu"
 * (sự kiện SERVICE_STARTED trong lịch sử) đến lúc bấm "hoàn thành".
 *
 * Trước đây ghi thẳng thời lượng dự kiến: lịch dự kiến 60 phút nhưng
 * làm thật 90 phút vẫn lưu 60, nên báo cáo "thời gian phục vụ thực tế"
 * không thật. Không có mốc bắt đầu (lịch cũ, hoặc Admin hoàn thành
 * thẳng) thì giữ thời lượng dự kiến để không vỡ báo cáo cũ.
 */
export async function actualServiceMinutes(runner, bookingId, fallbackMinutes) {
  const [[row]] = await runner.query(
    `SELECT created_at AS startedAt FROM booking_event
      WHERE booking_id = ? AND event_type = 'SERVICE_STARTED'
      ORDER BY created_at DESC, event_id DESC LIMIT 1`, [bookingId]);
  if (!row?.startedAt) return Number(fallbackMinutes ?? 0);
  const elapsed = Math.round((Date.now() - new Date(row.startedAt).getTime()) / 60000);
  return Math.max(1, elapsed);
}