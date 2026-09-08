import { pool } from '../config/database.js';

function imageUrl(req, path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${req.protocol}://${req.get('host')}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function getHome(req, res, next) {
  try {
    const customerId = Number(req.query.customerId ?? 1);
    const [customerResult, bannerResult, servicesResult, designsResult, artistsResult, appointmentResult] = await Promise.all([
      pool.query(`SELECT c.customer_id AS id, u.full_name AS name, u.avatar
        FROM customer c JOIN users u ON u.user_id = c.user_id
        WHERE c.customer_id = ? AND u.status = 'ACTIVE' LIMIT 1`, [customerId]),
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
      pool.query(`SELECT st.staff_id AS id, u.full_name AS name, u.avatar, st.experience_year AS experienceYears,
          st.specialty, st.rating, (st.experience_year >= 5) AS expert
        FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE u.status = 'ACTIVE' ORDER BY st.rating DESC, st.experience_year DESC LIMIT 6`),
      pool.query(`SELECT b.booking_id AS id, s.service_name AS serviceName, s.image AS image,
          b.start_time AS startsAt, b.status, u.full_name AS staffName
        FROM booking b JOIN services s ON s.service_id = b.service_id
        LEFT JOIN staff st ON st.staff_id = b.staff_id LEFT JOIN users u ON u.user_id = st.user_id
        WHERE b.customer_id = ? AND b.start_time >= NOW() AND b.status IN ('PENDING', 'CONFIRMED')
        ORDER BY b.start_time ASC LIMIT 1`, [customerId]),
    ]);

    const customer = customerResult[0][0] ?? null;
    const banner = bannerResult[0][0] ?? null;
    const appointment = appointmentResult[0][0] ?? null;

    res.json({
      data: {
        customer: customer ? { ...customer, avatarUrl: imageUrl(req, customer.avatar) } : null,
        banner: banner ? { ...banner, imageUrl: imageUrl(req, banner.image) } : null,
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
