/* ===== API phía nhân viên =====

   Nhân viên KHÔNG tạo, sửa hay xoá dịch vụ. Trước đây có
   POST /api/staff/services, PUT và DELETE ở đây — tức là nhân viên tự
   quyết giá dịch vụ, trong khi README quy định rõ:

     Admin  : thêm, sửa, bật/tắt dịch vụ; gán dịch vụ cho nhân viên
     Staff  : xem dịch vụ mình phục vụ, bắt đầu, thêm món, hoàn thành

   Hai hướng đang mâu thuẫn và đều có thể gây hại — nhân viên sửa giá là
   thay đổi doanh thu của cửa hàng. Nay các đường ghi chuyển hết sang
   /api/admin/catalog/* (catalog.controller.js). Ở đây chỉ còn đọc. */

/* Các hàm dưới đây được giữ lại để các màn hình hiện có tiếp tục chạy
   được, nhưng đã không còn đường ghi dịch vụ từ phía nhân viên. */

import { pool } from '../config/database.js';

/**
 * Danh mục nhân viên phục vụ được, kèm số dịch vụ đang có.
 * Chỉ dịch vụ ACTIVE: nhân viên không cần thấy dịch vụ đã ngừng.
 */
export async function listStaffCategories(_req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT c.category_id AS id, c.category_name AS name, c.description,
              COUNT(s.service_id) AS serviceCount
         FROM service_category c
         LEFT JOIN services s ON s.category_id = c.category_id AND s.status = 'ACTIVE'
        WHERE c.status = 'ACTIVE'
        GROUP BY c.category_id, c.category_name, c.description
        ORDER BY c.category_name`,
    );
    res.json({
      data: rows.map((row) => ({ ...row, id: String(row.id), serviceCount: Number(row.serviceCount) })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Danh sách dịch vụ của một nhân viên — chỉ đọc.
 *
 * `req.user.staffId` lấy từ token. Nhân viên chỉ xem được danh sách dịch
 * vụ của chính mình, không xem được của nhân viên khác.
 */
export async function listMyServices(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT s.service_id AS id, s.service_name AS name, s.description, s.image,
              s.price, s.duration, s.buffer_time AS bufferTime, s.status,
              s.category_id AS categoryId, c.category_name AS category
         FROM staff_service ss
         JOIN services s ON s.service_id = ss.service_id
         LEFT JOIN service_category c ON c.category_id = s.category_id
        WHERE ss.staff_id = ?
        ORDER BY s.status, c.category_name, s.service_name`, [req.user.staffId],
    );

    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        categoryId: row.categoryId == null ? null : String(row.categoryId),
        price: Number(row.price),
        duration: Number(row.duration),
        bufferTime: Number(row.bufferTime ?? 0),
      })),
    });
  } catch (error) {
    next(error);
  }
}