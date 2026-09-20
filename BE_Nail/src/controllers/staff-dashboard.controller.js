import { pool } from '../config/database.js';

export async function staffDashboard(req, res, next) {
  const id = Number(req.params.id);
  const date = String(req.query.date ?? '');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isSafeInteger(id) || id < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ message: 'Nhân viên hoặc ngày không hợp lệ.' });
  }
  try {
    const [[profiles], [bookings], [customers], [services], [shifts]] = await Promise.all([
      pool.query(`SELECT st.staff_id AS id, u.full_name AS name, u.avatar, u.email, u.phone,
        st.specialty, st.experience_year AS experienceYears, st.rating
        FROM staff st JOIN users u ON u.user_id=st.user_id WHERE st.staff_id=? AND u.status='ACTIVE'`, [id]),
      pool.query(`SELECT b.booking_id AS id, DATE_FORMAT(b.start_time,'%Y-%m-%d %H:%i') AS startsAt,
        DATE_FORMAT(b.end_time,'%Y-%m-%d %H:%i') AS endsAt, b.status, b.note,
        u.full_name AS customerName, u.phone, u.avatar, s.service_name AS serviceName, s.duration, s.price
        FROM booking b JOIN customer c ON c.customer_id=b.customer_id JOIN users u ON u.user_id=c.user_id
        JOIN services s ON s.service_id=b.service_id WHERE b.staff_id=? AND b.start_time>=? AND b.start_time<DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY b.start_time`, [id, date, date]),
      pool.query(`SELECT c.customer_id AS id, u.full_name AS name, u.phone, u.avatar, COUNT(*) AS visits,
        DATE_FORMAT(MAX(b.start_time),'%d/%m/%Y') AS lastVisit
        FROM booking b JOIN customer c ON c.customer_id=b.customer_id JOIN users u ON u.user_id=c.user_id
        WHERE b.staff_id=? GROUP BY c.customer_id,u.full_name,u.phone,u.avatar ORDER BY MAX(b.start_time) DESC`, [id]),
      pool.query(`SELECT s.service_id AS id, s.service_name AS name, s.description, s.image, s.price, s.duration,
        c.category_name AS category FROM staff_service ss JOIN services s ON s.service_id=ss.service_id
        LEFT JOIN service_category c ON c.category_id=s.category_id WHERE ss.staff_id=? AND s.status='ACTIVE' ORDER BY s.service_name`, [id]),
      pool.query(`SELECT DATE_FORMAT(work_date,'%Y-%m-%d') AS date, TIME_FORMAT(start_time,'%H:%i') AS start,
        TIME_FORMAT(end_time,'%H:%i') AS end, status FROM staff_schedule WHERE staff_id=? AND work_date>=?
        AND work_date<DATE_ADD(?, INTERVAL 7 DAY) ORDER BY work_date,start_time`, [id, date, date]),
    ]);
    if (!profiles[0]) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });
    res.json({ data: { profile: profiles[0], bookings, customers, services, shifts, date } });
  } catch (error) { next(error); }
}
