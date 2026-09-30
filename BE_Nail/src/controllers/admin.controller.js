/* ===== API khu vực quản trị =====

   Các trang quản trị cần số liệu của TOÀN BỘ cửa hàng, không như app nhân viên
   chỉ lấy phần của một nhân viên. Vì vậy ở đây mọi truy vấn đều bắt đầu từ
   bảng booking/payment/services rồi nối thêm nhân viên và khách hàng. */

import { pool } from '../config/database.js';
import {
  METHOD_TEXT, PAYMENT_TEXT, SOURCE_TEXT, STATUS_TEXT, bookingCode,
} from '../lib/booking-labels.js';

/** Đường dẫn ảnh trong DB là dạng tương đối (/uploads/...), cần ghép thành URL. */
function imageUrl(req, value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  return `${req.protocol}://${req.get('host')}${value.startsWith('/') ? value : `/${value}`}`;
}

/** Ánh xạ một dòng booking sang đúng hình dạng frontend dùng.
    Giữ nguyên tên trường với booking-admin.controller.js để một kiểu Booking
    duy nhất dùng được cả ở Tổng quan lẫn trang Lịch hẹn. */
function mapBooking(row) {
  const addonTotal = Number(row.addonTotal ?? 0);
  return {
    ...row,
    id: String(row.id),
    code: bookingCode(row.id),
    serviceId: String(row.serviceId),
    customerId: String(row.customerId),
    staffId: row.staffId == null ? null : String(row.staffId),
    duration: Number(row.duration),
    price: Number(row.price),
    addonTotal,
    addonCount: Number(row.addonCount ?? 0),
    /* Tổng tiền = giá dịch vụ chính + các dịch vụ phát sinh. */
    total: Number(row.price) + addonTotal,
    paidAmount: row.paidAmount == null ? null : Number(row.paidAmount),
    statusText: STATUS_TEXT[row.status] ?? row.status,
    sourceText: SOURCE_TEXT[row.source] ?? row.source ?? null,
    paymentText: row.paymentStatus ? PAYMENT_TEXT[row.paymentStatus] : null,
    methodText: row.paymentMethod ? METHOD_TEXT[row.paymentMethod] : null,
  };
}

/** Cột chọn chung cho mọi truy vấn lịch hẹn. */
const BOOKING_COLUMNS = `b.booking_id AS id, b.start_time AS startsAt, b.end_time AS endsAt,
        b.status, b.note, b.source,
        b.cancel_reason AS cancelReason, b.cancelled_at AS cancelledAt,
        s.service_id AS serviceId, s.service_name AS serviceName, s.duration, s.price,
        c.customer_id AS customerId, u.full_name AS customerName, u.phone AS customerPhone,
        u.avatar AS customerAvatarUrl,
        st.staff_id AS staffId, su.full_name AS staffName, su.avatar AS staffAvatarUrl,
        pay.payment_status AS paymentStatus, pay.payment_method AS paymentMethod,
        pay.amount AS paidAmount,
        COALESCE(addon.total, 0) AS addonTotal,
        COALESCE(addon.count, 0) AS addonCount`;

const BOOKING_JOINS = `FROM booking b
      JOIN services s ON s.service_id = b.service_id
      JOIN customer c ON c.customer_id = b.customer_id
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      LEFT JOIN (
        SELECT booking_id, SUM(price) AS total, COUNT(*) AS count
        FROM booking_addon GROUP BY booking_id
      ) addon ON addon.booking_id = b.booking_id`;

/* ================================================================
   Bảng điều khiển
   ---------------------------------------------------------------
   Một lần gọi trả về mọi thứ Dashboard cần, đúng thứ tự ưu tiên khi
   Admin vừa mở trang: việc cần xử lý → số lịch hôm nay → lịch kế tiếp →
   ai đang làm → doanh thu → dịch vụ nổi bật.
   ================================================================ */
