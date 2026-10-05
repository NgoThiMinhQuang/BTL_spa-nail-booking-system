/* ===== API đăng ký / đăng nhập / hồ sơ cá nhân =====

   Đây là lớp xác thực thật của hệ thống. Trước đây ứng dụng Mobile
   đặt lịch với `customerId: 1` cứng trong code, và khu quản trị chỉ
   kiểm tra một khoá localStorage — không có gì chặn người khác gọi
   thẳng vào /api/admin.

   Nay mỗi bên đăng nhập thật:
     - Mobile  : Customer tự đăng ký, nhận token và dùng token đó cho mọi
                 lệnh gọi sau đó.
     - Nhân viên: tài khoản do Admin cấp (users.role = 'STAFF').
     - Quản trị: tài khoản users.role = 'ADMIN'. */

import { pool } from '../config/database.js';
import {
  authenticate, hashPassword, passwordProblem, signToken, verifyPassword,
} from '../lib/auth.js';
import { normalisePhone, isValidPhone } from './walkin.controller.js';

/** Chuẩn hoá điện thoại và kiểm tra định dạng số điện thoại Việt Nam. */
function readPhone(value) {
  const phone = normalisePhone(value);
  if (!isValidPhone(phone)) return { error: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.' };
  return { phone };
}

/** Đóng gói thông tin trả về cho client sau khi đăng nhập. */
function sessionOf(user, token) {
  return {
    token,
    user: {
      userId: String(user.userId),
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      customerId: user.customerId == null ? null : String(user.customerId),
      staffId: user.staffId == null ? null : String(user.staffId),
    },
  };
}

/* ================================================================
   POST /api/auth/register — Khách tự đăng ký
   ---------------------------------------------------------------
   Chỉ tạo tài khoản CUSTOMER. Nhân viên và quản trị do Admin cấp,
   không ai tự đăng ký được vai trò đó.
   ================================================================ */
export async function register(req, res, next) {
  try {
    const fullName = String(req.body?.fullName ?? '').trim().replace(/\s+/g, ' ');
    const email = String(req.body?.email ?? '').trim().toLowerCase() || null;
    const password = String(req.body?.password ?? '');

    if (fullName.length < 2 || fullName.length > 100) {
      return res.status(400).json({ message: 'Họ tên cần từ 2 đến 100 ký tự.' });
    }
    const { phone, error: phoneError } = readPhone(req.body?.phone);
    if (phoneError) return res.status(400).json({ message: phoneError });

    const passwordError = passwordProblem(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ.' });
    }

    /* Số điện thoại là định danh duy nhất của khách — trùng thì báo lại
       ngay thay vì đẩy lỗi khoá duy nhất từ MySQL lên cho người dùng. */
    const [[taken]] = await pool.query('SELECT 1 FROM users WHERE phone = ? LIMIT 1', [phone]);
    if (taken) {
      return res.status(409).json({ message: 'Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.' });
    }
    if (email) {
      const [[emailTaken]] = await pool.query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [email]);
      if (emailTaken) return res.status(409).json({ message: 'Email này đã được sử dụng.' });
    }

    const hashed = await hashPassword(password);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO users (full_name, phone, email, password, role, status)
         VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
        [fullName, phone, email, hashed],
      );
      /* Mỗi khách phải có đúng một hồ sơ trong bảng customer để mọi lịch
         hẹn và chỉ số tích luỹ gắn được vào một người. */
      await connection.query('INSERT INTO customer (user_id) VALUES (?)', [result.insertId]);
      /* customer_id là auto-inc riêng của bảng customer — KHÔNG dùng
         user_id làm customerId. Hai dãy lệch nhau ngay khi có tài khoản
         STAFF/ADMIN xen giữa hoặc có dòng bị xoá; dùng nhầm thì token mới
         đăng ký mang customerId sai và đặt lịch nhầm chủ tới khi login
         lại (login đọc đúng c.customer_id). */
      const [[customer]] = await connection.query(
        'SELECT customer_id FROM customer WHERE user_id = ? LIMIT 1', [result.insertId]);
      await connection.commit();

      const token = signToken({ userId: result.insertId, role: 'CUSTOMER' });
      res.status(201).json({
        data: sessionOf({
          userId: Number(result.insertId),
          name: fullName,
          phone,
          email,
          avatar: null,
          role: 'CUSTOMER',
          customerId: Number(customer.customer_id),
          staffId: null,
        }, token),
      });
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Số điện thoại hoặc email đã tồn tại.' });
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   POST /api/auth/login
   ---------------------------------------------------------------
   Chấp nhận cả số điện thoại và email làm "tài khoản". Trả lỗi chung
   cho cả hai trường hợp sai tài khoản lẫn sai mật khẩu để không lộ
   ra tài khoản nào đang tồn tại.
   ================================================================ */
export async function login(req, res, next) {
  try {
    const identifier = String(req.body?.identifier ?? req.body?.phone ?? req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập tài khoản và mật khẩu.' });
    }

    const value = normalisePhone(identifier);
    const [[account]] = await pool.query(
      `SELECT u.user_id, u.full_name, u.phone, u.email, u.avatar, u.role, u.status,
              u.password, c.customer_id, st.staff_id
         FROM users u
         LEFT JOIN customer c ON c.user_id = u.user_id
         LEFT JOIN staff st ON st.user_id = u.user_id
        WHERE u.phone = ? OR u.email = ? LIMIT 1`,
      [value, identifier.toLowerCase()],
    );

    const invalid = { message: 'Tài khoản hoặc mật khẩu không đúng.' };
    if (!account) return res.status(401).json(invalid);

    const ok = await verifyPassword(password, account.password);
    if (!ok) return res.status(401).json(invalid);

    /* Tài khoản bị khoá vẫn đăng nhập được mật khẩu nhưng không được vào
       hệ thống — báo riêng để người dùng biết cần liên hệ cửa hàng. */
    if (account.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Tài khoản đã bị khoá. Vui lòng liên hệ cửa hàng.' });
    }

    const user = {
      userId: Number(account.user_id),
      name: account.full_name,
      phone: account.phone,
      email: account.email,
      avatar: account.avatar,
      role: account.role,
      customerId: account.customer_id == null ? null : Number(account.customer_id),
      staffId: account.staff_id == null ? null : Number(account.staff_id),
    };

    res.json({ data: sessionOf(user, signToken({ userId: user.userId, role: user.role })) });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   GET /api/auth/me — hồ sơ người đang đăng nhập
   ================================================================ */
export async function me(req, res, next) {
  try {
    res.json({
      data: {
        userId: String(req.user.userId),
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
        avatar: req.user.avatar,
        role: req.user.role,
        customerId: req.user.customerId == null ? null : String(req.user.customerId),
        staffId: req.user.staffId == null ? null : String(req.user.staffId),
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   PUT /api/auth/profile — cập nhật hồ sơ
   ---------------------------------------------------------------
   Khách được sửa tên, ảnh, điện thoại. Nhân viên sửa tên và ảnh —
   không tự đổi được vai trò hay trạng thái tài khoản.
   ================================================================ */
export async function updateProfile(req, res, next) {
  try {
    const current = req.user;
    const set = [];
    const params = [];

    if (req.body?.fullName !== undefined) {
      const fullName = String(req.body.fullName).trim().replace(/\s+/g, ' ');
      if (fullName.length < 2 || fullName.length > 100) {
        return res.status(400).json({ message: 'Họ tên cần từ 2 đến 100 ký tự.' });
      }
      set.push('full_name = ?'); params.push(fullName);
    }

    if (req.body?.phone !== undefined && current.role === 'CUSTOMER') {
      const { phone, error } = readPhone(req.body.phone);
      if (error) return res.status(400).json({ message: error });
      const [[taken]] = await pool.query(
        'SELECT 1 FROM users WHERE phone = ? AND user_id <> ? LIMIT 1', [phone, current.userId]);
      if (taken) return res.status(409).json({ message: 'Số điện thoại này đã được dùng cho tài khoản khác.' });
      set.push('phone = ?'); params.push(phone);
    }

    if (req.body?.avatar !== undefined) {
      const avatar = String(req.body.avatar).trim();
      /* Chỉ nhận ảnh trong /uploads hoặc đường dẫn http(s): chặn javascript:
         và các lạm dụng khác. */
      if (avatar && !/^https?:\/\//i.test(avatar) && !/^\/uploads\//.test(avatar)) {
        return res.status(400).json({ message: 'Ảnh phải là đường dẫn trong /uploads hoặc http(s).' });
      }
      set.push('avatar = ?'); params.push(avatar || null);
    }

    if (req.body?.address !== undefined && current.customerId) {
      const address = String(req.body.address).trim().slice(0, 255) || null;
      await pool.query('UPDATE customer SET address = ? WHERE customer_id = ?', [address, current.customerId]);
    }

    if (!set.length) return res.json({ data: { updated: false } });

    params.push(current.userId);
    await pool.query(`UPDATE users SET ${set.join(', ')} WHERE user_id = ?`, params);

    const [[row]] = await pool.query(
      `SELECT u.user_id, u.full_name, u.phone, u.email, u.avatar, u.role,
              c.customer_id, st.staff_id
         FROM users u
         LEFT JOIN customer c ON c.user_id = u.user_id
         LEFT JOIN staff st ON st.user_id = u.user_id
        WHERE u.user_id = ? LIMIT 1`, [current.userId]);

    res.json({
      data: {
        userId: String(row.user_id),
        name: row.full_name,
        phone: row.phone,
        email: row.email,
        avatar: row.avatar,
        role: row.role,
        customerId: row.customer_id == null ? null : String(row.customer_id),
        staffId: row.staff_id == null ? null : String(row.staff_id),
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ================================================================
   PUT /api/auth/password — đổi mật khẩu
   ================================================================ */
export async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập mật khẩu cũ và mật khẩu mới.' });
    }
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ message: problem });

    const [[account]] = await pool.query('SELECT password FROM users WHERE user_id = ? LIMIT 1',
      [req.user.userId]);
    const ok = await verifyPassword(currentPassword, account?.password ?? '');
    if (!ok) return res.status(401).json({ message: 'Mật khẩu cũ không đúng.' });

    await pool.query('UPDATE users SET password = ? WHERE user_id = ?',
      [await hashPassword(newPassword), req.user.userId]);

    res.json({ data: { changed: true } });
  } catch (error) {
    next(error);
  }
}