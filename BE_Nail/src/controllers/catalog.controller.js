/* ===== Quản lý danh mục: dịch vụ, danh mục, nhân viên =====

   Ba danh mục này do quản trị viên sở hữu, không phải nhân viên.

   Trước đây nhân viên tự tạo, sửa và xoá dịch vụ qua /api/staff/services —
   tức là nhân viên tự quyết giá dịch vụ, trong khi README quy định rõ
   nhân viên chỉ xem danh sách dịch vụ mình phục vụ, còn Admin mới được
   thêm, sửa, bật/tắt và gán dịch vụ cho nhân viên. Nay các đường đó
   chuyển hết về /api/admin/*.

   Nguyên tắc xoá: dữ liệu đã được lịch hẹn tham chiếu thì không xoá
   cứng, chỉ chuyển sang INACTIVE. Các lịch cũ phải còn đọc được tên
   và giá đúng như lúc khách đặt. */

import { pool } from '../config/database.js';
import { hashPassword, passwordProblem } from '../lib/auth.js';
import { normalisePhone, isValidPhone } from './walkin.controller.js';

const MAX_NAME = 150;
const MAX_DESCRIPTION = 2000;
const MAX_IMAGE = 255;
const MAX_PRICE = 1000000000;
const MIN_DURATION = 5;
const MAX_DURATION = 600;
const SERVICE_STATUSES = ['ACTIVE', 'INACTIVE'];
const CATEGORY_STATUSES = ['ACTIVE', 'INACTIVE'];

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

/** Đường dẫn ảnh phải nằm trong /uploads hoặc http(s) — chặn javascript:. */
function cleanImage(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (text.length > MAX_IMAGE) return undefined;
  return /^https?:\/\//i.test(text) || /^\/uploads\//.test(text) ? text : undefined;
}

