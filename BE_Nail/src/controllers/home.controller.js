import { pool } from '../config/database.js';
import { loadUserFromToken, readToken, verifyToken } from '../lib/auth.js';

function imageUrl(req, path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${req.protocol}://${req.get('host')}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function getHome(req, res, next) {
  try {
    /* Phần công khai (banner, dịch vụ, mẫu nail, nhân viên) ai cũng xem
       được để khách dạo trước khi đăng ký. Phần cá nhân (hồ sơ, lịch sắp
       tới) chỉ trả cho đúng người đang đăng nhập — lấy từ token, KHÔNG
       lấy customerId từ query. Trước đây query customerId nên chỉ cần
       đổi con số là đọc được tên, email, số điện thoại và lịch hẹn của
       khách khác. */
    let customerId = null;
    /* Token hỏng/hết hạn thì coi như khách vãng lai (chỉ xem phần công
       khai). Tách hai bước: verify chữ ký không chạm DB nên lỗi nào cũng
       nuốt được; tra hồ sơ chạm DB nên để lỗi hiện ra 500 thay vì giả vờ
       200 che sự cố database. */
    try {
      const token = readToken(req);
      const payload = token ? verifyToken(token) : null;
      if (payload?.sub) {
        const user = await loadUserFromToken(token);
        if (user?.role === 'CUSTOMER') customerId = user.customerId;
      }
    } catch {
      customerId = null;
    }

    const [bannerResult, servicesResult, designsResult, artistsResult] = await Promise.all([
      pool.query(`SELECT promotion_id AS id, title, subtitle, button_text AS buttonText, image, discount_percent AS discountPercent
        FROM promotions WHERE status = 'ACTIVE' AND NOW() BETWEEN start_date AND end_date
        ORDER BY created_at DESC LIMIT 1`),
      pool.query(`SELECT s.service_id AS id, s.service_name AS name, COALESCE(s.description, '') AS description,
          s.price, s.duration, s.image AS imageUrl, c.category_id AS categoryId, c.category_name AS categoryName,
          COALESCE(ROUND(AVG(r.rating), 1), 0) AS rating, COUNT(r.review_id) AS reviewCount
        FROM services s LEFT JOIN service_category c ON c.category_id = s.category_id
        LEFT JOIN booking b ON b.service_id = s.service_id LEFT JOIN review r ON r.booking_id = b.booking_id
        WHERE s.status = 'ACTIVE' GROUP BY s.service_id, c.category_id ORDER BY rating DESC, s.service_id DESC LIMIT 6`),
      pool.query(`SELECT design_id AS id, design_name AS name, image
        FROM nail_designs WHERE status = 'ACTIVE' AND is_trending = TRUE ORDER BY created_at DESC LIMIT 8`),
      /* Điểm đánh giá tính trực tiếp từ review, không đọc cột cache ở
         bảng staff (cột đó đã bị bỏ). Nhân viên chưa có đánh giá thì hiện
         null chứ không hiện 0 — 0 sao và "chưa đánh giá" là hai thứ khác. */
      pool.query(`SELECT st.staff_id AS id, u.full_name AS name, u.avatar,
          st.experience_year AS experienceYears, st.specialty,
          (st.experience_year >= 5) AS expert,
          (SELECT ROUND(AVG(r.rating), 1) FROM review r
             JOIN booking b ON b.booking_id = r.booking_id
            WHERE b.staff_id = st.staff_id) AS rating,
          (SELECT COUNT(*) FROM review r2
             JOIN booking b2 ON b2.booking_id = r2.booking_id
            WHERE b2.staff_id = st.staff_id) AS reviewCount
        FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE u.status = 'ACTIVE'
        ORDER BY rating DESC, st.experience_year DESC LIMIT 6`),
    ]);

    let customer = null;
    let appointment = null;
    if (customerId) {
      const [customerRows] = await pool.query(
        `SELECT c.customer_id AS id, u.full_name AS name, u.email, u.phone, u.avatar
           FROM customer c JOIN users u ON u.user_id = c.user_id
          WHERE c.customer_id = ? AND u.status = 'ACTIVE' LIMIT 1`, [customerId]);
      const [appointmentRows] = await pool.query(
        `SELECT b.booking_id AS id, s.service_name AS serviceName, s.image AS image,
            b.start_time AS startsAt, b.status, u.full_name AS staffName
           FROM booking b JOIN services s ON s.service_id = b.service_id
          LEFT JOIN staff st ON st.staff_id = b.staff_id LEFT JOIN users u ON u.user_id = st.user_id
          WHERE b.customer_id = ? AND b.start_time >= NOW() AND b.status IN ('PENDING', 'CONFIRMED')
          ORDER BY b.start_time ASC LIMIT 1`, [customerId]);
      customer = customerRows[0] ?? null;
      appointment = appointmentRows[0] ?? null;
    }

    res.json({
      data: {
        customer: customer ? { ...customer, avatarUrl: imageUrl(req, customer.avatar) } : null,
        banner: (() => {
          const row = bannerResult[0][0] ?? null;
          return row ? { ...row, imageUrl: imageUrl(req, row.image) } : null;
        })(),
        featuredServices: servicesResult[0].map((item) => ({ ...item, imageUrl: imageUrl(req, item.imageUrl) })),
        trendingDesigns: designsResult[0].map((item) => ({ ...item, imageUrl: imageUrl(req, item.image) })),
        featuredArtists: artistsResult[0].map((item) => ({ ...item, avatarUrl: imageUrl(req, item.avatar), expert: Boolean(item.expert) })),
        upcomingAppointment: appointment ? { ...appointment, imageUrl: imageUrl(req, appointment.image) } : null,
      },
    });
  } catch (error) {
    next(error);
  }
}
