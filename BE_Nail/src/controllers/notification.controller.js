/* ===== Thông báo: hộp thư khách + đăng ký máy + giám sát gửi ===== */

import { pool } from '../config/database.js';
import { sendExpoPush } from '../lib/notifications.js';

/* Khách đăng ký máy để nhận push: mỗi token một dòng, máy đăng nhập lại
   thì cập nhật updated_at (giới hạn 5 máy mới nhất khi đẩy). */
export async function registerDevice(req, res, next) {
  try {
    const token = String(req.body?.pushToken ?? '').trim().slice(0, 255);
    const platform = ['android', 'ios', 'web'].includes(req.body?.platform)
      ? req.body.platform : 'android';
    if (!token) return res.status(400).json({ message: 'Thiếu push token của máy.' });
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return res.status(400).json({ message: 'Push token không đúng định dạng Expo.' });
    }

    await pool.query(
      `INSERT INTO device_token (user_id, platform, push_token)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)`,
      [req.user.userId, platform, token],
    );
    res.status(201).json({ data: { registered: true } });
  } catch (error) {
    next(error);
  }
}

/* Hộp thư của chính mình, mới nhất trước. */
export async function listMine(req, res, next) {
  try {
    const onlyUnread = String(req.query.unread ?? '') === '1';
    const [rows] = await pool.query(
      `SELECT notification_id AS id, title, body, type, ref_type AS refType,
              ref_id AS refId, channel, status, sent_at AS sentAt,
              read_at AS readAt, created_at AS createdAt
         FROM notification
        WHERE user_id = ? AND channel = 'INAPP'
        ${onlyUnread ? "AND status <> 'READ'" : ''}
        ORDER BY created_at DESC LIMIT 50`,
      [req.user.userId],
    );
    const unread = rows.filter((r) => r.status !== 'READ').length;
    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        refId: row.refId == null ? null : String(row.refId),
      })),
      meta: { unread },
    });
  } catch (error) {
    next(error);
  }
}

/* Đánh dấu đã đọc (chỉ tin của chính mình). */
export async function markRead(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã thông báo không hợp lệ.' });
    const [result] = await pool.query(
      `UPDATE notification SET status = 'READ', read_at = NOW()
        WHERE notification_id = ? AND user_id = ? AND channel = 'INAPP'`,
      [id, req.user.userId],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    }
    res.json({ data: { id: String(id), status: 'READ' } });
  } catch (error) {
    next(error);
  }
}

/* Admin giám sát gửi: FAILED nổi trước để gọi tay/SMS cho khách. */
export async function listAll(req, res, next) {
  try {
    const status = ['PENDING', 'SENT', 'FAILED', 'READ'].includes(String(req.query.status ?? '').toUpperCase())
      ? String(req.query.status).toUpperCase() : null;
    const [rows] = await pool.query(
      `SELECT n.notification_id AS id, n.title, n.body, n.type,
              n.ref_type AS refType, n.ref_id AS refId, n.channel, n.status,
              n.attempts, n.error_message AS errorMessage,
              n.sent_at AS sentAt, n.created_at AS createdAt,
              COALESCE(u.full_name, '(khach vang lai)') AS userName, u.phone
         FROM notification n
         LEFT JOIN users u ON u.user_id = n.user_id
        ${status ? 'WHERE n.status = ?' : ''}
        ORDER BY FIELD(n.status, 'FAILED', 'PENDING', 'SENT', 'READ'), n.created_at DESC
        LIMIT 200`,
      status ? [status] : [],
    );
    res.json({
      data: rows.map((row) => ({
        ...row,
        id: String(row.id),
        refId: row.refId == null ? null : String(row.refId),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/* Thử đẩy lại một tin PUSH bị FAILED (đếm attempts để thấy đã thử mấy lần). */
export async function retrySend(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Mã thông báo không hợp lệ.' });
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT n.notification_id AS nid, n.title, n.body, n.type, n.ref_type AS refType,
              n.ref_id AS refId, n.channel, n.status,
              (SELECT dt.push_token FROM device_token dt
                WHERE dt.user_id = n.user_id ORDER BY dt.updated_at DESC LIMIT 1) AS token
         FROM notification n WHERE n.notification_id = ? LIMIT 1 FOR UPDATE`, [id],
    );
    if (!row) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    }
    if (row.channel !== 'PUSH' || row.status !== 'FAILED') {
      await connection.rollback();
      return res.status(409).json({ message: 'Chỉ thử lại tin PUSH đang FAILED.' });
    }
    if (!row.token) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Khách chưa đăng ký máy nào — gọi điện/SMS trực tiếp cho khách.',
      });
    }
    const sent = await sendExpoPush(row.token, row.title, row.body, {
      refType: row.refType, refId: row.refId,
    });
    await connection.query(
      `UPDATE notification SET status = ?, attempts = attempts + 1,
              error_message = ?, sent_at = CASE WHEN ? = 'SENT' THEN NOW() ELSE sent_at END
        WHERE notification_id = ?`,
      [sent.ok ? 'SENT' : 'FAILED', sent.ok ? null : sent.error, sent.ok ? 'SENT' : 'FAILED', id],
    );
    await connection.commit();
    res.json({ data: { id: String(id), status: sent.ok ? 'SENT' : 'FAILED', error: sent.error ?? null } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}
