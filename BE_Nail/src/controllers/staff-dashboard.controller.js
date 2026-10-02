/* ===== Bảng điều khiển của nhân viên =====

   Trước đây nhân viên chọn bất kỳ ai trong danh sách rồi xem lịch của
   người đó: GET /api/staff-dashboard/:id. Không có đăng nhập nên ai cũng
   xem được lịch của nhân viên khác — kể cả Admin.

   Nay nhân viên chỉ xem được chính mình: staffId lấy từ token. Admin cần
   xem lịch nhân viên khác thì dùng /api/admin/bookings, đã tách riêng
   và có kiểm tra quyền. */

import { pool } from '../config/database.js';

/** Ngày hợp lệ YYYY-MM-DD, mặc định là hôm nay. */
function readDay(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function staffDashboard(req, res, next) {
  const staffId = req.user.staffId;
  const date = readDay(req.query.date);

  if (!staffId) {
    return res.status(403).json({ message: 'Tài khoản này không gắn với hồ sơ nhân viên.' });
  }
  if (!date) return res.status(400).json({ message: 'Ngày không hợp lệ.' });

  try {
    const [[profiles], [bookings], [customers], [services], [shifts], [leave]] = await Promise.all([
      pool.query(
        `SELECT st.staff_id AS id, u.full_name AS name, u.avatar, u.email, u.phone,
          st.specialty, st.experience_year AS experienceYears
         FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE st.staff_id = ? AND u.status = 'ACTIVE'`, [staffId],
      ),

      pool.query(
        `SELECT b.booking_id AS id, DATE_FORMAT(b.start_time,'%Y-%m-%d %H:%i') AS startsAt,
          DATE_FORMAT(b.end_time,'%Y-%m-%d %H:%i') AS endsAt, b.status, b.note,
          b.customer_id AS customerId, DATE_FORMAT(b.created_at,'%d/%m/%Y %H:%i') AS createdAt,
          COALESCE(u.full_name, b.guest_name) AS customerName,
          COALESCE(u.phone, b.guest_phone) AS phone, u.email, u.avatar,
          s.service_name AS serviceName,
          /* Giá và thời lượng lấy từ snapshot trên lịch: đổi giá dịch vụ sau
             này không được làm đổi số tiền của các lịch đã có. */
          COALESCE(b.service_price, s.price) AS price,
          COALESCE(b.service_duration, s.duration) AS duration,
          COALESCE(b.buffer_time, s.buffer_time, 0) AS bufferTime,
          s.image AS serviceImage, s.description AS serviceDescription,
          pay.payment_status AS paymentStatus,
          (SELECT COALESCE(SUM(ba.price * ba.quantity), 0) FROM booking_addon ba
            WHERE ba.booking_id = b.booking_id) AS addonTotal
         FROM booking b
         LEFT JOIN customer c ON c.customer_id = b.customer_id
         LEFT JOIN users u ON u.user_id = c.user_id
         JOIN services s ON s.service_id = b.service_id
         LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        WHERE b.staff_id = ?
          AND b.start_time >= ? AND b.start_time < DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY b.start_time`, [staffId, date, date],
      ),

      /* Chỉ khách của nhân viên này — không phải toàn bộ danh sách khách
         của cửa hàng. */
      pool.query(
        `SELECT c.customer_id AS id, u.full_name AS name, u.phone, u.email, u.avatar,
          c.address, DATE_FORMAT(c.birthday,'%d/%m/%Y') AS birthday, c.note,
          COUNT(b.booking_id) AS visits,
          DATE_FORMAT(MAX(b.start_time),'%d/%m/%Y') AS lastVisit,
          COALESCE((SELECT ROUND(AVG(r.rating),1) FROM review r
            JOIN booking rb ON rb.booking_id = r.booking_id
            WHERE rb.customer_id = c.customer_id AND rb.staff_id = ?),0) AS rating,
          (SELECT COUNT(*) FROM review r JOIN booking rb ON rb.booking_id = r.booking_id
            WHERE rb.customer_id = c.customer_id AND rb.staff_id = ?) AS reviewCount,
          /* Tổng chi tiêu và số lần không đến tính trực tiếp từ lịch và
             thanh toán thật, không đọc cột cache trong bảng customer:
             hai cột cache đó dễ lệch khỏi thực tế. */
          COALESCE((SELECT SUM(p.amount) FROM payment p
            JOIN booking pb ON pb.booking_id = p.booking_id
            WHERE pb.customer_id = c.customer_id AND p.payment_status = 'PAID'), 0) AS totalSpending,
          (SELECT COUNT(*) FROM booking nb WHERE nb.customer_id = c.customer_id
            AND nb.status = 'NO_SHOW') AS noShowCount
         FROM booking b
         JOIN customer c ON c.customer_id = b.customer_id
         JOIN users u ON u.user_id = c.user_id
        WHERE b.staff_id = ? GROUP BY c.customer_id, u.full_name, u.phone, u.email,
            u.avatar, c.address, c.birthday, c.note
        ORDER BY MAX(b.start_time) DESC`, [staffId, staffId, staffId],
      ),

      /* Dịch vụ nhân viên phục vụ được — chỉ đọc, nhân viên không sửa được. */
      pool.query(
        `SELECT s.service_id AS id, s.service_name AS name, s.description, s.image,
          s.price, s.duration, s.status,
          s.category_id AS categoryId, c.category_name AS category
         FROM staff_service ss
         JOIN services s ON s.service_id = ss.service_id
         LEFT JOIN service_category c ON c.category_id = s.category_id
        WHERE ss.staff_id = ? ORDER BY s.status, s.service_name`, [staffId],
      ),

      pool.query(
        `SELECT DATE_FORMAT(work_date,'%Y-%m-%d') AS date,
          TIME_FORMAT(start_time,'%H:%i') AS start,
          TIME_FORMAT(end_time,'%H:%i') AS end, status
         FROM staff_schedule
        WHERE staff_id = ? AND work_date >= ? AND work_date < DATE_ADD(?, INTERVAL 7 DAY)
        ORDER BY work_date, start_time`, [staffId, date, date],
      ),

      /* Khoảng nghỉ đã được duyệt — để nhân viên tự thấy mình nghỉ ngày nào. */
      pool.query(
        `SELECT leave_request_id AS id,
          DATE_FORMAT(start_datetime,'%d/%m/%Y %H:%i') AS fromAt,
          DATE_FORMAT(end_datetime,'%d/%m/%Y %H:%i') AS toAt,
          reason, status
         FROM staff_leave_request
        WHERE staff_id = ? AND status IN ('APPROVED','PENDING')
          AND DATE(end_datetime) >= ? AND DATE(start_datetime) <= DATE_ADD(?, INTERVAL 30 DAY)
        ORDER BY start_datetime LIMIT 20`, [staffId, date, date],
      ),
    ]);

    if (!profiles.length) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ nhân viên.' });
    }

    res.json({
      data: {
        profile: profiles[0],
        /* Promise.all trả về [rows, fields] cho mỗi câu truy vấn, nên
           `bookings` đã là mảng dòng — không cần lấy bookings[0] nữa. */
        bookings: bookings.map((item) => ({
          ...item,
          id: String(item.id),
          customerId: item.customerId == null ? null : String(item.customerId),
          price: Number(item.price),
          duration: Number(item.duration),
          bufferTime: Number(item.bufferTime ?? 0),
          addonTotal: Number(item.addonTotal ?? 0),
          total: Number(item.price) + Number(item.addonTotal ?? 0),
        })),
        customers: customers.map((customer) => ({
          ...customer,
          id: String(customer.id),
          visits: Number(customer.visits ?? 0),
          rating: Number(customer.rating ?? 0),
          reviewCount: Number(customer.reviewCount ?? 0),
          totalSpending: Number(customer.totalSpending ?? 0),
          noShowCount: Number(customer.noShowCount ?? 0),
        })),
        services: services.map((service) => ({
          ...service,
          id: String(service.id),
          categoryId: service.categoryId == null ? null : String(service.categoryId),
          price: Number(service.price ?? 0),
          duration: Number(service.duration ?? 0),
        })),
        shifts,
        leave: leave.map((item) => ({ ...item, id: String(item.id) })),
        date,
      },
    });
  } catch (error) {
    next(error);
  }
}