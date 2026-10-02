/* ===== Hồ sơ khách hàng phía nhân viên =====

   Nhân viên được xem khách hàng trong những lịch mình phục vụ — không
   phải toàn bộ bảng khách hàng. Trước đây GET /api/staff/customers/:id
   nhận `staffId` tùy ý từ query string: không truyền thì trả về toàn
   bộ lịch sử của khách, tức là nhân viên đọc được dữ liệu của khách
   chưa từng phục vụ ai.

   Nay staffId lấy từ token và mọi truy vấn đều lọc theo nhân viên đó.
   Nhân viên chỉ thấy một khách khi họ từng có lịch với nhân viên này. */

import { pool } from '../config/database.js';

const MAX_NOTE_LENGTH = 2000;

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

/**
 * Nhân viên này có từng phục vụ khách đó không.
 * Không có quan hệ này thì trả 403, không phải trả rỗng — nếu trả rỗng
 * thì nhân viên tưởng khách đó chưa có lịch nào, dễ kết luận sai.
 */
async function hasServed(staffId, customerId) {
  const [[row]] = await pool.query(
    `SELECT 1 FROM booking WHERE staff_id = ? AND customer_id = ? LIMIT 1`,
    [staffId, customerId],
  );
  return Boolean(row);
}

/** Hồ sơ đầy đủ của một khách: liên hệ, hồ sơ, chỉ số tích lũy. */
export async function getCustomerDetail(req, res, next) {
  const customerId = validId(req.params.id);
  if (!customerId) return res.status(400).json({ message: 'Mã khách hàng không hợp lệ.' });

  const staffId = req.user.staffId;

  try {
    /* Chặn ở backend, không dựa vào việc giao diện không mở màn hình này. */
    if (!(await hasServed(staffId, customerId))) {
      return res.status(403).json({
        message: 'Bạn chỉ xem được hồ sơ khách hàng đã từng có lịch với mình.',
      });
    }

    const [customerRows] = await pool.query(
      `SELECT c.customer_id AS id, u.full_name AS name, u.phone, u.email, u.avatar,
        c.address, DATE_FORMAT(c.birthday,'%d/%m/%Y') AS birthday, c.note,
        (SELECT COUNT(*) FROM booking b WHERE b.customer_id = c.customer_id) AS totalVisits,
        (SELECT DATE_FORMAT(MAX(b.start_time),'%d/%m/%Y') FROM booking b
          WHERE b.customer_id = c.customer_id) AS lastVisit,
        COALESCE((SELECT ROUND(AVG(r.rating),1) FROM review r
          JOIN booking b ON b.booking_id = r.booking_id
          WHERE b.customer_id = c.customer_id AND b.staff_id = ?), 0) AS rating,
        (SELECT COUNT(*) FROM review r JOIN booking b ON b.booking_id = r.booking_id
          WHERE b.customer_id = c.customer_id AND b.staff_id = ?) AS reviewCount
      FROM customer c JOIN users u ON u.user_id = c.user_id
      WHERE c.customer_id = ?`,
      [staffId, staffId, customerId],
    );
    const customer = customerRows[0];
    if (!customer) return res.status(404).json({ message: 'Không tìm thấy khách hàng này.' });

    /* Tổng chi tiêu tính từ các khoản đã thu tiền, không đọc cột cache
       customer.total_spending: cột đó không được cập nhật khi thanh toán
       nên đọc vào sẽ ra số lệch với tiền thật khách đã trả. */
    const [spend] = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS total,
              COALESCE(SUM(p.payment_status = 'PAID'), 0) AS paidCount
         FROM payment p JOIN booking b ON b.booking_id = p.booking_id
        WHERE b.customer_id = ? AND p.payment_status = 'PAID'`, [customerId],
    );

    const [history] = await pool.query(
      `SELECT b.booking_id AS id, DATE_FORMAT(b.start_time,'%Y-%m-%d %H:%i') AS startsAt,
        DATE_FORMAT(b.start_time,'%d/%m/%Y') AS date, TIME_FORMAT(b.start_time,'%H:%i') AS time,
        b.status, s.service_name AS serviceName,
        COALESCE(b.service_price, s.price) AS price,
        COALESCE(b.service_duration, s.duration) AS duration,
        b.note, r.rating, r.comment
      FROM booking b
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN review r ON r.booking_id = b.booking_id
      WHERE b.customer_id = ? AND b.staff_id = ?
      ORDER BY b.start_time DESC`,
      [customerId, staffId],
    );

    /* Số lần khách không đến tính trực tiếp từ lịch: đếm trạng thái
       NO_SHOW luôn khớp, không phụ thuộc việc cột cache có được cập
       nhật hay không. */
    const [noshow] = await pool.query(
      `SELECT COUNT(*) AS n FROM booking
        WHERE customer_id = ? AND status = 'NO_SHOW'`, [customerId],
    );

    res.json({
      data: {
        customer: {
          ...customer,
          id: String(customer.id),
          total_spending: Number(spend[0].total ?? 0),
          paid_count: Number(spend[0].paidCount ?? 0),
          no_show_count: Number(noshow[0].n ?? 0),
          totalVisits: Number(customer.totalVisits ?? 0),
          rating: Number(customer.rating ?? 0),
          reviewCount: Number(customer.reviewCount ?? 0),
        },
        history: history.map((item) => ({
          ...item,
          id: String(item.id),
          price: Number(item.price),
          rating: item.rating === null ? null : Number(item.rating),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Ghi chú nội bộ của nhân viên về khách.
 * Chỉ nhân viên phục vụ khách mới ghi được, để nhân viên khác không tự ý
 * sửa thông tin của khách hàng không liên quan tới mình.
 */
export async function updateCustomerNote(req, res, next) {
  const customerId = validId(req.params.id);
  if (!customerId) return res.status(400).json({ message: 'Mã khách hàng không hợp lệ.' });

  const note = String(req.body?.note ?? '').trim().slice(0, MAX_NOTE_LENGTH);
  try {
    if (!(await hasServed(req.user.staffId, customerId))) {
      return res.status(403).json({
        message: 'Bạn chỉ ghi chú được với khách hàng đã từng có lịch với mình.',
      });
    }

    const [rows] = await pool.query(
      'SELECT customer_id FROM customer WHERE customer_id = ?', [customerId],
    );
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy khách hàng này.' });

    await pool.query('UPDATE customer SET note = ? WHERE customer_id = ?', [note || null, customerId]);
    res.json({ data: { id: String(customerId), note: note || null } });
  } catch (error) {
    next(error);
  }
}