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

/* ================================================================
   Kênh Telegram cho tin khẩn cấp (nghỉ đột xuất...)
   ----------------------------------------------------------------
   Expo push chỉ tới khi máy admin đã cài app + đăng ký token; SMS thì
   chưa có nhà mạng. Telegram miễn phí, tới điện thoại ngay cả khi không
   mở app — hợp nhất cho tin "cần biết trong vài phút".

   Cấu hình trong .env (xem .env.example):
     TELEGRAM_BOT_TOKEN   — token @BotFather cấp khi tạo bot.
     TELEGRAM_ADMIN_CHAT_ID — id chat/nhóm nhận tin, nhiều id cách nhau
       bằng dấu phẩy. Lấy bằng cách nhắn cho bot rồi mở
       https://api.telegram.org/bot<token>/getUpdates xem chat.id.
   Chưa cấu hình thì bỏ qua êm (skipped) — luồng nghiệp vụ không dừng.
   ================================================================ */

const TELEGRAM_API = 'https://api.telegram.org';

/** Gửi một tin khẩn tới mọi chat admin. Không bao giờ ném lỗi. */
export async function sendTelegramAlert(text) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chats = String(process.env.TELEGRAM_ADMIN_CHAT_ID ?? '')
    .split(',').map((part) => part.trim()).filter(Boolean);
  if (!token || chats.length === 0) return { skipped: true, sent: 0 };

  let sent = 0;
  for (const chat of chats) {
    try {
      const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 3500) }),
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok === true) sent += 1;
    } catch {
      /* Kênh phụ — ghi nhận gửi hụt, luồng chính vẫn đi tiếp. */
    }
  }
  return { skipped: false, sent };
}

/* ================================================================
   Gmail cho tin khẩn cấp (nghỉ đột xuất...)
   ----------------------------------------------------------------
   Gửi qua SMTP của Google bằng "mật khẩu ứng dụng" (App Password),
   KHÔNG phải mật khẩu đăng nhập Gmail. Cách lấy xem .env.example.
   Gmail cá nhân gửi vài trăm mail/ngày — tiệm mình dùng cho tin khẩn
   thì thoải mái. Chưa cấu hình thì bỏ qua êm (skipped).
   ================================================================ */

let mailer = null;

async function getMailer() {
  if (mailer) return mailer;
  const user = String(process.env.GMAIL_USER ?? '').trim();
  const pass = String(process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '');
  if (!user || !pass) return null;
  const { default: nodemailer } = await import('nodemailer');
  mailer = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return mailer;
}

/** Gửi một email khẩn tới các địa chỉ admin. Không bao giờ ném lỗi. */
export async function sendEmailAlert({ to, subject, text }) {
  const recipients = (Array.isArray(to) ? to : String(to ?? '').split(','))
    .map((part) => String(part).trim()).filter(Boolean);
  if (recipients.length === 0) return { skipped: true, sent: 0 };
  try {
    const transport = await getMailer();
    if (!transport) return { skipped: true, sent: 0 };
    const from = String(process.env.GMAIL_USER ?? '').trim();
    await transport.sendMail({
      from: `"NailHouse Khẩn" <${from}>`,
      to: recipients.join(', '),
      subject: String(subject).slice(0, 150),
      text: String(text).slice(0, 6000),
    });
    return { skipped: false, sent: recipients.length };
  } catch {
    return { skipped: false, sent: 0 };
  }
}

/** Địa chỉ admin nhận mail khẩn, cách nhau bằng dấu phẩy. */
export function adminEmailList() {
  return String(process.env.ADMIN_EMAILS ?? '')
    .split(',').map((part) => part.trim()).filter(Boolean);
}
