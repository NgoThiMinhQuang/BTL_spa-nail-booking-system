/* ===== API phục vụ tạo lịch khách walk-in =====

   Walk-in phải đi đúng con đường với lịch đặt từ ứng dụng: cùng bảng
   booking, cùng kiểm tra khả dụng của nhân viên, cùng bộ chụp giá. Khác
   duy nhất là khách có thể chưa có tài khoản, khi đó tên và số điện thoại
   nằm ngay trên lịch (guest_name, guest_phone) thay vì trỏ tới hồ sơ
   khách. */

/* Số điện thoại Việt Nam: 10 số bắt đầu bằng 0, hoặc dạng +84 đã bỏ ký
   hiệu. Dùng chung cho cả giao diện và backend. */
import { pool } from '../config/database.js';
import { clockOf } from '../lib/booking-labels.js';
import {
  freeSlotsForAnyStaff,
  freeSlotsForStaff,
} from '../lib/staff-availability.js';

/** Đường dẫn ảnh trong DB là dạng tương đối, cần ghép thành URL đầy đủ. */
function imageUrl(req, value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  return `${req.protocol}://${req.get('host')}${value.startsWith('/') ? value : `/${value}`}`;
}

export function normalisePhone(value) {
  const digits = String(value ?? '').replace(/[\s.\-()]/g, '');
  if (/^\+?84\d{9}$/.test(digits)) return `0${digits.slice(-9)}`;
  return digits;
}

export function isValidPhone(value) {
  return /^0\d{9}$/.test(normalisePhone(value));
}

/** Tìm khách theo số điện thoại để tái dùng hồ sơ đã có. */
export async function lookupCustomer(req, res, next) {
  try {
    const phone = normalisePhone(req.query.phone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Số điện thoại chưa đúng định dạng.' });
    }

    const [[row]] = await pool.query(
      `SELECT c.customer_id, u.full_name AS name, u.phone, u.email, u.avatar, u.status
         FROM customer c JOIN users u ON u.user_id = c.user_id
        WHERE u.phone = ? LIMIT 1`, [phone]);

    res.json({ data: row ? {
      id: String(row.customer_id),
      code: `CUS${String(row.customer_id).padStart(4, '0')}`,
      name: row.name,
      phone: row.phone,
      email: row.email,
      avatarUrl: imageUrl(req, row.avatar),
      status: row.status,
    } : null });
  } catch (error) {
    next(error);
  }
}

/**
 * Nhân viên làm được một dịch vụ trong một ngày.
 *
 * Chỉ trả về người thỏa cả ba điều kiện: tài khoản còn hoạt động, được
 * gán dịch vụ này, và có ca làm việc đúng ngày đó — đúng như nghiệp vụ bắt
 * buộc chọn theo thứ tự Dịch vụ → Ngày → Nhân viên → Khung giờ. Người không
 * thỏa điều kiện thì không đưa vào danh sách chứ không đưa vào rồi khoá.
 *
 * `freeOnly` lọc tiếp những người còn khung giờ trống đủ cho dịch vụ.
 */
export async function listEligibleStaff(req, res, next) {
  try {
    const serviceId = Number(req.query.serviceId);
    const day = String(req.query.day ?? '');
    if (!Number.isInteger(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({ message: 'Cần mã dịch vụ và ngày.' });
    }

    const [rows] = await pool.query(`SELECT
        st.staff_id AS id,
        u.full_name AS name,
        u.avatar AS avatarUrl,
        st.specialty,
        st.experience_year AS experienceYears,
        (SELECT ROUND(AVG(r.rating), 1) FROM review r
           JOIN booking b2 ON b2.booking_id = r.booking_id
          WHERE b2.staff_id = st.staff_id) AS rating,
        (SELECT COUNT(*) FROM review r2
           JOIN booking b3 ON b3.booking_id = r2.booking_id
          WHERE b3.staff_id = st.staff_id) AS reviewCount,
        sc.start_time AS shiftStart, sc.end_time AS shiftEnd
      FROM staff st
      JOIN users u ON u.user_id = st.user_id
      JOIN staff_service ss ON ss.staff_id = st.staff_id AND ss.service_id = ?
      JOIN staff_schedule sc ON sc.staff_id = st.staff_id
                          AND sc.work_date = ? AND sc.status = 'AVAILABLE'
      WHERE u.status = 'ACTIVE'
      ORDER BY u.full_name`, [serviceId, day]);

    const data = rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      avatarUrl: imageUrl(req, row.avatarUrl),
      specialty: row.specialty,
      experienceYears: Number(row.experienceYears ?? 0),
      rating: row.rating == null ? null : Number(row.rating),
      reviewCount: Number(row.reviewCount ?? 0),
      shiftStart: clockOf(row.shiftStart),
      shiftEnd: clockOf(row.shiftEnd),
    }));

    /* freeOnly: chỉ giữ người còn ít nhất một khung giờ trống đủ cho dịch vụ
       + buffer. Gọi lại đúng hàm sinh khung giờ của hệ thống thay vì tự
       đoán, nếu không danh sách ở đây sẽ lệch với những gì lúc tạo lịch
       backend thực sự cho phép. */
    if (String(req.query.freeOnly ?? '') === '1') {
      const keep = [];
      for (const person of data) {
        const free = await freeSlotsForStaff({
          staffId: person.id, serviceId, day, stepMinutes: 30,
        });
        if (free.length) keep.push({ ...person, slotCount: free.length });
      }
      return res.json({ data: keep });
    }

    res.json({ data });
  } catch (error) {
    next(error);
  }
}

/**
 * Khung giờ khả dụng của ngày đã chọn.
 *
 * Bỏ `staffId` thì lấy giờ mà BẤT KỲ ứng viên nào cũng nhận được — đó là
 * lựa chọn "Bất kỳ nhân viên phù hợp". Người thật sự nhận lịch do backend
 * chọn lúc tạo, vì lúc đó mới là lúc đặt chỗ thật.
 */
export async function walkInSlots(req, res, next) {
  try {
    const serviceId = Number(req.query.serviceId);
    const day = String(req.query.day ?? '');
    const staffId = req.query.staffId ? Number(req.query.staffId) : null;
    if (!Number.isInteger(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(day)
      || (staffId !== null && !Number.isInteger(staffId))) {
      return res.status(400).json({ message: 'Cần dịch vụ và ngày.' });
    }

    if (staffId === null) {
      const any = await freeSlotsForAnyStaff({ serviceId, day, stepMinutes: 30 });
      return res.json({
        data: any.slots,
        meta: { count: any.slots.length, staffCount: any.staffCount, anyStaff: true },
      });
    }

    const slots = await freeSlotsForStaff({ staffId, serviceId, day, stepMinutes: 30 });
    res.json({ data: slots, meta: { count: slots.length, anyStaff: false } });
  } catch (error) {
    next(error);
  }
}

/**
 * Ngày đã qua thì không cho đặt.
 * Dùng ngày theo giờ máy để khớp với CURDATE() của MySQL.
 */
export function isPastDay(day) {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const date = String(today.getDate()).padStart(2, '0');
  return day < `${today.getFullYear()}-${month}-${date}`;
}