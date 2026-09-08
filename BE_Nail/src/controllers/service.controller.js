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
    res.json({ data: { ...rows[0], imageUrl: imageUrl(req, rows[0].imageUrl) } });
  } catch (error) {
    next(error);
  }
}
