/* ===== API khu vực quản trị =====

   Các trang quản trị cần số liệu của TOÀN BỘ cửa hàng, không như app nhân viên
   chỉ lấy phần của một nhân viên. Vì vậy ở đây mọi truy vấn đều bắt đầu từ
   bảng booking/payment/services rồi nối thêm nhân viên và khách hàng. */

import { pool } from '../config/database.js';
import { escapeLike } from '../lib/sql.js';
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
        b.guest_name, b.guest_phone,
        s.service_id AS serviceId, s.service_name AS serviceName, s.duration, s.price,
        c.customer_id AS customerId,
        COALESCE(u.full_name, b.guest_name) AS customerName,
        COALESCE(u.phone, b.guest_phone) AS customerPhone,
        u.avatar AS customerAvatarUrl,
        st.staff_id AS staffId, su.full_name AS staffName, su.avatar AS staffAvatarUrl,
        pay.payment_status AS paymentStatus, pay.payment_method AS paymentMethod,
        pay.amount AS paidAmount,
        COALESCE(addon.total, 0) AS addonTotal,
        COALESCE(addon.count, 0) AS addonCount`;

const BOOKING_JOINS = `FROM booking b
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN customer c ON c.customer_id = b.customer_id
      LEFT JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      LEFT JOIN (
        /* price * quantity — dịch vụ phát sinh có số lượng, cộng SUM(price)
           sẽ tính thiếu tiền khi khách chọn nhiều món cùng loại. */
        SELECT booking_id, SUM(price * quantity) AS total, COUNT(*) AS count
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

        /* Biểu đồ doanh thu theo khoảng đã chọn.
           Bảng ngày được sinh ra từ một dãy số 0..29 trừ dãy 0..6, nên phải
           DISTINCT: nếu không, mỗi ngày sẽ xuất hiện 7 lần và SUM ở ngoài sẽ
           cộng doanh thu lên 7 lần.

           DOANH THU CHỈ TÍNH LỊCH ĐÃ THU TIỀN. Trước đây câu này lấy
           SUM(s.price) của mọi lịch COMPLETED, nên một lịch đã làm xong
           mà khách chưa trả vẫn bị tính vào doanh thu — số liệu ra lớn hơn
           thực tế. Nay lấy từ payment có trạng thái PAID, và lấy giá chụp
           trên chính lịch chứ không lấy giá hiện tại của dịch vụ. */
        pool.query(`SELECT d.day,
            COALESCE(SUM(b.bookings), 0) AS bookings,
            COALESCE(SUM(b.revenue), 0) AS revenue
          FROM (
            SELECT DATE_FORMAT(DATE_ADD(${span.from}, INTERVAL t.d DAY), '%Y-%m-%d') AS day
            FROM (
              SELECT DISTINCT a.n - b.n AS d
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
            SELECT day, COUNT(*) AS bookings, SUM(amount) AS revenue
              FROM (
                SELECT DATE_FORMAT(b.start_time, '%Y-%m-%d') AS day,
                       b.booking_id, p.amount
                  FROM booking b
                  JOIN payment p ON p.booking_id = b.booking_id
                 WHERE p.payment_status = 'PAID'
                   AND b.status = 'COMPLETED'
                   AND DATE_FORMAT(b.start_time, '%Y-%m-%d') >= ${span.from}
              ) x
             GROUP BY day
          ) b ON b.day = d.day
          GROUP BY d.day ORDER BY d.day ASC`),

        /* Dịch vụ nổi bật TRONG KHOẢNG ĐANG CHỌN (cùng from với biểu đồ):
           lượt = lịch COMPLETED, doanh thu = COMPLETED + PAID theo ngày
           thực hiện dịch vụ. Trước đây thiếu cả hai điều kiện nên chọn
           7 ngày mà top dịch vụ vẫn là toàn bộ lịch sử. */
        pool.query(`SELECT s.service_id AS id, s.service_name AS name, c.category_name AS category,
            COUNT(DISTINCT CASE WHEN b.status = 'COMPLETED' THEN b.booking_id END) AS bookings,
            COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND p.payment_status = 'PAID'
                              THEN p.amount ELSE 0 END), 0) AS revenue
          FROM services s
          JOIN service_category c ON c.category_id = s.category_id
          LEFT JOIN booking b ON b.service_id = s.service_id
            AND DATE_FORMAT(b.start_time, '%Y-%m-%d') >= ${span.from}
            AND DATE_FORMAT(b.start_time, '%Y-%m-%d') <= CURDATE()
          LEFT JOIN payment p ON p.booking_id = b.booking_id
          GROUP BY s.service_id, s.service_name, c.category_name
          ORDER BY bookings DESC, revenue DESC LIMIT 5`),

        /* Việc cần xử lý — bốn nhóm vấn đề Admin nên xem ngay.
           LEAVE là từ khoá dành riêng của MySQL nên cột phải đặt tên khác.
           Phần "nghỉ" đếm yêu cầu nghỉ chờ duyệt, đúng với bảng
           staff_leave_request mới có. */
        pool.query(`SELECT
            (SELECT COUNT(*) FROM booking WHERE status = 'PENDING') AS pendingCount,
            (SELECT COUNT(*) FROM staff_leave_request WHERE status = 'PENDING') AS leaveCount,
            (SELECT COUNT(*) FROM staff_schedule_request WHERE status = 'PENDING') AS scheduleCount,
            /* Lịch cần thu tiền mà chưa PAID — gồm cả lịch chưa có dòng
               payment (đếm trên payment sẽ bỏ sót chúng). */
            (SELECT COUNT(*) FROM booking b
              LEFT JOIN payment p ON p.booking_id = b.booking_id
             WHERE b.status NOT IN ('CANCELLED', 'NO_SHOW')
               AND (p.booking_id IS NULL OR p.payment_status <> 'PAID')) AS unpaidCount,
            (SELECT COUNT(*) FROM booking
              WHERE status IN ('PENDING','CONFIRMED') AND staff_id IS NULL) AS unassignedCount`),
      ]);

    const today = todayRows[0][0];

    /* Tiền thu hôm nay tính theo NGÀY THANH TOÁN (payment_date), không
       theo ngày hẹn: khách đặt 07/10 cho lịch 10/10 mà trả ngay 07/10 thì
       tiền về két ngày 07/10. Đây là "tiền thu", khác "doanh thu dịch vụ"
       (tính theo ngày thực hiện COMPLETED + PAID) trên biểu đồ.
       Giới hạn đã biết: một lịch chỉ có một dòng payment nên lịch cọc
       trước-trả sau vẫn mang payment_date của lần thu đầu — muốn chính
       xác từng giao dịch phải tách bảng payment_transaction. */
    const [moneyRows] = await pool.query(`SELECT
        COALESCE(SUM(pay.payment_status = 'PAID'), 0) AS paidCount,
        COALESCE(SUM(CASE WHEN pay.payment_status = 'PAID' THEN pay.amount END), 0) AS paidAmount,
        COALESCE(SUM(CASE WHEN pay.payment_status = 'DEPOSITED' THEN pay.amount END), 0) AS depositAmount
      FROM payment pay
      WHERE DATE(pay.payment_date) = CURDATE()`);

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
          schedule: Number(todo.scheduleCount ?? 0),
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
        /* Doanh thu = tiền thực thu (payment.amount gồm cả add-on) trên
           lịch COMPLETED đã PAID — đồng nhất với báo cáo và payroll. */
        (SELECT COALESCE(SUM(p3.amount), 0)
           FROM booking b3
           JOIN payment p3 ON p3.booking_id = b3.booking_id AND p3.payment_status = 'PAID'
          WHERE b3.service_id = s.service_id AND b3.status = 'COMPLETED') AS revenue,
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
        c.description, c.status, COUNT(s.service_id) AS serviceCount,
        COALESCE(SUM(CASE WHEN s.status = 'ACTIVE' THEN s.price ELSE 0 END), 0) AS totalPrice
      FROM service_category c
      LEFT JOIN services s ON s.category_id = c.category_id
      GROUP BY c.category_id, c.category_name, c.description, c.status
      ORDER BY c.category_name`);

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
        COALESCE(st.base_salary, 0) AS baseSalary,
        COALESCE(st.commission_rate, 0) AS commissionRate,
        EXISTS(SELECT 1 FROM staff_schedule sc WHERE sc.staff_id = st.staff_id
          AND sc.work_date = CURDATE() AND sc.status = 'AVAILABLE') AS worksToday,
        (SELECT COUNT(*) FROM booking b WHERE b.staff_id = st.staff_id) AS bookingCount,
        (SELECT COUNT(*) FROM booking b2 WHERE b2.staff_id = st.staff_id
          AND b2.status = 'COMPLETED') AS completedCount,
        /* Doanh thu của nhân viên = tiền thực thu (gồm add-on) trên các
           lịch COMPLETED đã PAID — đồng nhất với báo cáo và payroll. */
        (SELECT COALESCE(SUM(p3.amount), 0) FROM booking b3
          JOIN payment p3 ON p3.booking_id = b3.booking_id AND p3.payment_status = 'PAID'
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
        baseSalary: Number(row.baseSalary ?? 0),
        commissionRate: Number(row.commissionRate ?? 0),
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
/* ================================================================
   Khách hàng
   ---------------------------------------------------------------
   Mọi chỉ số đều tính trực tiếp từ booking và payment. Hai cột cache
   cũ (total_spending / no_show_count) đã bỏ khỏi schema — API vẫn trả
   hai trường cùng tên nhưng là số tính tươi.
   ================================================================ */

/** Mã hiển thị dạng CUS0001, dựng từ customer_id. */
const customerCode = (id) => `CUS${String(id).padStart(4, '0')}`;

export async function listCustomers(req, res, next) {
  try {
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim().toUpperCase();
    const sort = ['newest', 'spend', 'bookings', 'noshow'].includes(String(req.query.sort))
      ? String(req.query.sort) : 'newest';

    const where = [];
    const params = [];
    if (q) {
      where.push('(u.full_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)');
      const keyword = `%${escapeLike(q)}%`;
      params.push(keyword, keyword, keyword);
    }
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where.push('u.status = ?');
      params.push(status);
    }

    /* Chỉ số gộp theo khách rồi mới nối bảng customer, để một khách có
       nhiều lịch không bị nhân bản số liệu lên nhiều dòng. */
    const [rows] = await pool.query(`SELECT
        c.customer_id,
        c.address,
        c.birthday,
        u.full_name AS name,
        u.phone, u.email, u.avatar, u.status, u.created_at AS createdAt,
        COUNT(b.booking_id) AS bookingCount,
        COALESCE(SUM(b.status = 'COMPLETED'), 0) AS completedCount,
        COALESCE(SUM(b.status = 'CANCELLED'), 0) AS cancelledCount,
        COALESCE(SUM(b.status = 'NO_SHOW'), 0) AS noShowCount,
        MAX(b.start_time) AS lastVisit,
        COALESCE(paid.totalPaid, 0) AS totalSpending,
        COALESCE(paid.paidCount, 0) AS paidCount
      FROM customer c
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN booking b ON b.customer_id = c.customer_id
      LEFT JOIN (
        SELECT b2.customer_id, SUM(p.amount) AS totalPaid, COUNT(*) AS paidCount
          FROM payment p JOIN booking b2 ON b2.booking_id = p.booking_id
         WHERE p.payment_status = 'PAID'
         GROUP BY b2.customer_id
      ) paid ON paid.customer_id = c.customer_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY c.customer_id, c.address, c.birthday,
               u.full_name, u.phone, u.email, u.avatar, u.status, u.created_at,
               paid.totalPaid, paid.paidCount
      ORDER BY ${sort === 'spend' ? 'totalSpending DESC, name ASC'
        : sort === 'bookings' ? 'bookingCount DESC, name ASC'
        : sort === 'noshow' ? 'noShowCount DESC, bookingCount DESC'
        : 'u.created_at DESC, name ASC'}
      LIMIT 2000`, params);

    /* Tổng chi tiêu chỉ tính payment PAID — cùng một định nghĩa với từng
       khách, nên cộng lại từ danh sách là ra tổng cửa hàng. */
    const data = rows.map((row) => ({
      id: String(row.customer_id),
      code: customerCode(row.customer_id),
      name: row.name,
      phone: row.phone,
      email: row.email,
      avatarUrl: imageUrl(req, row.avatar),
      address: row.address,
      birthday: row.birthday,
      status: row.status,
      createdAt: row.createdAt,
      bookingCount: Number(row.bookingCount),
      completedCount: Number(row.completedCount),
      cancelledCount: Number(row.cancelledCount),
      noShowCount: Number(row.noShowCount),
      lastVisit: row.lastVisit,
      totalSpending: Number(row.totalSpending),
      paidCount: Number(row.paidCount),
    }));

    res.json({
      data,
      meta: {
        total: data.length,
        totalSpending: data.reduce((sum, row) => sum + row.totalSpending, 0),
        noShowCount: data.reduce((sum, row) => sum + row.noShowCount, 0),
        completedCount: data.reduce((sum, row) => sum + row.completedCount, 0),
      },
    });
  } catch (error) {
    next(error);
  }
}

/** Chi tiết một khách: hồ sơ, chỉ số, toàn bộ lịch hẹn và các khoản thanh toán. */
export async function getCustomer(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã khách hàng không hợp lệ.' });

    const [[row]] = await pool.query(`SELECT
        c.customer_id, c.address, c.birthday,
        u.full_name AS name, u.phone, u.email, u.avatar, u.status,
        u.created_at AS createdAt,
        COUNT(b.booking_id) AS bookingCount,
        COALESCE(SUM(b.status = 'COMPLETED'), 0) AS completedCount,
        COALESCE(SUM(b.status = 'CANCELLED'), 0) AS cancelledCount,
        COALESCE(SUM(b.status = 'NO_SHOW'), 0) AS noShowCount,
        MAX(b.start_time) AS lastVisit,
        COALESCE((SELECT SUM(p.amount) FROM payment p
                    JOIN booking b3 ON b3.booking_id = p.booking_id
                   WHERE b3.customer_id = c.customer_id
                     AND p.payment_status = 'PAID'), 0) AS totalSpending
      FROM customer c
      JOIN users u ON u.user_id = c.user_id
      LEFT JOIN booking b ON b.customer_id = c.customer_id
      WHERE c.customer_id = ? LIMIT 1`, [id]);

    /* Câu này có hàm tổng hợp mà không GROUP BY, nên khi không khớp khách
       nào MySQL vẫn trả về đúng một dòng toàn NULL. Phải kiểm tra chính
       khoá chứ không chỉ kiểm tra dòng có tồn tại hay không. */
    if (!row || row.customer_id == null) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
    }

    const [bookings] = await pool.query(`SELECT
        b.booking_id AS id,
        b.start_time AS startsAt, b.end_time AS endsAt,
        b.status, b.source,
        s.service_name AS serviceName,
        su.full_name AS staffName,
        pay.payment_status AS paymentStatus, pay.payment_method AS paymentMethod,
        pay.amount AS paidAmount,
        COALESCE(b.service_price, s.price) AS price,
        COALESCE(addon.total, 0) AS addonTotal
      FROM booking b
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      LEFT JOIN (
        SELECT booking_id, SUM(price * quantity) AS total FROM booking_addon GROUP BY booking_id
      ) addon ON addon.booking_id = b.booking_id
      WHERE b.customer_id = ?
      ORDER BY b.start_time DESC`, [id]);

    const [payments] = await pool.query(`SELECT
        p.payment_id AS id, p.booking_id AS bookingId, p.amount,
        p.payment_method AS method, p.payment_status AS status, p.payment_date AS paidAt
      FROM payment p JOIN booking b ON b.booking_id = p.booking_id
      WHERE b.customer_id = ?
      ORDER BY p.payment_date DESC, p.payment_id DESC`, [id]);

    res.json({
      data: {
        id: String(row.customer_id),
        code: customerCode(row.customer_id),
        name: row.name,
        phone: row.phone,
        email: row.email,
        avatarUrl: imageUrl(req, row.avatar),
        address: row.address,
        birthday: row.birthday,
        status: row.status,
        createdAt: row.createdAt,
        bookingCount: Number(row.bookingCount),
        completedCount: Number(row.completedCount),
        cancelledCount: Number(row.cancelledCount),
        noShowCount: Number(row.noShowCount),
        lastVisit: row.lastVisit,
        totalSpending: Number(row.totalSpending),
        bookings: bookings.map((b) => ({
          ...b,
          id: String(b.id),
          code: bookingCode(b.id),
          bookingId: String(b.bookingId ?? b.id),
          statusText: STATUS_TEXT[b.status] ?? b.status,
          sourceText: SOURCE_TEXT[b.source] ?? b.source,
          paymentText: b.paymentStatus ? PAYMENT_TEXT[b.paymentStatus] : null,
          methodText: b.paymentMethod ? METHOD_TEXT[b.paymentMethod] : null,
          price: Number(b.price),
          addonTotal: Number(b.addonTotal),
          total: Number(b.price) + Number(b.addonTotal),
          paidAmount: b.paidAmount == null ? null : Number(b.paidAmount),
        })),
        payments: payments.map((p) => ({
          ...p,
          id: String(p.id),
          bookingId: String(p.bookingId),
          amount: Number(p.amount),
          methodText: METHOD_TEXT[p.method] ?? p.method,
          statusText: PAYMENT_TEXT[p.status] ?? p.status,
        })),
      },
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

    /* Chặn khoảng quá rộng: from=2000 to=2030 sẽ kéo ma trận khổng lồ.
       62 ngày (2 tháng) đủ cho mọi màn hình quản trị hiện có. */
    const spanDays = Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);
    if (spanDays < 0 || spanDays > 62) {
      return res.status(400).json({ message: 'Khoảng ngày tối đa 62 ngày.' });
    }

    const [rows] = await pool.query(`SELECT
        sc.schedule_id AS id,
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
        id: String(row.id),
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
   Trước đây trang này đọc staff_schedule.status = 'OFF', tức là coi mọi
   ca OFF là một lần nghỉ. Cách đó không phân biệt được "nhân viên được
   nghỉ" với "Admin đóng lịch", và không biết ai xin, ai duyệt.

   Nay đọc bảng staff_leave_request: mỗi dòng là một yêu cầu có người
   xin, lý do, trạng thái và người duyệt. Logic nằm ở request.controller.js.
   ================================================================ */
