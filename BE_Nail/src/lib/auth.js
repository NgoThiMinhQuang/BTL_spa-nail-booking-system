/* ===== Xác thực và phân quyền =====

   Trước đây dự án chưa có lớp đăng nhập: mọi API nhận thẳng `customerId`
   hoặc `staffId` từ request, nên bất kỳ ai cũng có thể tự gửi id của
   người khác và xem/hủy/sửa lịch không thuộc về mình.

   Nay có ba tài khoản thật trong bảng `users`, mỗi tài khoản mang đúng
   một vai trò:

     CUSTOMER — khách dùng ứng dụng Mobile
     STAFF    — nhân viên làm việc (chỉ thấy lịch được phân công cho mình)
     ADMIN    — quản trị viên (toàn quyền)

   Nguyên tắc bất di bất dịch: **mọi id người dùng đều lấy từ token, không
   bao giờ lấy từ request body**. Frontend gửi kèm token ở đầu
   `Authorization: Bearer <token>`; backend tự tra `customer_id` /
   `staff_id` từ `users` rồi mới xử lý. */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';

/** Số vòng băm của bcrypt. 10 là giá trị phổ biến, cân bằng giữa an toàn và tốc độ. */
const BCRYPT_ROUNDS = 10;

/** Thời hạn token: 12 giờ — đủ dùng cho một ca làm của nhân viên. */
const TOKEN_TTL = '12h';

/* Khoá ký token phải nằm trong biến môi trường. Nếu không có thì dùng một
   giá trị tạm để dự án vẫn chạy được ở máy sinh viên, nhưng in cảnh báo
   để không vô tình đưa khoá cố định lên Git. */
export const JWT_SECRET = process.env.JWT_SECRET || 'nailhouse-dev-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn('[auth] Chưa đặt JWT_SECRET trong .env — đang dùng khoá mặc định cho môi trường phát triển.');
}

/* ================================================================
   Mật khẩu
   ================================================================ */

/** Mã hoá mật khẩu trước khi lưu. Không bao giờ lưu mật khẩu thô. */
export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Kiểm tra mật khẩu nhập với bản đã mã hoá trong database. */
export function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

/** Ràng buộc mật khẩu tối thiểu cho cả khách lẫn nhân viên. */
export function passwordProblem(plain) {
  const text = String(plain ?? '');
  if (text.length < 6) return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (text.length > 72) return 'Mật khẩu không được vượt quá 72 ký tự.';
  return null;
}

/* ================================================================
   Token
   ================================================================ */

/** Tạo token mang userId + role. Role nhúng vào token để kiểm tra nhanh,
    nhưng luôn được đối chiếu lại với database khi cần id người dùng. */
export function signToken({ userId, role }) {
  return jwt.sign({ sub: String(userId), role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Đọc payload từ token. Trả null nếu token sai hoặc hết hạn. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** Lấy token từ header Authorization (Bearer) hoặc x-access-token. */
export function readToken(req) {
  const header = req.get('authorization') ?? '';
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  return req.get('x-access-token') || null;
}

/* ================================================================
   Nạp người dùng từ token
   ---------------------------------------------------------------
   Hàm này là nguồn duy nhất của customerId / staffId trong toàn bộ hệ
   thống. Nó nối thêm `customer_id` và `staff_id` (nếu có) để các
   controller không phải tự truy vấn lại.
   ================================================================ */

/**
 * Nạp hồ sơ người đang đăng nhập.
 * @returns {Promise<object|null>} null nếu token không hợp lệ hoặc tài khoản
 *          đã bị khoá (INACTIVE).
 */
export async function loadUserFromToken(token) {
  const payload = verifyToken(token);
  if (!payload?.sub) return null;

  const [rows] = await pool.query(
    `SELECT u.user_id, u.full_name, u.phone, u.email, u.avatar, u.role, u.status,
            c.customer_id, st.staff_id
       FROM users u
       LEFT JOIN customer c ON c.user_id = u.user_id
       LEFT JOIN staff st ON st.user_id = u.user_id
      WHERE u.user_id = ? LIMIT 1`,
    [payload.sub],
  );

  const row = rows[0];
  /* Tài khoản bị khoá thì coi như không đăng nhập được, kể cả khi token
     còn hạn — đây là điều kiện bắt buộc của nghiệp vụ. */
  if (!row || row.status !== 'ACTIVE') return null;

  return {
    userId: Number(row.user_id),
    name: row.full_name,
    phone: row.phone,
    email: row.email,
    avatar: row.avatar,
    role: row.role,
    customerId: row.customer_id == null ? null : Number(row.customer_id),
    staffId: row.staff_id == null ? null : Number(row.staff_id),
  };
}

/* ================================================================
   Middleware
   ================================================================ */

/**
 * Bắt buộc đã đăng nhập. Gắn `req.user` (xem loadUserFromToken).
 * Trả 401 khi thiếu token hoặc token không còn hiệu lực.
 */
export async function authenticate(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Cần đăng nhập để thực hiện thao tác này.' });
    }
    const user = await loadUserFromToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khoá.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Chỉ cho đúng các vai trò nêu trong `roles`.
 * Luôn đặt sau `authenticate` vì cần đọc `req.user.role`.
 */
export function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Cần đăng nhập để thực hiện thao tác này.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Tài khoản này không có quyền thực hiện thao tác `
          + `(${roles.join(', ')}).`,
      });
    }
    return next();
  };
}

/** Gọn tiện: yêu cầu đúng một vai trò. */
export const requireAdmin = authorizeRole('ADMIN');
export const requireStaff = authorizeRole('STAFF');
export const requireCustomer = authorizeRole('CUSTOMER');