function imageUrl(req, value) {
  if (!value || /^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${req.protocol}://${req.get('host')}${path}`;
}

async function exists(table, column, id) {
  const [rows] = await pool.query(
    `SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`, [id]);
  return Boolean(rows[0]);
}

/* ================================================================
   DANH MỤC DỊCH VỤ
   ================================================================ */

/** Đọc và kiểm tra dữ liệu dịch vụ. Trả { error } khi sai, { value } khi hợp lệ. */
function readService(body) {
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > MAX_NAME) {
    return { error: `Tên dịch vụ cần từ 2 đến ${MAX_NAME} ký tự.` };
  }

  const price = Number(body?.price);
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    return { error: 'Giá dịch vụ không hợp lệ.' };
  }

  const duration = Number(body?.duration);
  if (!Number.isInteger(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
    return { error: `Thời lượng phải là số phút từ ${MIN_DURATION} đến ${MAX_DURATION}.` };
  }

  const bufferTime = Number(body?.bufferTime ?? 0);
  if (!Number.isInteger(bufferTime) || bufferTime < 0 || bufferTime > 120) {
    return { error: 'Khoảng nghỉ sau dịch vụ phải từ 0 đến 120 phút.' };
  }

  const description = String(body?.description ?? '').trim();
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Mô tả tối đa ${MAX_DESCRIPTION} ký tự.` };
  }

  const status = SERVICE_STATUSES.includes(body?.status) ? body.status : 'ACTIVE';

  const image = cleanImage(body?.image);
  if (image === undefined) {
    return { error: 'Ảnh phải là đường dẫn trong /uploads hoặc đường dẫn http(s).' };
  }

  let categoryId = null;
  if (body?.categoryId !== undefined && body?.categoryId !== null && body.categoryId !== '') {
    categoryId = validId(body.categoryId);
    if (!categoryId) return { error: 'Danh mục dịch vụ không hợp lệ.' };
  }

  return {
    value: {
      name,
      price,
      duration,
      bufferTime,
      description: description || null,
      status,
      image,
      categoryId,
    },
  };
}

/** GET /api/admin/catalog/services — toàn bộ dịch vụ kèm số liệu. */
export async function listServices(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT s.service_id AS id, s.service_name AS name, s.description,
              s.price, s.duration, s.buffer_time AS bufferTime, s.status, s.image,
              s.category_id AS categoryId, c.category_name AS category,
              c.status AS categoryStatus,
              (SELECT COUNT(*) FROM staff_service ss WHERE ss.service_id = s.service_id) AS staffCount,
              (SELECT GROUP_CONCAT(u.full_name ORDER BY u.full_name SEPARATOR ', ')
                 FROM staff_service ss
                 JOIN staff st ON st.staff_id = ss.staff_id
                 JOIN users u ON u.user_id = st.user_id
                WHERE ss.service_id = s.service_id) AS staffNames,
              (SELECT COUNT(*) FROM booking b WHERE b.service_id = s.service_id) AS bookingCount,
              (SELECT ROUND(AVG(r.rating), 1) FROM review r
                 JOIN booking b3 ON b3.booking_id = r.booking_id
                WHERE b3.service_id = s.service_id) AS rating,
              (SELECT COUNT(*) FROM review r2
                 JOIN booking b4 ON b4.booking_id = r2.booking_id
                WHERE b4.service_id = s.service_id) AS reviewCount
         FROM services s
         LEFT JOIN service_category c ON c.category_id = s.category_id
         ORDER BY c.category_name ASC, s.service_name ASC`,
    );

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
        reviewCount: Number(row.reviewCount),
        rating: row.rating == null ? null : Number(row.rating),
        imageUrl: imageUrl(req, row.image),
        staffNames: row.staffNames ? row.staffNames.split(', ') : [],
      })),
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/catalog/services — thêm dịch vụ. */
export async function createService(req, res, next) {
  try {
    const { value, error } = readService(req.body);
    if (error) return res.status(400).json({ message: error });

    if (value.categoryId && !(await exists('service_category', 'category_id', value.categoryId))) {
      return res.status(400).json({ message: 'Danh mục dịch vụ không tồn tại.' });
    }

    const [result] = await pool.query(
      `INSERT INTO services (service_name, description, image, price, duration, buffer_time, status, category_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [value.name, value.description, value.image, value.price,
        value.duration, value.bufferTime, value.status, value.categoryId],
    );

    /* Có thể gán ngay cho một vài nhân viên ngay khi tạo. */
    const staffIds = Array.isArray(req.body?.staffIds)
      ? req.body.staffIds.map(validId).filter(Boolean) : [];
    for (const staffId of staffIds) {
      await pool.query(
        'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (?,?)',
        [staffId, result.insertId],
      );
    }

    res.status(201).json({ data: { id: String(result.insertId), ...value } });
  } catch (error) {
    next(error);
  }
}

/** PUT /api/admin/catalog/services/:id — sửa dịch vụ. */
export async function updateService(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã dịch vụ không hợp lệ.' });

    const { value, error } = readService(req.body);
    if (error) return res.status(400).json({ message: error });

    if (value.categoryId && !(await exists('service_category', 'category_id', value.categoryId))) {
      return res.status(400).json({ message: 'Danh mục dịch vụ không tồn tại.' });
    }

    /* Thiếu khoá categoryId thì giữ danh mục cũ, không xoá nhầm. Muốn bỏ
       danh mục thì gửi categoryId rỗng. */
    const [[current]] = await pool.query(
      'SELECT category_id AS categoryId FROM services WHERE service_id = ? LIMIT 1', [id]);
    if (!current) return res.status(404).json({ message: 'Không tìm thấy dịch vụ.' });
    const categoryId = req.body && 'categoryId' in req.body ? value.categoryId : current.categoryId;

    await pool.query(
      `UPDATE services
          SET service_name = ?, description = ?, image = ?, price = ?,
              duration = ?, buffer_time = ?, status = ?, category_id = ?
        WHERE service_id = ?`,
      [value.name, value.description, value.image, value.price,
        value.duration, value.bufferTime, value.status, categoryId, id],
    );

    if (Array.isArray(req.body?.staffIds)) {
      const staffIds = req.body.staffIds.map(validId).filter(Boolean);
      await pool.query('DELETE FROM staff_service WHERE service_id = ?', [id]);
      for (const staffId of staffIds) {
        await pool.query(
          'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (?,?)', [staffId, id],
        );
      }
    }

    res.json({ data: { id: String(id), ...value, categoryId } });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/catalog/services/:id/status — bật / tắt dịch vụ.
 *
 * Không có DELETE cho dịch vụ: dịch vụ đã từng xuất hiện trong một lịch
 * hẹn thì xoá đi là hỏng dữ liệu lịch sử, nên chỉ chuyển sang INACTIVE.
 * Dịch vụ chưa từng có lịch nào thì vẫn xoá cứng được.
 */
export async function setServiceStatus(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã dịch vụ không hợp lệ.' });

    const status = String(req.body?.status ?? '').toUpperCase();
    if (!SERVICE_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái phải là ACTIVE hoặc INACTIVE.' });
    }

    const [result] = await pool.query(
      'UPDATE services SET status = ? WHERE service_id = ?', [status, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy dịch vụ.' });

    res.json({ data: { id: String(id), status } });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/catalog/services/:id
 *
 * Chỉ xoá cứng khi dịch vụ chưa từng có lịch hẹn nào. Nếu đã có lịch
 * thì từ chối và hướng người dùng sang tắt dịch vụ — đó là điểm khác
 * biệt giữa "dịch vụ trong danh mục" và "dịch vụ đã dùng".
 */
export async function deleteService(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã dịch vụ không hợp lệ.' });

    await connection.beginTransaction();
    const [[used]] = await connection.query(
      'SELECT COUNT(*) AS n FROM booking WHERE service_id = ?', [id]);
    if (Number(used.n) > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: `Dịch vụ này đã có ${used.n} lịch hẹn nên không xoá được. `
          + 'Hãy chuyển sang trạng thái ngừng hoạt động (INACTIVE) thay cho xoá.',
      });
    }

    /* Dịch vụ chưa từng là món chính nhưng đã nằm trong booking_addon thì
       cũng không xoá được: khoá ngoại fk_addon_service sẽ văng lỗi 500
       thay vì một thông báo nghiệp vụ rõ ràng. */
    const [[inAddon]] = await connection.query(
      'SELECT COUNT(DISTINCT booking_id) AS n FROM booking_addon WHERE service_id = ?', [id]);
    if (Number(inAddon.n) > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: `Dịch vụ này đang là dịch vụ phát sinh trong ${inAddon.n} lịch hẹn `
          + 'nên không xoá được. Hãy chuyển sang trạng thái ngừng hoạt động (INACTIVE) thay cho xoá.',
      });
    }

    await connection.query('DELETE FROM staff_service WHERE service_id = ?', [id]);
    await connection.query('DELETE FROM services WHERE service_id = ?', [id]);
    await connection.commit();

    res.json({ data: { id: String(id), removed: true } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   DANH MỤC (CATEGORY)
   ================================================================ */

export async function listCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT c.category_id AS id, c.category_name AS name, c.description,
              c.status, c.service_count AS serviceCount,
              (SELECT COALESCE(SUM(s.price), 0) FROM services s
                WHERE s.category_id = c.category_id AND s.status = 'ACTIVE') AS totalPrice,
              (SELECT COUNT(*) FROM booking b JOIN services s2 ON s2.service_id = b.service_id
                WHERE s2.category_id = c.category_id) AS bookingCount
         FROM service_category c ORDER BY c.category_name`,
    );

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        serviceCount: Number(row.serviceCount ?? 0),
        bookingCount: Number(row.bookingCount),
        totalPrice: Number(row.totalPrice ?? 0),
      })),
    });
  } catch (error) {
    next(error);
  }
}