export { listLeaveRequests, listScheduleRequests } from './request.controller.js';

/* ================================================================
   Đánh giá
   ================================================================ */
export async function listReviews(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT
        r.review_id AS id,
        r.rating,
        r.comment,
        r.image,
        r.created_at AS createdAt,
        u.full_name AS customerName,
        u.avatar AS customerAvatarUrl,
        su.full_name AS staffName,
        s.service_name AS serviceName,
        /* staff_id và service_id không lưu trùng ở bảng review: lấy từ
           booking là ra, tránh hai nơi có thể ghi khác nhau. */
        st.staff_id AS staffId, s.service_id AS serviceId,
        (SELECT GROUP_CONCAT(ri.image_url SEPARATOR ',')
           FROM review_images ri WHERE ri.review_id = r.review_id) AS extraImages
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
        staffId: row.staffId == null ? null : String(row.staffId),
        serviceId: String(row.serviceId),
        rating: Number(row.rating),
        customerAvatarUrl: imageUrl(req, row.customerAvatarUrl),
        imageUrl: imageUrl(req, row.image),
        /* Ảnh phụ trong bảng review_images, cộng với ảnh cũ một ô image. */
        images: row.extraImages ? row.extraImages.split(',').map((u) => imageUrl(req, u)) : [],
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
    /* Đi từ booking LEFT JOIN payment: mọi lịch cần thu tiền đều hiện,
       kể cả những lịch Admin chưa từng ghi nhận (payment = NULL → UNPAID,
       số tiền = tổng phải thu). Trước đây đi từ payment JOIN booking nên
       ba lịch chưa ghi nhận thì cả ba đều biến mất khỏi trang. Lịch đã
       hủy / khách không đến thì không có gì để thu nên loại, trừ khi
       đã có dòng payment ghi nhận từ trước. */
    const [rows] = await pool.query(`SELECT
        pay.payment_id AS id,
        CASE WHEN pay.payment_status IN ('PAID', 'DEPOSITED')
          THEN pay.amount
          ELSE COALESCE(b.service_price, s.price) + COALESCE(addon.total, 0)
        END AS amount,
        pay.payment_method AS paymentMethod,
        COALESCE(pay.payment_status, 'UNPAID') AS paymentStatus,
        pay.payment_date AS paymentDate,
        b.booking_id AS bookingId,
        b.start_time AS startsAt,
        s.service_name AS serviceName,
        u.full_name AS customerName,
        su.full_name AS staffName
      FROM booking b
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN customer c ON c.customer_id = b.customer_id
      LEFT JOIN users u ON u.user_id = c.user_id
      LEFT JOIN staff st ON st.staff_id = b.staff_id
      LEFT JOIN users su ON su.user_id = st.user_id
      LEFT JOIN (
        SELECT booking_id, SUM(price * quantity) AS total
        FROM booking_addon GROUP BY booking_id
      ) addon ON addon.booking_id = b.booking_id
      WHERE (b.status NOT IN ('CANCELLED', 'NO_SHOW') OR pay.booking_id IS NOT NULL)
      ORDER BY COALESCE(pay.payment_date, b.start_time) DESC
      LIMIT 200`);

    /* Tổng hợp theo tháng để vẽ biểu đồ cột ở trang Doanh thu. paidAmount là
       con số doanh thu thật (chỉ khoản PAID); totalAmount là tổng tiền
       ghi nhận kể cả tiền cọc, để đối chiếu. */
    const [months] = await pool.query(`SELECT
        DATE_FORMAT(b.start_time, '%Y-%m') AS month,
        SUM(pay.payment_status = 'PAID') AS paidCount,
        COALESCE(SUM(CASE WHEN pay.payment_status = 'PAID' THEN pay.amount END), 0) AS paidAmount,
        COALESCE(SUM(pay.amount), 0) AS totalAmount
      FROM payment pay
      JOIN booking b ON b.booking_id = pay.booking_id
      GROUP BY DATE_FORMAT(b.start_time, '%Y-%m')
      ORDER BY month DESC LIMIT 6`);

    /* Tổng từ góc nhìn "phải thu": đã thu + cọc + còn nợ (gồm cả lịch
       chưa có dòng payment). Trước đây chỉ SUM trên bảng payment nên
       lịch chưa ghi nhận không được tính là chưa thanh toán. */
    const [totals] = await pool.query(`SELECT
        COALESCE(SUM(CASE WHEN pay.payment_status = 'PAID' THEN pay.amount END), 0) AS paidAmount,
        COALESCE(SUM(CASE WHEN pay.payment_status = 'DEPOSITED' THEN pay.amount END), 0) AS depositAmount,
        COALESCE(SUM(CASE WHEN pay.booking_id IS NULL OR pay.payment_status = 'UNPAID'
          THEN COALESCE(b.service_price, s.price) + COALESCE(addon.total, 0) END), 0) AS unpaidAmount
      FROM booking b
      LEFT JOIN payment pay ON pay.booking_id = b.booking_id
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN (
        SELECT booking_id, SUM(price * quantity) AS total
        FROM booking_addon GROUP BY booking_id
      ) addon ON addon.booking_id = b.booking_id
      WHERE (b.status NOT IN ('CANCELLED', 'NO_SHOW') OR pay.booking_id IS NOT NULL)`);

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: row.id == null ? null : String(row.id),
        bookingId: String(row.bookingId),
        amount: Number(row.amount),
        paymentMethod: row.paymentMethod ?? null,
        methodText: row.paymentMethod ? METHOD_TEXT[row.paymentMethod] ?? row.paymentMethod : null,
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
          all: Number(totals[0].paidAmount ?? 0) + Number(totals[0].depositAmount ?? 0) + Number(totals[0].unpaidAmount ?? 0),
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
   Báo cáo — tổng hợp theo kỳ (from/to) cho dịch vụ, nhân viên, khách
   ----------------------------------------------------------------
   Quy ước duy nhất, áp dụng mọi số trong trang này:

     Doanh thu dịch vụ = lịch COMPLETED + payment PAID, tính theo NGÀY
       THỰC HIỆN (booking.start_time). CONFIRMED/PROCESSING dù đã PAID
       cũng chưa tính — tiền đó nằm ở "tiền đã thu".
     Tiền đã thu = SUM(payment.amount) tính theo NGÀY THANH TOÁN
       (payment.payment_date), gồm cả cọc.
     Lượt dịch vụ = COUNT booking COMPLETED. Tỉ lệ hoàn thành =
       COMPLETED / (COMPLETED + CANCELLED + NO_SHOW); lịch dở dang
       (PENDING/CONFIRMED/PROCESSING) không vào mẫu số.
     Khách thân thiết = xếp theo lượt hoàn thành, rồi tới tổng chi tiêu.
   ================================================================ */
export async function getReports(req, res, next) {
  try {
    const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''));
    /* Mặc định tháng này (từ mùng 1 tới hôm nay) để mở trang là có số
       của kỳ hiện tại thay vì toàn bộ lịch sử — muốn xem khác thì chọn. */
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const from = isDay(req.query.from) ? String(req.query.from) : iso(firstOfMonth);
    const to = isDay(req.query.to) ? String(req.query.to) : iso(new Date());

    if (from > to) return res.status(400).json({ message: 'Từ ngày phải trước đến ngày.' });
    const spanDays = Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
    if (spanDays > 366) return res.status(400).json({ message: 'Khoảng báo cáo tối đa 366 ngày.' });

    const [summaryRows, trendRows, byService, byStaff, byCustomer, cashRows, forfeitRows] = await Promise.all([
      pool.query(`SELECT
          COUNT(*) AS bookings,
          SUM(b.status = 'COMPLETED') AS completed,
          SUM(b.status = 'CANCELLED') AS cancelled,
          SUM(b.status = 'NO_SHOW') AS noShow,
          SUM(b.status IN ('PENDING','CONFIRMED','PROCESSING')) AS running,
          COALESCE(AVG(NULLIF(b.actual_duration, 0)), 0) AS avgMinutes,
          COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND p.payment_status = 'PAID'
                            THEN p.amount ELSE 0 END), 0) AS serviceRevenue
        FROM booking b
        LEFT JOIN payment p ON p.booking_id = b.booking_id
        WHERE DATE(b.start_time) BETWEEN ? AND ?`, [from, to]),

      pool.query(`SELECT DATE_FORMAT(b.start_time, '%Y-%m-%d') AS day,
          SUM(b.status = 'COMPLETED') AS completed,
          COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND p.payment_status = 'PAID'
                            THEN p.amount ELSE 0 END), 0) AS revenue
        FROM booking b
        LEFT JOIN payment p ON p.booking_id = b.booking_id
        WHERE DATE(b.start_time) BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(b.start_time, '%Y-%m-%d')
        ORDER BY day ASC`, [from, to]),

      pool.query(`SELECT s.service_name AS name, c.category_name AS category,
          COUNT(DISTINCT b.booking_id) AS bookings,
          COALESCE(SUM(b.status = 'COMPLETED'), 0) AS completed,
          COALESCE(SUM(b.status = 'CANCELLED'), 0) AS cancelled,
          COALESCE(SUM(b.status = 'NO_SHOW'), 0) AS noShow,
          COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND pay.payment_status = 'PAID'
                            THEN pay.amount ELSE 0 END), 0) AS revenue
        FROM services s
        JOIN service_category c ON c.category_id = s.category_id
        LEFT JOIN booking b ON b.service_id = s.service_id
          AND DATE(b.start_time) BETWEEN ? AND ?
        LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        GROUP BY s.service_id, s.service_name, c.category_name
        HAVING bookings > 0
        ORDER BY revenue DESC, completed DESC`, [from, to]),

      pool.query(`SELECT u.full_name AS name, st.specialty,
          COUNT(DISTINCT b.booking_id) AS bookings,
          COALESCE(SUM(b.status = 'COMPLETED'), 0) AS completed,
          COALESCE(SUM(b.status = 'CANCELLED'), 0) AS cancelled,
          COALESCE(SUM(b.status = 'NO_SHOW'), 0) AS noShow,
          COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND pay.payment_status = 'PAID'
                            THEN pay.amount ELSE 0 END), 0) AS revenue,
          (SELECT ROUND(AVG(r.rating), 1) FROM review r
             JOIN booking rb ON rb.booking_id = r.booking_id
            WHERE rb.staff_id = st.staff_id
              AND DATE(rb.start_time) BETWEEN ? AND ?) AS rating,
          (SELECT COUNT(*) FROM review r
             JOIN booking rb ON rb.booking_id = r.booking_id
            WHERE rb.staff_id = st.staff_id
              AND DATE(rb.start_time) BETWEEN ? AND ?) AS reviewCount
        FROM staff st
        JOIN users u ON u.user_id = st.user_id
        LEFT JOIN booking b ON b.staff_id = st.staff_id
          AND DATE(b.start_time) BETWEEN ? AND ?
        LEFT JOIN payment pay ON pay.booking_id = b.booking_id
        GROUP BY st.staff_id, u.full_name, st.specialty
        HAVING bookings > 0
        ORDER BY revenue DESC, completed DESC`, [from, to, from, to, from, to]),

      /* Thân thiết = lượt hoàn thành trước, tổng chi tiêu sau. */
      pool.query(`SELECT u.full_name AS name, u.phone,
          COUNT(DISTINCT b.booking_id) AS bookings,
          COALESCE(SUM(b.status = 'COMPLETED'), 0) AS completed,
          COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND p.payment_status = 'PAID'
                            THEN p.amount ELSE 0 END), 0) AS spending,
          MAX(CASE WHEN b.status = 'COMPLETED' THEN b.start_time END) AS lastVisit
        FROM customer cu
        JOIN users u ON u.user_id = cu.user_id
        LEFT JOIN booking b ON b.customer_id = cu.customer_id
          AND DATE(b.start_time) BETWEEN ? AND ?
        LEFT JOIN payment p ON p.booking_id = b.booking_id
        GROUP BY cu.customer_id, u.full_name, u.phone
        HAVING bookings > 0
        ORDER BY completed DESC, spending DESC LIMIT 10`, [from, to]),

      /* Tiền đã thu trong kỳ theo ngày thanh toán (gồm cả cọc). */
      pool.query(`SELECT
          COALESCE(SUM(CASE WHEN p.payment_status = 'PAID' THEN p.amount END), 0) AS paid,
          COALESCE(SUM(CASE WHEN p.payment_status = 'DEPOSITED' THEN p.amount END), 0) AS deposit,
          COUNT(CASE WHEN p.payment_status = 'PAID' THEN 1 END) AS paidCount
        FROM payment p
        WHERE DATE(p.payment_date) BETWEEN ? AND ?`, [from, to]),

      /* Cọc không hoàn lại: lịch đã hủy nhưng khoản DEPOSITED vẫn giữ.
         Không cộng vào doanh thu dịch vụ, hiện nhóm riêng để đối chiếu két. */
      pool.query(`SELECT
          COUNT(*) AS count,
          COALESCE(SUM(p.amount), 0) AS amount
        FROM payment p
        JOIN booking b ON b.booking_id = p.booking_id
        WHERE p.payment_status = 'DEPOSITED' AND b.status = 'CANCELLED'
          AND DATE(b.start_time) BETWEEN ? AND ?`, [from, to]),
    ]);

    const t = summaryRows[0][0];
    const completed = Number(t.completed ?? 0);
    const finished = completed + Number(t.cancelled ?? 0) + Number(t.noShow ?? 0);

    const rate = (row) => {
      const done = Number(row.completed ?? 0);
      const fin = done + Number(row.cancelled ?? 0) + Number(row.noShow ?? 0);
      return fin > 0 ? Math.round((done / fin) * 100) : 0;
    };

    res.json({
      data: {
        from,
        to,
        summary: {
          bookings: Number(t.bookings ?? 0),
          completed,
          cancelled: Number(t.cancelled ?? 0),
          noShow: Number(t.noShow ?? 0),
          running: Number(t.running ?? 0),
          completionRate: finished > 0 ? Math.round((completed / finished) * 100) : 0,
          avgMinutes: Math.round(Number(t.avgMinutes ?? 0)),
          serviceRevenue: Number(t.serviceRevenue ?? 0),
          cashCollected: Number(cashRows[0][0].paid ?? 0) + Number(cashRows[0][0].deposit ?? 0),
          cashPaid: Number(cashRows[0][0].paid ?? 0),
          cashDeposit: Number(cashRows[0][0].deposit ?? 0),
          forfeitedCount: Number(forfeitRows[0][0].count ?? 0),
          forfeitedAmount: Number(forfeitRows[0][0].amount ?? 0),
        },
        revenueTrend: trendRows[0].map((row) => ({
          day: row.day,
          completed: Number(row.completed),
          revenue: Number(row.revenue),
        })),
        byService: byService[0].map((row) => ({
          name: row.name,
          category: row.category,
          bookings: Number(row.bookings),
          completed: Number(row.completed),
          cancelled: Number(row.cancelled),
          noShow: Number(row.noShow),
          completionRate: rate(row),
          revenue: Number(row.revenue),
        })),
        byStaff: byStaff[0].map((row) => ({
          name: row.name,
          specialty: row.specialty,
          bookings: Number(row.bookings),
          completed: Number(row.completed),
          cancelled: Number(row.cancelled),
          noShow: Number(row.noShow),
          completionRate: rate(row),
          revenue: Number(row.revenue),
          rating: row.rating == null ? null : Number(row.rating),
          reviewCount: Number(row.reviewCount ?? 0),
        })),
        byCustomer: byCustomer[0].map((row) => ({
          name: row.name,
          phone: row.phone,
          bookings: Number(row.bookings),
          completed: Number(row.completed),
          spending: Number(row.spending),
          lastVisit: row.lastVisit,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}
