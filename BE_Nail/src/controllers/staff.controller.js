import { pool } from '../config/database.js';

function imageUrl(req, value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  return `${req.protocol}://${req.get('host')}${value.startsWith('/') ? value : `/${value}`}`;
}

export async function listStaff(req, res, next) {
  try {
    const [staffRows, serviceRows] = await Promise.all([
      pool.query(`SELECT st.staff_id AS id, u.full_name AS name, u.avatar AS avatarUrl,
          st.experience_year AS experienceYears, st.specialty, st.rating,
          (SELECT COUNT(*) FROM booking b JOIN review r ON r.booking_id = b.booking_id
            WHERE b.staff_id = st.staff_id) AS reviewCount,
          EXISTS(SELECT 1 FROM staff_schedule sc WHERE sc.staff_id = st.staff_id
            AND sc.work_date = CURRENT_DATE()) AS worksToday
        FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE u.status = 'ACTIVE'
        ORDER BY st.rating DESC, st.experience_year DESC, u.full_name ASC`),
      pool.query(`SELECT ss.staff_id AS staffId, s.service_id AS id, s.service_name AS name,
          c.category_name AS categoryName
        FROM staff_service ss JOIN services s ON s.service_id = ss.service_id
        LEFT JOIN service_category c ON c.category_id = s.category_id
        WHERE s.status = 'ACTIVE' ORDER BY s.service_name ASC`),
    ]);

    const servicesByStaff = new Map();
    for (const service of serviceRows[0]) {
      const key = String(service.staffId);
      if (!servicesByStaff.has(key)) servicesByStaff.set(key, []);
      servicesByStaff.get(key).push({ id: String(service.id), name: service.name, categoryName: service.categoryName });
    }

    res.json({
      data: staffRows[0].map((staff) => ({
        ...staff,
        id: String(staff.id),
        avatarUrl: imageUrl(req, staff.avatarUrl),
        experienceYears: Number(staff.experienceYears),
        rating: Number(staff.rating ?? 0),
        reviewCount: Number(staff.reviewCount),
        worksToday: Boolean(staff.worksToday),
        services: servicesByStaff.get(String(staff.id)) ?? [],
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getStaff(req, res, next) {
  try {
    const staffId = Number(req.params.id);
    if (!Number.isInteger(staffId) || staffId <= 0) return res.status(400).json({ message: 'Mã nhân viên không hợp lệ' });

    const [staffResult, servicesResult, portfolioResult, reviewsResult] = await Promise.all([
      pool.query(`SELECT st.staff_id AS id, u.full_name AS name, u.avatar AS avatarUrl,
          st.experience_year AS experienceYears, st.specialty, st.rating,
          (SELECT COUNT(*) FROM booking b JOIN review r ON r.booking_id = b.booking_id
            WHERE b.staff_id = st.staff_id) AS reviewCount,
          EXISTS(SELECT 1 FROM staff_schedule sc WHERE sc.staff_id = st.staff_id
            AND sc.work_date = CURRENT_DATE()) AS worksToday
        FROM staff st JOIN users u ON u.user_id = st.user_id
        WHERE st.staff_id = ? AND u.status = 'ACTIVE' LIMIT 1`, [staffId]),
      pool.query(`SELECT s.service_id AS id, s.service_name AS name, c.category_name AS categoryName
        FROM staff_service ss JOIN services s ON s.service_id = ss.service_id
        LEFT JOIN service_category c ON c.category_id = s.category_id
        WHERE ss.staff_id = ? AND s.status = 'ACTIVE' ORDER BY s.service_name`, [staffId]),
      pool.query(`SELECT DISTINCT COALESCE(si.image_url, s.image) AS imageUrl, s.service_name AS serviceName
        FROM staff_service ss JOIN services s ON s.service_id = ss.service_id
        LEFT JOIN service_images si ON si.service_id = s.service_id
        WHERE ss.staff_id = ? AND s.status = 'ACTIVE' AND COALESCE(si.image_url, s.image) IS NOT NULL
        ORDER BY s.service_name LIMIT 8`, [staffId]),
      pool.query(`SELECT r.review_id AS id, u.full_name AS customerName, u.avatar AS customerAvatarUrl,
          r.rating, r.comment, r.image AS imageUrl, r.created_at AS createdAt
        FROM booking b JOIN review r ON r.booking_id = b.booking_id
        JOIN customer c ON c.customer_id = b.customer_id JOIN users u ON u.user_id = c.user_id
        WHERE b.staff_id = ? ORDER BY r.created_at DESC LIMIT 10`, [staffId]),
    ]);

    const staff = staffResult[0][0];
    if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    res.json({ data: {
      ...staff,
      id: String(staff.id), avatarUrl: imageUrl(req, staff.avatarUrl),
      experienceYears: Number(staff.experienceYears), rating: Number(staff.rating ?? 0),
      reviewCount: Number(staff.reviewCount), worksToday: Boolean(staff.worksToday),
      services: servicesResult[0].map((item) => ({ ...item, id: String(item.id) })),
      portfolio: portfolioResult[0].map((item) => ({ ...item, imageUrl: imageUrl(req, item.imageUrl) })),
      reviews: reviewsResult[0].map((item) => ({ ...item, id: String(item.id), rating: Number(item.rating), customerAvatarUrl: imageUrl(req, item.customerAvatarUrl), imageUrl: imageUrl(req, item.imageUrl) })),
    }});
  } catch (error) { next(error); }
}
