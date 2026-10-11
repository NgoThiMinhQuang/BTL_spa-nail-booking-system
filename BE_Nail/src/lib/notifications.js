/* ===== Gửi thông báo cho khách =====

   Ba kênh, độ tin cậy tăng dần theo sự chủ động của khách:
     INAPP — dòng trong hộp thư app, đọc được ngay khi mở app. Luôn ghi,
       không phụ thuộc mạng đẩy, nên là kênh gốc cho mọi sự kiện.
     PUSH  — đẩy Expo tới màn hình khóa qua https://exp.host/--/api/v2/push/send.
       Cần máy khách đã đăng ký push_token. Lỗi mạng/thiết bị chỉ ghi
       FAILED + lý do, KHÔNG ném lỗi (không được sập luồng nghiệp vụ chỉ
       vì không đẩy được thông báo).
     SMS   — kênh dự phòng cho khách vãng lai/khách không có app. Chưa cấu
       hình nhà mạng thì ghi FAILED rõ lý do để Admin thấy và gọi tay.

   Quy tắc 4 của nghiệp vụ: backend tạo bản ghi hoặc gọi API gửi KHÔNG
   đồng nghĩa khách đã nhận — trạng thái SENT chỉ ghi khi cổng đẩy trả về
   ok, ngược lại FAILED kèm attempts để thử lại. */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Ghi một thông báo vào hộp thư (INAPP), trả id. INAPP coi như "đã gửi"
    ngay khi ghi: khách mở app là đọc được. */
export async function createNotification(runner, {
  userId = null, title, body, type = 'GENERAL', refType = null, refId = null,
}) {
  const [result] = await runner.query(
    `INSERT INTO notification (user_id, title, body, type, ref_type, ref_id, channel, status)
     VALUES (?,?,?,?,?,?,'INAPP','SENT')`,
    [userId, String(title).slice(0, 150), String(body).slice(0, 1000), type, refType, refId],
  );
  return result.insertId;
}

/** Đẩy một tin qua Expo tới một push token. Trả { ok, error? }. */
export async function sendExpoPush(pushToken, title, body, data = {}) {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: String(title).slice(0, 120),
        body: String(body).slice(0, 1000),
        data,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => null);
    const ticket = payload?.data;
    if (ticket && ticket.status === 'ok') return { ok: true, receiptId: ticket.id ?? null };
    const message = ticket?.message ?? `Expo tra ve ${response.status}`;
    return { ok: false, error: String(message).slice(0, 500) };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).slice(0, 500) };
  }
}

/**
 * Đẩy tin cho một user qua mọi máy đã đăng ký. Mỗi máy một dòng PUSH
 * (SENT/FAILED riêng) để Admin thấy máy nào nhận được, máy nào lỗi.
 * Không bao giờ ném lỗi ra ngoài.
 */
export async function pushToUser(runner, { userId, title, body, type = 'GENERAL', refType = null, refId = null }) {  const [devices] = await runner.query(
    'SELECT push_token AS token FROM device_token WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5',
    [userId],
  );
  const results = [];
  for (const device of devices) {
    const [row] = await runner.query(
      `INSERT INTO notification (user_id, title, body, type, ref_type, ref_id, channel, status, attempts)
       VALUES (?,?,?,?,?,?,'PUSH','PENDING',0)`,
      [userId, String(title).slice(0, 150), String(body).slice(0, 1000), type, refType, refId],
    );
    const sent = await sendExpoPush(device.token, title, body, { refType, refId });
    await runner.query(
      `UPDATE notification SET status = ?, attempts = attempts + 1,
              error_message = ?, sent_at = CASE WHEN ? = 'SENT' THEN NOW() ELSE sent_at END
        WHERE notification_id = ?`,
      [sent.ok ? 'SENT' : 'FAILED', sent.ok ? null : sent.error, sent.ok ? 'SENT' : 'FAILED', row.insertId],
    );
    results.push({ notificationId: row.insertId, ok: sent.ok, error: sent.error ?? null });
  }
  return results;
}

/* Báo cho chủ một customer_id: hộp thư + đẩy máy. Không bao giờ ném lỗi
   (thông báo là phụ, không được làm hỏng giao dịch chính). */
export async function notifyCustomer(runner, {
  customerId, title, body, type = 'GENERAL', refType = null, refId = null,
}) {
  try {
    if (!customerId) return { notified: false };
    const [[row]] = await runner.query(
      `SELECT u.user_id AS userId FROM customer c
        JOIN users u ON u.user_id = c.user_id
       WHERE c.customer_id = ? LIMIT 1`, [customerId]);
    if (!row) return { notified: false };
    await createNotification(runner, {
      userId: row.userId, title, body, type, refType, refId,
    });
    await pushToUser(runner, {
      userId: row.userId, title, body, type, refType, refId,
    });
    return { notified: true };
  } catch {
    return { notified: false };
  }
}
