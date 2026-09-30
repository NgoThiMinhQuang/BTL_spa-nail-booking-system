/* ===== API khu vực quản trị =====

   Các trang quản trị cần số liệu của TOÀN BỘ cửa hàng, không như app nhân viên
   chỉ lấy phần của một nhân viên. Vì vậy ở đây mọi truy vấn đều bắt đầu từ
   bảng booking/payment/services rồi nối thêm nhân viên và khách hàng. */

import { pool } from '../config/database.js';

/** Đường dẫn ảnh trong DB là dạng tương đối (/uploads/...), cần ghép thành URL. */
function imageUrl(req, value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  return `${req.protocol}://${req.get('host')}${value.startsWith('/') ? value : `/${value}`}`;
}

const PAYMENT_TEXT = {
  UNPAID: 'Chưa thanh toán',
  DEPOSITED: 'Đã đặt cọc',
  PAID: 'Đã thanh toán',
};

const METHOD_TEXT = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  ONLINE: 'Thanh toán online',
};

/* ================================================================
   Bảng điều khiển
   ================================================================ */
export async function getOverview(req, res, next) {
  try {
    const [todayRows, staffRows, chartRows, feedRows, topRows] = await Promise.all([
      /* Số lịch hẹn hôm nay, tách theo trạng thái. */
      pool.query(`SELECT
          COUNT(*) AS total,
          SUM(status = 'PENDING')    AS pending,
          SUM(status = 'CONFIRMED')  AS confirmed,
          SUM(status = 'PROCESSING') AS processing,
          SUM(status = 'COMPLETED')  AS completed
        FROM booking WHERE DATE(start_time) = CURDATE()`),

      /* Nhân viên đang có ca hôm nay và tổng số nhân viên. */
      pool.query(`SELECT
          (SELECT COUNT(*) FROM staff st JOIN users u ON u.user_id = st.user_id
            WHERE u.status = 'ACTIVE') AS totalStaff,
          (SELECT COUNT(DISTINCT staff_id) FROM staff_schedule
            WHERE work_date = CURDATE() AND status = 'AVAILABLE') AS onShiftToday`),

      /* Doanh thu 7 ngày gần nhất, tính theo lịch đã hoàn thành. */
      /* Doanh thu 7 ngày gần nhất, tính theo lịch đã hoàn thành. Cột status tồn tại
  ở cả booking lẫn services nên phải ghi rõ tên bảng. Ngày trả về dạng
  chuỗi YYYY-MM-DD để frontend không phụ thuộc múi giờ của máy. */
      pool.query(`SELECT d.day,
          COALESCE(SUM(b.bookings), 0) AS bookings,
          COALESCE(SUM(b.revenue), 0) AS revenue
        FROM (
          SELECT DATE_FORMAT(CURDATE() - INTERVAL t.d DAY, '%Y-%m-%d') AS day
          FROM (SELECT 6 AS d UNION ALL SELECT 5 UNION ALL SELECT 4 UNION ALL SELECT 3
                UNION ALL SELECT 2 UNION ALL SELECT 1 UNION ALL SELECT 0) t
        ) d
        LEFT JOIN (
          SELECT DATE_FORMAT(b.start_time, '%Y-%m-%d') AS day,
                 COUNT(*) AS bookings, SUM(s.price) AS revenue
          FROM booking b JOIN services s ON s.service_id = b.service_id
          WHERE b.status = 'COMPLETED' AND DATE(b.start_time) >= CURDATE() - INTERVAL 6 DAY
          GROUP BY DATE_FORMAT(b.start_time, '%Y-%m-%d')
        ) b ON b.day = d.day
        GROUP BY d.day ORDER BY d.day`),

      /* Bốn lịch hẹn sắp tới, kể từ giờ hiện tại. */
      pool.query(`SELECT b.booking_id AS id, b.start_time AS startsAt, b.end_time AS endsAt,
          b.status, b.note, s.service_name AS serviceName, s.duration, s.price,
          u.full_name AS customerName, su.full_name AS staffName
        FROM booking b
        JOIN services s ON s.service_id = b.service_id
        JOIN customer c ON c.customer_id = b.customer_id
        JOIN users u ON u.user_id = c.user_id
        LEFT JOIN staff st ON st.staff_id = b.staff_id
        LEFT JOIN users su ON su.user_id = st.user_id
        WHERE b.start_time >= NOW() AND b.status IN ('PENDING','CONFIRMED','PROCESSING')
        ORDER BY b.start_time LIMIT 4`),

      /* Năm dịch vụ bán chạy nhất. */
      pool.query(`SELECT s.service_id AS id, s.service_name AS name, c.category_name AS category,
          COUNT(b.booking_id) AS bookings, COALESCE(SUM(s.price), 0) AS revenue
        FROM services s
        JOIN service_category c ON c.category_id = s.category_id
        LEFT JOIN booking b ON b.service_id = s.service_id
        GROUP BY s.service_id, s.service_name, c.category_name
        ORDER BY bookings DESC, revenue DESC LIMIT 5`),
    ]);

    const today = todayRows[0][0];
    const staff = staffRows[0][0];

    /* Doanh thu hôm nay lấy từ thanh toán đã thu, không cộng cả tiền cọc. */
    const [moneyRows] = await pool.query(`SELECT
        COALESCE(SUM(payment_status = 'PAID'), 0)     AS paidCount,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN amount END), 0)     AS paidAmount,
        COALESCE(SUM(CASE WHEN payment_status = 'DEPOSITED' THEN amount END), 0) AS depositAmount
      FROM payment pay
      JOIN booking b ON b.booking_id = pay.booking_id
      WHERE DATE(b.start_time) = CURDATE()`);

    res.json({
      data: {
        today: {
          total: Number(today.total ?? 0),
          pending: Number(today.pending ?? 0),
          confirmed: Number(today.confirmed ?? 0),
          processing: Number(today.processing ?? 0),
          completed: Number(today.completed ?? 0),
        },
        staff: {
          total: Number(staff.totalStaff ?? 0),
          onShift: Number(staff.onShiftToday ?? 0),
        },
        revenue: {
          paidAmount: Number(moneyRows[0].paidAmount ?? 0),
          depositAmount: Number(moneyRows[0].depositAmount ?? 0),
          paidCount: Number(moneyRows[0].paidCount ?? 0),
        },
        chart: chartRows[0].map((row) => ({
          day: row.day,
          bookings: Number(row.bookings),
          revenue: Number(row.revenue),
        })),
        upcoming: feedRows[0].map((row) => ({
          ...row,
          id: String(row.id),
          price: Number(row.price),
          duration: Number(row.duration),
        })),
        topServices: topRows[0].map((row) => ({
          ...row,
          id: String(row.id),
          bookings: Number(row.bookings),
          revenue: Number(row.revenue),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Dịch vụ — toàn bộ dịch vụ kèm số liệu thật
   ================================================================ */
export async function listServices(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT
        s.service_id AS id,
        s.service_name AS name,
        s.description,
        s.price,
        s.duration,
        s.buffer_time AS bufferTime,
        s.status,
        s.image,
        c.category_id AS categoryId,
        c.category_name AS category,
        (SELECT COUNT(*) FROM staff_service ss WHERE ss.service_id = s.service_id) AS staffCount,
        (SELECT GROUP_CONCAT(su.full_name ORDER BY su.full_name SEPARATOR ', ')
           FROM staff_service ss
           JOIN staff st ON st.staff_id = ss.staff_id
           JOIN users su ON su.user_id = st.user_id
          WHERE ss.service_id = s.service_id) AS staffNames,
        (SELECT COUNT(*) FROM booking b WHERE b.service_id = s.service_id) AS bookingCount,
        (SELECT COALESCE(SUM(s2.price), 0) FROM booking b2
          JOIN services s2 ON s2.service_id = b2.service_id
          WHERE s2.service_id = s.service_id AND b2.status = 'COMPLETED') AS revenue,
        (SELECT ROUND(AVG(r.rating), 1) FROM review r
          JOIN booking b3 ON b3.booking_id = r.booking_id
          WHERE b3.service_id = s.service_id) AS rating,
        (SELECT COUNT(*) FROM review r2
          JOIN booking b4 ON b4.booking_id = r2.booking_id
          WHERE b4.service_id = s.service_id) AS reviewCount
      FROM services s
      LEFT JOIN service_category c ON c.category_id = s.category_id
      ORDER BY c.category_name ASC, s.service_name ASC`);

    const [categories] = await pool.query(`SELECT c.category_id AS id, c.category_name AS name,
        COUNT(s.service_id) AS serviceCount
      FROM service_category c
      LEFT JOIN services s ON s.category_id = c.category_id
      GROUP BY c.category_id, c.category_name ORDER BY c.category_name`);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        categoryId: row.categoryId == null ? null : String(row.categoryId),
        price: Number(row.price),
        duration: Number(row.duration),
        bufferTime: Number(row.bufferTime ?? 0),
        staffCount: Number(row.staffCount),
        bookingCount: Number(row.bookingCount),
        revenue: Number(row.revenue),
        reviewCount: Number(row.reviewCount),
        rating: row.rating == null ? null : Number(row.rating),
        imageUrl: imageUrl(req, row.image),
        staffNames: row.staffNames ? row.staffNames.split(', ') : [],
      })),
      meta: {
        categories: categories.map((row) => ({
          ...row,
          id: String(row.id),
          serviceCount: Number(row.serviceCount),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Lịch hẹn của cửa hàng
   ================================================================ */
export async function listBookings(req, res, next) {
  try {
    const status = String(req.query.status ?? '').trim().toUpperCase();
    const staffId = String(req.query.staffId ?? '').trim();
    const day = String(req.query.day ?? '').trim();

    const where = ['1 = 1'];
    const params = [];
    if (status) { where.push('b.status = ?'); params.push(status); }
    if (staffId) { where.push('b.staff_id = ?'); params.push(Number(staffId)); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) { where.push('DATE(b.start_time) = ?'); params.push(day); }

    const [rows] = await pool.query(`SELECT
        b.booking_id AS id, b.start_time AS startsAt, b.end_time AS endsAt,
        b.status, b.note, b.created_at AS createdAt,
        s.service_id AS serviceId, s.service_name AS serviceName, s.duration, s.price,
        c.customer_id AS customerId, u.full_name AS customerName, u.phone AS customerPhone,
        st.staff_id AS staffId, su.full_name AS staffName,
        pay.payment_status, pay.payment_method, pay.amount AS paidAmount
      FROM booking b
      JOIN services s ON s.service_id = b.service_id
      JOIN customer c ON c.customer_id = b.customer_id
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      WHERE ${where.join(' AND ')}
      ORDER BY b.start_time DESC
      LIMIT 200`, params);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        serviceId: String(row.serviceId),
        customerId: String(row.customerId),
        staffId: row.staffId == null ? null : String(row.staffId),
        duration: Number(row.duration),
        price: Number(row.price),
        paidAmount: row.paidAmount == null ? null : Number(row.paidAmount),
        paymentText: row.payment_status ? PAYMENT_TEXT[row.payment_status] : null,
        methodText: row.payment_method ? METHOD_TEXT[row.payment_method] : null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/** Đổi trạng thái lịch hẹn — dùng cho nút duyệt/hủy ở trang Lịch hẹn. */
export async function updateBookingStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status ?? '').trim().toUpperCase();
    const allowed = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!Number.isInteger(id) || !allowed.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái lịch hẹn không hợp lệ.' });
    }

    const [result] = await pool.query('UPDATE booking SET status = ? WHERE booking_id = ?', [status, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });

    res.json({ data: { id: String(id), status } });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Nhân viên
   ================================================================ */
export async function listStaff(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT
        st.staff_id AS id,
        u.full_name AS name,
        u.email,
        u.phone,
        u.avatar AS avatarUrl,
        st.specialty,
        st.experience_year AS experienceYears,
        EXISTS(SELECT 1 FROM staff_schedule sc WHERE sc.staff_id = st.staff_id
          AND sc.work_date = CURDATE() AND sc.status = 'AVAILABLE') AS worksToday,
        (SELECT COUNT(*) FROM booking b WHERE b.staff_id = st.staff_id) AS bookingCount,
        (SELECT COUNT(*) FROM booking b2 WHERE b2.staff_id = st.staff_id
          AND b2.status = 'COMPLETED') AS completedCount,
        (SELECT COALESCE(SUM(s.price), 0) FROM booking b3
          JOIN services s ON s.service_id = b3.service_id
          WHERE b3.staff_id = st.staff_id AND b3.status = 'COMPLETED') AS revenue,
        (SELECT COUNT(*) FROM staff_service ss WHERE ss.staff_id = st.staff_id) AS serviceCount,
        (SELECT GROUP_CONCAT(s.service_name ORDER BY s.service_name SEPARATOR ', ')
          FROM staff_service ss JOIN services s ON s.service_id = ss.service_id
          WHERE ss.staff_id = st.staff_id) AS serviceNames,
        (SELECT ROUND(AVG(r.rating), 1) FROM review r
          JOIN booking b4 ON b4.booking_id = r.booking_id
          WHERE b4.staff_id = st.staff_id) AS rating,
        (SELECT COUNT(*) FROM review r2
          JOIN booking b5 ON b5.booking_id = r2.booking_id
          WHERE b5.staff_id = st.staff_id) AS reviewCount
      FROM staff st
      JOIN users u ON u.user_id = st.user_id
      WHERE u.status = 'ACTIVE'
      ORDER BY bookingCount DESC, u.full_name ASC`);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        avatarUrl: imageUrl(req, row.avatarUrl),
        experienceYears: Number(row.experienceYears ?? 0),
        worksToday: Boolean(row.worksToday),
        bookingCount: Number(row.bookingCount),
        completedCount: Number(row.completedCount),
        revenue: Number(row.revenue),
        serviceCount: Number(row.serviceCount),
        reviewCount: Number(row.reviewCount),
        rating: row.rating == null ? null : Number(row.rating),
        serviceNames: row.serviceNames ? row.serviceNames.split(', ') : [],
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Khách hàng
   ================================================================ */
export async function listCustomers(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT
        c.customer_id AS id,
        u.full_name AS name,
        u.phone,
        u.email,
        u.avatar AS avatarUrl,
        c.total_spending AS totalSpending,
        c.no_show_count AS noShowCount,
        c.address,
        (SELECT COUNT(*) FROM booking b WHERE b.customer_id = c.customer_id) AS bookingCount,
        (SELECT MAX(b2.start_time) FROM booking b2 WHERE b2.customer_id = c.customer_id) AS lastVisit,
        (SELECT ROUND(AVG(r.rating), 1) FROM review r WHERE r.customer_id = c.customer_id) AS rating,
        (SELECT COUNT(*) FROM review r2 WHERE r2.customer_id = c.customer_id) AS reviewCount
      FROM customer c
      JOIN users u ON u.user_id = c.user_id
      ORDER BY bookingCount DESC, u.full_name ASC`);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        avatarUrl: imageUrl(req, row.avatarUrl),
        totalSpending: Number(row.totalSpending ?? 0),
        noShowCount: Number(row.noShowCount ?? 0),
        bookingCount: Number(row.bookingCount),
        reviewCount: Number(row.reviewCount),
        rating: row.rating == null ? null : Number(row.rating),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Lịch làm việc — ma trận nhân viên × ngày
   ================================================================ */
export async function listSchedule(req, res, next) {
  try {
    const from = String(req.query.from ?? '').trim();
    const to = String(req.query.to ?? '').trim();
    const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

    if (!isDate(from) || !isDate(to)) {
      return res.status(400).json({ message: 'Khoảng ngày không hợp lệ.' });
    }

    const [rows] = await pool.query(`SELECT
        st.staff_id AS staffId,
        u.full_name AS staffName,
        u.avatar AS avatarUrl,
        DATE_FORMAT(sc.work_date, '%Y-%m-%d') AS workDate,
        sc.start_time AS startTime,
        sc.end_time AS endTime,
        sc.status,
        (SELECT COUNT(*) FROM booking b WHERE b.staff_id = st.staff_id
          AND DATE(b.start_time) = sc.work_date
          AND b.status IN ('PENDING','CONFIRMED','PROCESSING')) AS bookingCount
      FROM staff_schedule sc
      JOIN staff st ON st.staff_id = sc.staff_id
      JOIN users u ON u.user_id = st.user_id
      WHERE sc.work_date BETWEEN ? AND ?
      ORDER BY u.full_name ASC, sc.work_date ASC, sc.start_time ASC`, [from, to]);

    res.json({
      data: rows.map((row) => ({
        ...row,
        staffId: String(row.staffId),
        avatarUrl: imageUrl(req, row.avatarUrl),
        bookingCount: Number(row.bookingCount),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Đánh giá
   ================================================================ */
export async function listReviews(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT
        r.review_id AS id,
        r.rating,
        r.comment,
        r.created_at AS createdAt,
        u.full_name AS customerName,
        u.avatar AS customerAvatarUrl,
        su.full_name AS staffName,
        s.service_name AS serviceName
      FROM review r
      JOIN customer c ON c.customer_id = r.customer_id
      JOIN users u ON u.user_id = c.user_id
      JOIN booking b ON b.booking_id = r.booking_id
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      ORDER BY r.created_at DESC
      LIMIT 100`);

    const [stats] = await pool.query(`SELECT
        COUNT(*) AS total,
        ROUND(AVG(rating), 1) AS average,
        SUM(rating = 5) AS five,
        SUM(rating = 4) AS four,
        SUM(rating <= 3) AS low
      FROM review`);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        rating: Number(row.rating),
        customerAvatarUrl: imageUrl(req, row.customerAvatarUrl),
      })),
      meta: {
        total: Number(stats[0].total ?? 0),
        average: stats[0].average == null ? null : Number(stats[0].average),
        five: Number(stats[0].five ?? 0),
        four: Number(stats[0].four ?? 0),
        low: Number(stats[0].low ?? 0),
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   Thanh toán & doanh thu
   ================================================================ */
export async function listPayments(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT
        pay.payment_id AS id,
        pay.amount,
        pay.payment_method AS paymentMethod,
        pay.payment_status AS paymentStatus,
        pay.payment_date AS paymentDate,
        b.booking_id AS bookingId,
        b.start_time AS startsAt,
        s.service_name AS serviceName,
        u.full_name AS customerName,
        su.full_name AS staffName
      FROM payment pay
      JOIN booking b ON b.booking_id = pay.booking_id
      JOIN services s ON s.service_id = b.service_id
      JOIN customer c ON c.customer_id = b.customer_id
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      ORDER BY COALESCE(pay.payment_date, b.start_time) DESC
      LIMIT 200`);

    /* Tổng hợp theo tháng để vẽ biểu đồ cột ở trang Doanh thu. */
    const [months] = await pool.query(`SELECT
        DATE_FORMAT(b.start_time, '%Y-%m') AS month,
        SUM(pay.payment_status = 'PAID') AS paidCount,
        COALESCE(SUM(CASE WHEN pay.payment_status = 'PAID' THEN pay.amount END), 0) AS paidAmount,
        COALESCE(SUM(pay.amount), 0) AS totalAmount
      FROM payment pay
      JOIN booking b ON b.booking_id = pay.booking_id
      GROUP BY DATE_FORMAT(b.start_time, '%Y-%m')
      ORDER BY month DESC LIMIT 6`);

    const [totals] = await pool.query(`SELECT
        COALESCE(SUM(amount), 0) AS allAmount,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN amount END), 0) AS paidAmount,
        COALESCE(SUM(CASE WHEN payment_status = 'DEPOSITED' THEN amount END), 0) AS depositAmount,
        COALESCE(SUM(CASE WHEN payment_status = 'UNPAID' THEN amount END), 0) AS unpaidAmount
      FROM payment`);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        bookingId: String(row.bookingId),
        amount: Number(row.amount),
        methodText: METHOD_TEXT[row.paymentMethod] ?? row.paymentMethod,
        statusText: PAYMENT_TEXT[row.paymentStatus] ?? row.paymentStatus,
      })),
      meta: {
        months: months.reverse().map((row) => ({
          month: row.month,
          paidCount: Number(row.paidCount),
          paidAmount: Number(row.paidAmount),
          totalAmount: Number(row.totalAmount),
        })),
        totals: {
          all: Number(totals[0].allAmount ?? 0),
          paid: Number(totals[0].paidAmount ?? 0),
          deposit: Number(totals[0].depositAmount ?? 0),
          unpaid: Number(totals[0].unpaidAmount ?? 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
