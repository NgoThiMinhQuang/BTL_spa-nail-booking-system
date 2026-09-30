/* ===== Quản lý dịch vụ của nhân viên (thêm / sửa / gỡ) =====
   Nhân viên tự tạo và chỉnh dịch vụ riêng: tạo bản ghi trong `services` rồi
   gắn vào `staff_service`. Dịch vụ đã có lịch hẹn thì không xoá hẳn khỏi
   `services` (lịch hẹn còn tham chiếu tới), chỉ gỡ khỏi danh sách của nhân viên. */

import { pool } from '../config/database.js';

const MAX_NAME = 150;
const MAX_DESCRIPTION = 2000;
const MAX_IMAGE = 255;
const MAX_PRICE = 1000000000;
const MIN_DURATION = 5;
const MAX_DURATION = 600;
const STATUSES = ['ACTIVE', 'HIDDEN'];

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

/** Chỉ nhận ảnh nằm trong /uploads hoặc http(s) — chặn javascript: và nguồn lạ. */
function cleanImage(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (text.length > MAX_IMAGE) return undefined;
  return /^https?:\/\//i.test(text) || /^\/uploads\//.test(text) ? text : undefined;
}

/**
 * Đọc và kiểm tra dữ liệu gửi lên. Trả về { error } khi sai,
 * còn lại là { value } đã chuẩn hoá để ghép vào câu truy vấn.
 */
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

  const description = String(body?.description ?? '').trim();
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Mô tả tối đa ${MAX_DESCRIPTION} ký tự.` };
  }

  const status = STATUSES.includes(body?.status) ? body.status : 'ACTIVE';

  const image = cleanImage(body?.image);
  if (image === undefined) return { error: 'Ảnh phải là đường dẫn trong /uploads hoặc đường dẫn http(s).' };

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
      description: description || null,
      status,
      image,
      categoryId,
    },
  };
}

/** Dịch vụ có thực sự nằm trong danh sách của nhân viên này không. */
async function linkedService(serviceId, staffId) {
  const [rows] = await pool.query(
    `SELECT s.service_id AS id, s.service_name AS name, s.description, s.image, s.price, s.duration,
      s.status, s.category_id AS categoryId, c.category_name AS category
    FROM services s
    LEFT JOIN service_category c ON c.category_id = s.category_id
    JOIN staff_service ss ON ss.service_id = s.service_id
    WHERE s.service_id = ? AND ss.staff_id = ?`,
    [serviceId, staffId],
  );
  return rows[0] ?? null;
}

/** Nhân viên có tồn tại không — chặn tạo dịch vụ treo vào staff_id không có thật. */
async function staffExists(staffId) {
  const [rows] = await pool.query('SELECT 1 FROM staff WHERE staff_id = ?', [staffId]);
  return Boolean(rows[0]);
}

async function categoryExists(categoryId) {
  const [rows] = await pool.query('SELECT 1 FROM service_category WHERE category_id = ?', [categoryId]);
  return Boolean(rows[0]);
}

/* ---- GET /api/staff/services/categories ---- */
export async function listServiceCategories(_req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT category_id AS id, category_name AS name FROM service_category ORDER BY category_name',
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

/* ---- POST /api/staff/services ---- */
export async function createStaffService(req, res, next) {
  const staffId = validId(req.body?.staffId ?? req.query.staffId);
  if (!staffId) return res.status(400).json({ message: 'Thiếu mã nhân viên.' });

  const { value, error } = readService(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    if (!(await staffExists(staffId))) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên này.' });
    }
    if (value.categoryId && !(await categoryExists(value.categoryId))) {
      return res.status(400).json({ message: 'Danh mục dịch vụ không tồn tại.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [inserted] = await connection.query(
        `INSERT INTO services (service_name, description, image, price, duration, status, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [value.name, value.description, value.image, value.price, value.duration, value.status, value.categoryId],
      );
      const serviceId = inserted.insertId;
      await connection.query('INSERT INTO staff_service (staff_id, service_id) VALUES (?, ?)', [staffId, serviceId]);
      await connection.commit();

      const [rows] = await connection.query(
        'SELECT category_name AS category FROM service_category WHERE category_id = ?',
        [value.categoryId ?? 0],
      );

      res.status(201).json({
        data: {
          id: serviceId, name: value.name, description: value.description, image: value.image,
          price: value.price, duration: value.duration, status: value.status,
          categoryId: value.categoryId, category: rows[0]?.category ?? null,
        },
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
}

/* ---- PUT /api/staff/services/:id ---- */
export async function updateStaffService(req, res, next) {
  const serviceId = validId(req.params.id);
  if (!serviceId) return res.status(400).json({ message: 'Mã dịch vụ không hợp lệ.' });

  const staffId = validId(req.body?.staffId ?? req.query.staffId);
  if (!staffId) return res.status(400).json({ message: 'Thiếu mã nhân viên.' });

  const { value, error } = readService(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const current = await linkedService(serviceId, staffId);
    if (!current) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ này trong danh sách của bạn.' });
    }
    if (value.categoryId && !(await categoryExists(value.categoryId))) {
      return res.status(400).json({ message: 'Danh mục dịch vụ không tồn tại.' });
    }

    /* PUT gửi thiếu khoá categoryId (đổi riêng trạng thái) thì giữ danh mục
       cũ, không xoá nhầm. Muốn bỏ danh mục thì gửi categoryId rỗng. */
    const categoryId = req.body && 'categoryId' in req.body ? value.categoryId : current.categoryId;

    await pool.query(
      `UPDATE services SET service_name = ?, description = ?, image = ?, price = ?,
        duration = ?, status = ?, category_id = ? WHERE service_id = ?`,
      [value.name, value.description, value.image, value.price, value.duration, value.status, categoryId, serviceId],
    );

    const [rows] = await pool.query(
      `SELECT c.category_name AS category FROM services s
       LEFT JOIN service_category c ON c.category_id = s.category_id WHERE s.service_id = ?`,
      [serviceId],
    );

    res.json({
      data: {
        id: serviceId, name: value.name, description: value.description, image: value.image,
        price: value.price, duration: value.duration, status: value.status,
        categoryId, category: rows[0]?.category ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* ---- DELETE /api/staff/services/:id ---- */
export async function deleteStaffService(req, res, next) {
  const serviceId = validId(req.params.id);
  if (!serviceId) return res.status(400).json({ message: 'Mã dịch vụ không hợp lệ.' });

  const staffId = validId(req.body?.staffId ?? req.query.staffId);
  if (!staffId) return res.status(400).json({ message: 'Thiếu mã nhân viên.' });

  try {
    if (!(await linkedService(serviceId, staffId))) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ này trong danh sách của bạn.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM staff_service WHERE staff_id = ? AND service_id = ?', [staffId, serviceId]);

      /* Còn nhân viên khác dùng, hoặc đã có lịch hẹn tham chiếu, thì giữ lại
         bản ghi `services` và chỉ ẩn đi — không xoá để không hỏng dữ liệu cũ. */
      const [[others]] = await connection.query('SELECT 1 FROM staff_service WHERE service_id = ? LIMIT 1', [serviceId]);
      const [[used]] = await connection.query('SELECT 1 FROM booking WHERE service_id = ? LIMIT 1', [serviceId]);
      const removed = !(others && used);
      if (removed) {
        await connection.query('DELETE FROM services WHERE service_id = ?', [serviceId]);
      } else {
        await connection.query("UPDATE services SET status = 'HIDDEN' WHERE service_id = ?", [serviceId]);
      }
      await connection.commit();
      res.json({ data: { id: serviceId, removed } });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
}
