import { pool } from '../config/database.js';

function imageUrl(req, path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${req.protocol}://${req.get('host')}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function listServices(req, res, next) {
  try {
    const { category, search } = req.query;
    const conditions = ["s.status = 'ACTIVE'"];
    const params = [];

    if (category) {
      conditions.push('LOWER(c.category_name) = LOWER(?)');
      params.push(category);
    }
    if (search) {
      conditions.push('(s.service_name LIKE ? OR s.description LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    const [rows] = await pool.query(`
      SELECT
        s.service_id AS id,
        s.service_name AS name,
        COALESCE(s.description, '') AS description,
        s.price,
        s.duration,
        s.image AS imageUrl,
        c.category_id AS categoryId,
        c.category_name AS categoryName,
        COALESCE(ROUND(AVG(r.rating), 1), 0) AS rating,
        COUNT(r.review_id) AS reviewCount
      FROM services s
      LEFT JOIN service_category c ON c.category_id = s.category_id
      LEFT JOIN booking b ON b.service_id = s.service_id
      LEFT JOIN review r ON r.booking_id = b.booking_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY s.service_id, c.category_id
      ORDER BY s.service_id DESC
    `, params);

    res.json({ data: rows.map((item) => ({ ...item, imageUrl: imageUrl(req, item.imageUrl) })) });
  } catch (error) {
    next(error);
  }
}

export async function getService(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.service_id AS id,
        s.service_name AS name,
        COALESCE(s.description, '') AS description,
        s.price,
        s.duration,
        s.image AS imageUrl,
        c.category_id AS categoryId,
        c.category_name AS categoryName,
        COALESCE(ROUND(AVG(r.rating), 1), 0) AS rating,
        COUNT(r.review_id) AS reviewCount
      FROM services s
      LEFT JOIN service_category c ON c.category_id = s.category_id
      LEFT JOIN booking b ON b.service_id = s.service_id
      LEFT JOIN review r ON r.booking_id = b.booking_id
      WHERE s.service_id = ? AND s.status = 'ACTIVE'
      GROUP BY s.service_id, c.category_id
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });

    const [imagesResult, benefitsResult, stepsResult, staffResult, reviewsResult, relatedResult] = await Promise.all([
      pool.query('SELECT image_id AS id, image_url AS imageUrl FROM service_images WHERE service_id = ? ORDER BY sort_order, image_id', [req.params.id]),
      pool.query('SELECT benefit_id AS id, title, subtitle, icon, color FROM service_benefits WHERE service_id = ? ORDER BY sort_order, benefit_id', [req.params.id]),
      pool.query('SELECT step_id AS id, step_number AS stepNumber, title, description, estimated_minutes AS estimatedMinutes FROM service_steps WHERE service_id = ? ORDER BY step_number', [req.params.id]),
      pool.query(`SELECT st.staff_id AS id, u.full_name AS name, u.avatar AS avatarUrl,
        st.experience_year AS experienceYears, st.specialty, st.rating
        FROM staff_service ss JOIN staff st ON st.staff_id = ss.staff_id
        JOIN users u ON u.user_id = st.user_id
        WHERE ss.service_id = ? AND u.status = 'ACTIVE'
        ORDER BY st.rating DESC, st.experience_year DESC`, [req.params.id]),
      pool.query(`SELECT r.review_id AS id, u.full_name AS customerName, u.avatar AS customerAvatarUrl,
        r.rating, r.comment, r.image AS imageUrl, r.created_at AS createdAt
        FROM review r JOIN booking b ON b.booking_id = r.booking_id
        JOIN customer c ON c.customer_id = r.customer_id JOIN users u ON u.user_id = c.user_id
        WHERE b.service_id = ? ORDER BY r.created_at DESC LIMIT 10`, [req.params.id]),
      pool.query(`SELECT other.service_id AS id, other.service_name AS name, other.price,
        other.duration, other.image AS imageUrl
        FROM services current CROSS JOIN services other
        WHERE current.service_id = ? AND other.service_id <> current.service_id AND other.status = 'ACTIVE'
        ORDER BY (other.category_id = current.category_id) DESC, other.service_id DESC LIMIT 6`, [req.params.id]),
    ]);

    res.json({ data: {
      ...rows[0],
      imageUrl: imageUrl(req, rows[0].imageUrl),
      images: imagesResult[0].map((item) => ({ ...item, imageUrl: imageUrl(req, item.imageUrl) })),
      benefits: benefitsResult[0],
      steps: stepsResult[0],
      availableStaff: staffResult[0].map((item) => ({ ...item, avatarUrl: imageUrl(req, item.avatarUrl) })),
      reviews: reviewsResult[0].map((item) => ({ ...item, customerAvatarUrl: imageUrl(req, item.customerAvatarUrl), imageUrl: imageUrl(req, item.imageUrl) })),
      relatedServices: relatedResult[0].map((item) => ({ ...item, imageUrl: imageUrl(req, item.imageUrl) })),
    } });
  } catch (error) {
    next(error);
  }
}