export async function getOverview(req, res, next) {
  try {
    const range = ['7', '30', 'month'].includes(String(req.query.range)) ? String(req.query.range) : '7';

    /* Khoảng ngày cho biểu đồ doanh thu. Dùng đúng các giá trị này ở mệnh đề
       WHERE nên không có rủi ro chèn chuỗi từ người dùng. */
    const span = range === 'month'
      ? { from: 'DATE_FORMAT(DATE_FORMAT(CURDATE(), \'%Y-%m-01\'), \'%Y-%m-%d\')',
          days: 'TIMESTAMPDIFF(DAY, DATE_FORMAT(CURDATE(), \'%Y-%m-01\'), CURDATE())' }
      : range === '30'
        ? { from: 'DATE_FORMAT(CURDATE() - INTERVAL 29 DAY, \'%Y-%m-%d\')', days: '29' }
        : { from: 'DATE_FORMAT(CURDATE() - INTERVAL 6 DAY, \'%Y-%m-%d\')', days: '6' };

    const [todayRows, staffTotalRows, todayList, staffToday, chartRows, topRows, todoRows] =
      await Promise.all([
        /* Số lịch hẹn hôm nay, tách theo trạng thái. */
        pool.query(`SELECT
            COUNT(*) AS total,
            SUM(b.status = 'PENDING')    AS pending,
            SUM(b.status = 'CONFIRMED')  AS confirmed,
            SUM(b.status = 'PROCESSING') AS processing,
            SUM(b.status = 'COMPLETED')  AS completed,
            SUM(b.status = 'CANCELLED')  AS cancelled,
            SUM(b.status = 'NO_SHOW')    AS noShow
          FROM booking b WHERE DATE(b.start_time) = CURDATE()`),

        pool.query(`SELECT COUNT(*) AS n FROM staff st JOIN users u ON u.user_id = st.user_id
          WHERE u.status = 'ACTIVE'`),

        /* Danh sách lịch hôm nay cho bảng ở Dashboard, 8 dòng gần nhất. */
        pool.query(`SELECT ${BOOKING_COLUMNS} ${BOOKING_JOINS}
          WHERE DATE(b.start_time) = CURDATE()
          ORDER BY b.start_time LIMIT 8`),

        /* Nhân viên hôm nay: ca làm, số lịch, và việc đang phục vụ ai. */
        pool.query(`SELECT
            st.staff_id AS id,
            u.full_name AS name,
            u.avatar AS avatarUrl,
            MIN(sc.start_time) AS shiftStart,
            MAX(sc.end_time) AS shiftEnd,
            (SELECT COUNT(*) FROM booking b WHERE b.staff_id = st.staff_id
              AND DATE(b.start_time) = CURDATE()
              AND b.status IN ('PENDING','CONFIRMED','PROCESSING')) AS bookingCount,
            (SELECT u2.full_name FROM booking b2
              JOIN customer c2 ON c2.customer_id = b2.customer_id
              JOIN users u2 ON u2.user_id = c2.user_id
             WHERE b2.staff_id = st.staff_id AND b2.status = 'PROCESSING'
             ORDER BY b2.start_time DESC LIMIT 1) AS servingNow,
            (SELECT MIN(b3.start_time) FROM booking b3
             WHERE b3.staff_id = st.staff_id AND b3.start_time > NOW()
               AND b3.status IN ('PENDING','CONFIRMED','PROCESSING')) AS nextStart
          FROM staff_schedule sc
          JOIN staff st ON st.staff_id = sc.staff_id
          JOIN users u ON u.user_id = st.user_id
          WHERE sc.work_date = CURDATE() AND u.status = 'ACTIVE'
          GROUP BY st.staff_id, u.full_name, u.avatar
          ORDER BY u.full_name ASC`),

        /* Biểu đồ doanh thu theo khoảng đã chọn. */
        pool.query(`SELECT d.day,
            COALESCE(SUM(b.bookings), 0) AS bookings,
            COALESCE(SUM(b.revenue), 0) AS revenue
          FROM (
            SELECT DATE_FORMAT(DATE_ADD(${span.from}, INTERVAL t.d DAY), '%Y-%m-%d') AS day
            FROM (
              SELECT a.n - b.n AS d
              FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                    UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
                    UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
                    UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
                    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
                    UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27
                    UNION ALL SELECT 28 UNION ALL SELECT 29) a
              CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) b
             ) t
            WHERE t.d BETWEEN 0 AND ${span.days}
          ) d
          LEFT JOIN (
            SELECT DATE_FORMAT(b.start_time, '%Y-%m-%d') AS day,
                   COUNT(*) AS bookings, SUM(s.price) AS revenue
            FROM booking b JOIN services s ON s.service_id = b.service_id
            WHERE b.status = 'COMPLETED'
              AND DATE_FORMAT(b.start_time, '%Y-%m-%d') >= ${span.from}
            GROUP BY DATE_FORMAT(b.start_time, '%Y-%m-%d')
          ) b ON b.day = d.day
          GROUP BY d.day ORDER BY d.day ASC`),

        /* Dịch vụ phổ biến nhất. */
        pool.query(`SELECT s.service_id AS id, s.service_name AS name, c.category_name AS category,
            COUNT(b.booking_id) AS bookings, COALESCE(SUM(s.price), 0) AS revenue
          FROM services s
          JOIN service_category c ON c.category_id = s.category_id
          LEFT JOIN booking b ON b.service_id = s.service_id
          GROUP BY s.service_id, s.service_name, c.category_name
          ORDER BY bookings DESC, revenue DESC LIMIT 5`),

        /* Việc cần xử lý — bốn nhóm vấn đề Admin nên xem ngay.
           LEAVE là từ khoá dành riêng của MySQL nên cột phải đặt tên khác. */
        pool.query(`SELECT
            (SELECT COUNT(*) FROM booking WHERE status = 'PENDING') AS pendingCount,
            (SELECT COUNT(*) FROM staff_schedule
              WHERE work_date = CURDATE() AND status = 'OFF') AS leaveCount,
            (SELECT COUNT(*) FROM payment WHERE payment_status <> 'PAID') AS unpaidCount,
            (SELECT COUNT(*) FROM booking
              WHERE status IN ('PENDING','CONFIRMED') AND staff_id IS NULL) AS unassignedCount`),
      ]);

    const today = todayRows[0][0];

    /* Doanh thu hôm nay chỉ tính payment PAID, không cộng tiền cọc. */
    const [moneyRows] = await pool.query(`SELECT
        COALESCE(SUM(pay.payment_status = 'PAID'), 0) AS paidCount,
        COALESCE(SUM(CASE WHEN pay.payment_status = 'PAID' THEN pay.amount END), 0) AS paidAmount,
        COALESCE(SUM(CASE WHEN pay.payment_status = 'DEPOSITED' THEN pay.amount END), 0) AS depositAmount
      FROM payment pay
      JOIN booking b ON b.booking_id = pay.booking_id
      WHERE DATE(b.start_time) = CURDATE()`);

    const money = moneyRows[0];
    /* todoRows có dạng [rows, fields] nên phải lấy [0][0] mới ra đối tượng. */
const todo = todoRows[0][0];

    /* Trạng thái hiện tại của nhân viên: rảnh, đang phục vụ, sắp có lịch, nghỉ. */
    const staffStatus = (item) => {
      if (!item.shiftStart) return 'OFF';
      if (item.servingNow) return 'BUSY';
      if (item.nextStart) return 'UPCOMING';
      if (item.bookingCount > 0) return 'DONE';
      return 'FREE';
    };

    res.json({
      data: {
        range,
        today: {
          total: Number(today.total ?? 0),
          pending: Number(today.pending ?? 0),
          confirmed: Number(today.confirmed ?? 0),
          processing: Number(today.processing ?? 0),
          completed: Number(today.completed ?? 0),
          cancelled: Number(today.cancelled ?? 0),
          noShow: Number(today.noShow ?? 0),
        },
        /* Số chờ xác nhận tính trên toàn bộ lịch, không chỉ hôm nay —
           đó mới là việc Admin phải xử lý. */
        pendingAll: Number(todo.pendingCount ?? 0),
        staff: { total: Number(staffTotalRows[0][0].n ?? 0) },
        revenue: {
          paidAmount: Number(money.paidAmount ?? 0),
          depositAmount: Number(money.depositAmount ?? 0),
          paidCount: Number(money.paidCount ?? 0),
        },
        todayBookings: todayList[0].map(mapBooking),
        staffToday: staffToday[0].map((item) => ({
          ...item,
          id: String(item.id),
          avatarUrl: imageUrl(req, item.avatarUrl),
          bookingCount: Number(item.bookingCount),
          status: staffStatus(item),
        })),
        chart: chartRows[0].map((row) => ({
          day: row.day,
          bookings: Number(row.bookings),
          revenue: Number(row.revenue),
        })),
        topServices: topRows[0].map((row) => ({
          ...row,
          id: String(row.id),
          bookings: Number(row.bookings),
          revenue: Number(row.revenue),
        })),
        todos: {
          pending: Number(todo.pendingCount ?? 0),
          leave: Number(todo.leaveCount ?? 0),
          unpaid: Number(todo.unpaidCount ?? 0),
          unassigned: Number(todo.unassignedCount ?? 0),
        },
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
        c.description, COUNT(s.service_id) AS serviceCount,
        COALESCE(SUM(s.price), 0) AS totalPrice
      FROM service_category c
      LEFT JOIN services s ON s.category_id = c.category_id
      GROUP BY c.category_id, c.category_name, c.description ORDER BY c.category_name`);

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
          totalPrice: Number(row.totalPrice),
        })),
      },
    });
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
   Yêu cầu nghỉ
   ---------------------------------------------------------------
   Database chưa có bảng yêu cầu nghỉ riêng. Nhân viên nghỉ được ghi bằng
   staff_schedule.status = 'OFF', nên trang này đọc đúng những dòng đó.
   ================================================================ */
export async function listLeaveRequests(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT
        sc.schedule_id AS id,
        sc.work_date AS workDate,
        sc.start_time AS startTime,
        sc.end_time AS endTime,
        u.full_name AS staffName,
        st.specialty,
        (SELECT COUNT(*) FROM booking b WHERE b.staff_id = st.staff_id
          AND DATE(b.start_time) = sc.work_date
          AND b.status IN ('PENDING','CONFIRMED','PROCESSING')) AS affectedBookings
      FROM staff_schedule sc
      JOIN staff st ON st.staff_id = sc.staff_id
      JOIN users u ON u.user_id = st.user_id
      WHERE sc.status = 'OFF'
      ORDER BY sc.work_date DESC, u.full_name ASC
      LIMIT 120`);

    const [counts] = await pool.query(`SELECT
        SUM(sc.work_date = CURDATE()) AS today,
        SUM(sc.work_date > CURDATE()) AS upcoming,
        SUM(sc.work_date < CURDATE()) AS past
      FROM staff_schedule sc WHERE sc.status = 'OFF'`);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        affectedBookings: Number(row.affectedBookings),
      })),
      meta: {
        today: Number(counts[0].today ?? 0),
        upcoming: Number(counts[0].upcoming ?? 0),
        past: Number(counts[0].past ?? 0),
      },
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

/* ================================================================
   Báo cáo — tổng hợp theo dịch vụ, nhân viên và khách hàng
   ================================================================ */
export async function getReports(req, res, next) {
  try {
    const [byService, byStaff, byCustomer, totals] = await Promise.all([
      pool.query(`SELECT s.service_name AS name, c.category_name AS category,
          COUNT(b.booking_id) AS bookings,
          COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' THEN s.price END), 0) AS revenue
        FROM services s
        JOIN service_category c ON c.category_id = s.category_id
        LEFT JOIN booking b ON b.service_id = s.service_id
        GROUP BY s.service_id, s.service_name, c.category_name
        HAVING bookings > 0
        ORDER BY revenue DESC, bookings DESC`),

      pool.query(`SELECT u.full_name AS name, st.specialty,
          COUNT(b.booking_id) AS bookings,
          COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' THEN s.price END), 0) AS revenue
        FROM staff st
        JOIN users u ON u.user_id = st.user_id
        LEFT JOIN booking b ON b.staff_id = st.staff_id
        LEFT JOIN services s ON s.service_id = b.service_id
        GROUP BY st.staff_id, u.full_name, st.specialty
        ORDER BY revenue DESC`),

      pool.query(`SELECT u.full_name AS name, u.phone,
          COUNT(b.booking_id) AS bookings, c.total_spending AS spending
        FROM customer c
        JOIN users u ON u.user_id = c.user_id
        LEFT JOIN booking b ON b.customer_id = c.customer_id
        GROUP BY c.customer_id, u.full_name, u.phone, c.total_spending
        ORDER BY bookings DESC LIMIT 10`),

      pool.query(`SELECT
          COUNT(*) AS bookings,
          SUM(b.status = 'COMPLETED') AS completed,
          SUM(b.status = 'CANCELLED') AS cancelled,
          SUM(b.status = 'NO_SHOW') AS noShow,
          COALESCE(AVG(NULLIF(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time), 0)), 0) AS avgMinutes
        FROM booking b`),
    ]);

    const t = totals[0][0];

    res.json({
      data: {
        byService: byService[0].map((row) => ({
          ...row,
          bookings: Number(row.bookings),
          revenue: Number(row.revenue),
        })),
        byStaff: byStaff[0].map((row) => ({
          ...row,
          bookings: Number(row.bookings),
          revenue: Number(row.revenue),
        })),
        byCustomer: byCustomer[0].map((row) => ({
          ...row,
          bookings: Number(row.bookings),
          spending: Number(row.spending),
        })),
        totals: {
          bookings: Number(t.bookings ?? 0),
          completed: Number(t.completed ?? 0),
          cancelled: Number(t.cancelled ?? 0),
          noShow: Number(t.noShow ?? 0),
          avgMinutes: Math.round(Number(t.avgMinutes ?? 0)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