function readCategory(body) {
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 100) {
    return { error: 'Tên danh mục cần từ 2 đến 100 ký tự.' };
  }
  const description = String(body?.description ?? '').trim().slice(0, 500) || null;
  const status = CATEGORY_STATUSES.includes(body?.status) ? body.status : 'ACTIVE';
  return { value: { name, description, status } };
}

export async function createCategory(req, res, next) {
  try {
    const { value, error } = readCategory(req.body);
    if (error) return res.status(400).json({ message: error });

    const [result] = await pool.query(
      `INSERT INTO service_category (category_name, description, status)
       VALUES (?,?,?)`, [value.name, value.description, value.status],
    );
    res.status(201).json({ data: { id: String(result.insertId), ...value, serviceCount: 0 } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Đã có danh mục cùng tên.' });
    }
    return next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã danh mục không hợp lệ.' });

    const { value, error } = readCategory(req.body);
    if (error) return res.status(400).json({ message: error });

    const [result] = await pool.query(
      `UPDATE service_category SET category_name = ?, description = ?, status = ?
        WHERE category_id = ?`, [value.name, value.description, value.status, id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });

    res.json({ data: { id: String(id), ...value } });
  } catch (error) {
    next(error);
  }
}

/**
 * Bật / tắt danh mục. Khách chỉ thấy danh mục ACTIVE, nên tắt một danh
 * mục là ẩn luôn nhóm dịch vụ của nó khỏi ứng dụng mà không cần sửa từng
 * dịch vụ con.
 */
export async function setCategoryStatus(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã danh mục không hợp lệ.' });

    const status = String(req.body?.status ?? '').toUpperCase();
    if (!CATEGORY_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái phải là ACTIVE hoặc INACTIVE.' });
    }

    const [result] = await pool.query(
      'UPDATE service_category SET status = ? WHERE category_id = ?', [status, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });

    res.json({ data: { id: String(id), status } });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/catalog/categories/:id
 *
 * Danh mục còn dịch vụ thì không xoá — dịch vụ sẽ mất chỗ thuộc về nó.
 * Chỉ danh mục rỗng mới xoá được.
 */
export async function deleteCategory(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã danh mục không hợp lệ.' });

    const [[used]] = await pool.query(
      'SELECT COUNT(*) AS n FROM services WHERE category_id = ?', [id]);
    if (Number(used.n) > 0) {
      return res.status(409).json({
        message: `Danh mục này còn ${used.n} dịch vụ nên không xoá được. `
          + 'Hãy chuyển sang trạng thái ngừng hoạt động (INACTIVE) thay cho xoá.',
      });
    }

    const [result] = await pool.query(
      'DELETE FROM service_category WHERE category_id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });

    res.json({ data: { id: String(id), removed: true } });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   NHÂN VIÊN
   ================================================================ */

/** GET /api/admin/catalog/staff — danh sách nhân viên đầy đủ. */
export async function listStaff(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT st.staff_id AS id, u.user_id AS userId, u.full_name AS name,
              u.email, u.phone, u.avatar AS avatarUrl, u.status,
              st.specialty, st.experience_year AS experienceYears,
              (SELECT GROUP_CONCAT(s.service_name ORDER BY s.service_name SEPARATOR ', ')
                 FROM staff_service ss JOIN services s ON s.service_id = ss.service_id
                WHERE ss.staff_id = st.staff_id) AS serviceNames,
              (SELECT COUNT(*) FROM staff_service ss WHERE ss.staff_id = st.staff_id) AS serviceCount,
              (SELECT COUNT(*) FROM booking b WHERE b.staff_id = st.staff_id) AS bookingCount,
              (SELECT COUNT(*) FROM booking b2 WHERE b2.staff_id = st.staff_id
                AND b2.status = 'COMPLETED') AS completedCount,
              (SELECT ROUND(AVG(r.rating), 1) FROM review r
                 JOIN booking b3 ON b3.booking_id = r.booking_id
                WHERE b3.staff_id = st.staff_id) AS rating,
              (SELECT COUNT(*) FROM review r2
                 JOIN booking b4 ON b4.booking_id = r2.booking_id
                WHERE b4.staff_id = st.staff_id) AS reviewCount
         FROM staff st JOIN users u ON u.user_id = st.user_id
        ORDER BY u.status DESC, u.full_name ASC`,
    );

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        userId: String(row.userId),
        avatarUrl: imageUrl(req, row.avatarUrl),
        experienceYears: Number(row.experienceYears ?? 0),
        serviceCount: Number(row.serviceCount),
        bookingCount: Number(row.bookingCount),
        completedCount: Number(row.completedCount),
        reviewCount: Number(row.reviewCount),
        rating: row.rating == null ? null : Number(row.rating),
        serviceNames: row.serviceNames ? row.serviceNames.split(', ') : [],
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/catalog/staff — thêm nhân viên.
 *
 * Tạo cả ba bảng liên quan trong một giao dịch: users (tài khoản đăng
 * nhập), staff (hồ sơ nghề nghiệp), staff_service (dịch vụ được gán).
 * Không có bảng nào thì nhân viên không đăng nhập và cũng không nhận
 * được lịch.
 */
export async function createStaff(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const fullName = String(req.body?.fullName ?? '').trim().replace(/\s+/g, ' ');
    const phone = normalisePhone(req.body?.phone);
    const email = String(req.body?.email ?? '').trim().toLowerCase() || null;
    const password = String(req.body?.password ?? '');
    const specialty = String(req.body?.specialty ?? '').trim().slice(0, 255) || null;
    const experienceYears = Number(req.body?.experienceYears ?? 0);
    const avatar = cleanImage(req.body?.avatar) ?? null;

    if (fullName.length < 2 || fullName.length > 100) {
      return res.status(400).json({ message: 'Họ tên cần từ 2 đến 100 ký tự.' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.' });
    }
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ.' });
    }
    if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 60) {
      return res.status(400).json({ message: 'Số năm kinh nghiệm không hợp lệ.' });
    }
    if (cleanImage(req.body?.avatar) === undefined) {
      return res.status(400).json({ message: 'Ảnh phải là đường dẫn trong /uploads hoặc http(s).' });
    }

    const [[taken]] = await connection.query(
      'SELECT 1 FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?) LIMIT 1',
      [phone, email],
    );
    if (taken) {
      return res.status(409).json({ message: 'Số điện thoại hoặc email đã được dùng.' });
    }

    await connection.beginTransaction();
    const [user] = await connection.query(
      `INSERT INTO users (full_name, phone, email, password, avatar, role, status)
       VALUES (?,?,?,?,?,'STAFF','ACTIVE')`,
      [fullName, phone, email, await hashPassword(password), avatar],
    );
    const [staff] = await connection.query(
      `INSERT INTO staff (user_id, specialty, experience_year) VALUES (?,?,?)`,
      [user.insertId, specialty, experienceYears],
    );

    const serviceIds = Array.isArray(req.body?.serviceIds)
      ? req.body.serviceIds.map(validId).filter(Boolean) : [];
    for (const serviceId of serviceIds) {
      await connection.query(
        'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (?,?)',
        [staff.insertId, serviceId],
      );
    }

    await connection.commit();
    res.status(201).json({
      data: {
        id: String(staff.insertId),
        userId: String(user.insertId),
        name: fullName,
        phone,
        email,
        specialty,
        experienceYears,
        status: 'ACTIVE',
        serviceCount: serviceIds.length,
      },
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Số điện thoại hoặc email đã được dùng.' });
    }
    return next(error);
  } finally {
    connection.release();
  }
}

/** PUT /api/admin/catalog/staff/:id — sửa hồ sơ nhân viên. */
export async function updateStaff(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã nhân viên không hợp lệ.' });

    const [[staff]] = await connection.query(
      'SELECT st.staff_id, st.user_id FROM staff st WHERE st.staff_id = ? LIMIT 1', [id]);
    if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });

    const set = [];
    const params = [];

    if (req.body?.fullName !== undefined) {
      const fullName = String(req.body.fullName).trim().replace(/\s+/g, ' ');
      if (fullName.length < 2 || fullName.length > 100) {
        return res.status(400).json({ message: 'Họ tên cần từ 2 đến 100 ký tự.' });
      }
      set.push('full_name = ?'); params.push(fullName);
    }

    if (req.body?.phone !== undefined) {
      const phone = normalisePhone(req.body.phone);
      if (!isValidPhone(phone)) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ.' });
      }
      const [[taken]] = await connection.query(
        'SELECT 1 FROM users WHERE phone = ? AND user_id <> ? LIMIT 1', [phone, staff.user_id]);
      if (taken) return res.status(409).json({ message: 'Số điện thoại đã được dùng.' });
      set.push('phone = ?'); params.push(phone);
    }

    if (req.body?.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Email không hợp lệ.' });
      }
      set.push('email = ?'); params.push(email);
    }

    if (req.body?.avatar !== undefined) {
      const avatar = cleanImage(req.body.avatar);
      if (avatar === undefined) {
        return res.status(400).json({ message: 'Ảnh phải là đường dẫn trong /uploads hoặc http(s).' });
      }
      set.push('avatar = ?'); params.push(avatar);
    }

    /* Đổi mật khẩu cho nhân viên: quản trị đặt lại được khi nhân viên
       quên mật khẩu, không cần tự đăng ký lại tài khoản mới. */
    if (req.body?.password) {
      const problem = passwordProblem(req.body.password);
      if (problem) return res.status(400).json({ message: problem });
      set.push('password = ?'); params.push(await hashPassword(req.body.password));
    }

    await connection.beginTransaction();

    if (set.length) {
      params.push(staff.user_id);
      await connection.query(`UPDATE users SET ${set.join(', ')} WHERE user_id = ?`, params);
    }

    if (req.body?.specialty !== undefined || req.body?.experienceYears !== undefined) {
      const specialty = String(req.body?.specialty ?? '').trim().slice(0, 255) || null;
      const years = Number(req.body?.experienceYears ?? 0);
      if (!Number.isInteger(years) || years < 0 || years > 60) {
        await connection.rollback();
        return res.status(400).json({ message: 'Số năm kinh nghiệm không hợp lệ.' });
      }
      await connection.query(
        'UPDATE staff SET specialty = ?, experience_year = ? WHERE staff_id = ?',
        [specialty, years, id],
      );
    }

    /* Gán lại toàn bộ danh sách dịch vụ. */
    if (Array.isArray(req.body?.serviceIds)) {
      const serviceIds = req.body.serviceIds.map(validId).filter(Boolean);
      await connection.query('DELETE FROM staff_service WHERE staff_id = ?', [id]);
      for (const serviceId of serviceIds) {
        await connection.query(
          'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (?,?)', [id, serviceId],
        );
      }
    }

    await connection.commit();
    res.json({ data: { id: String(id), updated: true } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * PATCH /api/admin/catalog/staff/:id/status — cho thuê hoặc cho nghỉ làm việc.
 *
 * Nhân viên nghỉ làm việc bằng cách khóa tài khoản, không xoá hồ sơ:
 * lịch hẹn cũ vẫn cần đọc tên người phục vụ để lập báo cáo.
 */
export async function setStaffStatus(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã nhân viên không hợp lệ.' });

    const status = String(req.body?.status ?? '').toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái phải là ACTIVE hoặc INACTIVE.' });
    }

    const [[staff]] = await pool.query(
      'SELECT st.user_id AS userId, u.full_name FROM staff st JOIN users u ON u.user_id = st.user_id'
      + ' WHERE st.staff_id = ? LIMIT 1', [id],
    );
    if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });

    /* Không cho khóa chính mình — nếu không sẽ không còn ai vào quản trị. */
    if (staff.userId === req.user.userId) {
      return res.status(409).json({ message: 'Không thể khóa tài khoản của chính mình.' });
    }

    /* Khóa khi còn lịch tương lai thì lịch đó không còn ai phục vụ: nhân
       viên không đăng nhập được nhưng vẫn đang được phân công. Chỉ cho
       khóa khi đã xử lý hết lịch PENDING / CONFIRMED / PROCESSING. */
    if (status === 'INACTIVE') {
      const [[pending]] = await pool.query(
        `SELECT COUNT(*) AS n FROM booking
          WHERE staff_id = ? AND status IN ('PENDING','CONFIRMED','PROCESSING')
            AND end_time > NOW()`, [id]);
      if (Number(pending.n) > 0) {
        return res.status(409).json({
          message: `Nhân viên này còn ${pending.n} lịch chưa hoàn thành. `
            + 'Vui lòng đổi nhân viên, đổi giờ hoặc hủy các lịch đó trước khi khóa tài khoản.',
        });
      }
    }

    await pool.query('UPDATE users SET status = ? WHERE user_id = ?', [status, staff.userId]);
    res.json({ data: { id: String(id), status, name: staff.full_name } });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/catalog/staff/:id
 *
 * Nhân viên từng có lịch hẹn thì không xoá được — phải khóa tài khoản.
 * Xoá cứng chỉ dành cho tài khoản chưa từng phục vụ ai.
 */
export async function deleteStaff(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã nhân viên không hợp lệ.' });

    const [[staff]] = await connection.query(
      'SELECT st.user_id AS userId FROM staff st WHERE st.staff_id = ? LIMIT 1', [id]);
    if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });

    if (staff.userId === req.user.userId) {
      return res.status(409).json({ message: 'Không thể xoá tài khoản của chính mình.' });
    }

    await connection.beginTransaction();
    const [[used]] = await connection.query(
      'SELECT COUNT(*) AS n FROM booking WHERE staff_id = ?', [id]);
    if (Number(used.n) > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: `Nhân viên này đã phục vụ ${used.n} lịch hẹn nên không xoá được. `
          + 'Hãy chuyển sang trạng thái ngừng làm việc (INACTIVE) thay cho xoá.',
      });
    }

    await connection.query('DELETE FROM staff_service WHERE staff_id = ?', [id]);
    await connection.query('DELETE FROM staff WHERE staff_id = ?', [id]);
    await connection.query('DELETE FROM users WHERE user_id = ?', [staff.userId]);
    await connection.commit();

    res.json({ data: { id: String(id), removed: true } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/* ================================================================
   GÁN DỊCH VỤ CHO NHÂN VIÊN
   ================================================================ */

/** POST /api/admin/catalog/staff/:id/services — gán thêm dịch vụ. */
export async function assignServices(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã nhân viên không hợp lệ.' });
    if (!(await exists('staff', 'staff_id', id))) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });
    }

    const serviceIds = Array.isArray(req.body?.serviceIds)
      ? req.body.serviceIds.map(validId).filter(Boolean) : [];
    let added = 0;
    for (const serviceId of serviceIds) {
      const [result] = await pool.query(
        'INSERT IGNORE INTO staff_service (staff_id, service_id) VALUES (?,?)', [id, serviceId],
      );
      added += result.affectedRows;
    }

    res.json({ data: { staffId: String(id), added } });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/catalog/staff/:id/services/:serviceId — gỡ dịch vụ.
 *
 * Trước đây logic gỡ bị đảo ngược thành `!(others && used)`: nghĩa là
 * khi còn nhân viên khác dùng và đã có lịch thì lại ra true và hệ
 * thống đi xoá hẳn dịch vụ khỏi danh mục — đúng cái sai phải tránh.
 * Luật đúng: chỉ xoá hẳn khi KHÔNG còn ai dùng VÀ chưa từng có lịch.
 */
export async function removeServiceFromStaff(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const staffId = validId(req.params.id);
    const serviceId = validId(req.params.serviceId);
    if (!staffId || !serviceId) {
      return res.status(400).json({ message: 'Mã nhân viên hoặc dịch vụ không hợp lệ.' });
    }

    await connection.beginTransaction();

    const [[linked]] = await connection.query(
      `SELECT s.service_name AS name FROM services s
         JOIN staff_service ss ON ss.service_id = s.service_id
        WHERE ss.staff_id = ? AND ss.service_id = ? LIMIT 1`, [staffId, serviceId],
    );
    if (!linked) {
      await connection.rollback();
      return res.status(404).json({ message: 'Nhân viên này không được gán dịch vụ đó.' });
    }

    /* Gỡ khỏi nhân viên là một việc, còn xoá khỏi danh mục là việc khác
       và phải được bảo vệ riêng. */
    await connection.query(
      'DELETE FROM staff_service WHERE staff_id = ? AND service_id = ?', [staffId, serviceId],
    );

    const [[others]] = await connection.query(
      'SELECT 1 FROM staff_service WHERE service_id = ? LIMIT 1', [serviceId]);
    const [[used]] = await connection.query(
      'SELECT 1 FROM booking WHERE service_id = ? LIMIT 1', [serviceId]);

    /* Còn người khác dùng HOẶC đã có lịch tham chiếu thì giữ dịch vụ trong
       danh mục. Chỉ khi cả hai đều không mới xoá cứng. */
    const canHardDelete = !others && !used;

    if (canHardDelete) {
      await connection.query('DELETE FROM services WHERE service_id = ?', [serviceId]);
    }

    await connection.commit();
    res.json({
      data: {
        staffId: String(staffId),
        serviceId: String(serviceId),
        serviceRemoved: canHardDelete,
        /* Dịch vụ còn trong danh mục thì báo rõ, giao diện không hiển thị
           nhầm là đã xoá hẳn. */
        keptInCatalog: !canHardDelete,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}