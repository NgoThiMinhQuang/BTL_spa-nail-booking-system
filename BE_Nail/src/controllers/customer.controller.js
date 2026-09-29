import { pool } from '../config/database.js';

const MAX_NOTE_LENGTH = 2000;

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

/* Hồ sơ đầy đủ của một khách: liên hệ, hồ sơ, chỉ số tích lũy. */
export async function getCustomerDetail(req, res, next) {
  const customerId = validId(req.params.id);
  if (!customerId) return res.status(400).json({ message: 'Mã khách hàng không hợp lệ.' });

  const staffId = validId(req.query.staffId);
  try {
    const [customerRows] = await pool.query(
      `SELECT c.customer_id AS id, u.full_name AS name, u.phone, u.email, u.avatar,
        c.address, DATE_FORMAT(c.birthday,'%d/%m/%Y') AS birthday, c.note,
        c.total_spending, c.no_show_count,
        DATE_FORMAT((SELECT MIN(b.created_at) FROM booking b WHERE b.customer_id = c.customer_id),'%d/%m/%Y') AS memberSince,
        (SELECT COUNT(*) FROM booking b WHERE b.customer_id = c.customer_id) AS totalVisits,
        (SELECT DATE_FORMAT(MAX(b.start_time),'%d/%m/%Y') FROM booking b WHERE b.customer_id = c.customer_id) AS lastVisit,
        COALESCE((SELECT ROUND(AVG(r.rating),1) FROM review r
          JOIN booking b ON b.booking_id = r.booking_id
          WHERE b.customer_id = c.customer_id AND b.staff_id = ?), 0) AS rating,
        (SELECT COUNT(*) FROM review r JOIN booking b ON b.booking_id = r.booking_id
          WHERE b.customer_id = c.customer_id AND b.staff_id = ?) AS reviewCount
      FROM customer c JOIN users u ON u.user_id = c.user_id
      WHERE c.customer_id = ?`,
      [staffId || 0, staffId || 0, customerId],
    );
    const customer = customerRows[0];
    if (!customer) return res.status(404).json({ message: 'Không tìm thấy khách hàng này.' });

    const params = staffId ? [customerId, staffId] : [customerId];
    const [history] = await pool.query(
      `SELECT b.booking_id AS id, DATE_FORMAT(b.start_time,'%Y-%m-%d %H:%i') AS startsAt,
        DATE_FORMAT(b.start_time,'%d/%m/%Y') AS date, TIME_FORMAT(b.start_time,'%H:%i') AS time,
        b.status, s.service_name AS serviceName, s.price, s.duration, b.note,
        r.rating, r.comment
      FROM booking b JOIN services s ON s.service_id = b.service_id
      LEFT JOIN review r ON r.booking_id = b.booking_id
      WHERE b.customer_id = ?${staffId ? ' AND b.staff_id = ?' : ''}
      ORDER BY b.start_time DESC`,
      params,
    );

    res.json({
      data: {
        customer: {
          ...customer,
          id: String(customer.id),
          total_spending: Number(customer.total_spending ?? 0),
          no_show_count: Number(customer.no_show_count ?? 0),
          totalVisits: Number(customer.totalVisits ?? 0),
          rating: Number(customer.rating ?? 0),
          reviewCount: Number(customer.reviewCount ?? 0),
        },
        history: history.map((item) => ({ ...item, id: String(item.id), rating: item.rating === null ? null : Number(item.rating) })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/* Lưu ghi chú nội bộ của nhân viên về khách. */
export async function updateCustomerNote(req, res, next) {
  const customerId = validId(req.params.id);
  if (!customerId) return res.status(400).json({ message: 'Mã khách hàng không hợp lệ.' });

  const note = String(req.body?.note ?? '').trim().slice(0, MAX_NOTE_LENGTH);
  try {
    const [rows] = await pool.query('SELECT customer_id FROM customer WHERE customer_id = ?', [customerId]);
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy khách hàng này.' });
    await pool.query('UPDATE customer SET note = ? WHERE customer_id = ?', [note || null, customerId]);
    res.json({ data: { id: String(customerId), note: note || null } });
  } catch (error) {
    next(error);
  }
}
