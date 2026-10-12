/* ===== Tích hợp VNPay (thanh toán đặt cọc) =====

   Luồng: Mobile xin ý định cọc → backend tạo URL thanh toán VNPay →
   khách trả trên trang VNPay → VNPay gọi về returnUrl / IPN → backend
   xác thực chữ ký, ghi DEPOSITED và xác nhận lịch.

   Cấu hình qua biến môi trường:

     VNPAY_TMN_CODE     mã website đăng ký ở sandbox.vnpayment.vn
     VNPAY_HASH_SECRET  chuỗi bí mật đi kèm
     VNPAY_URL          mặc định cổng thanh toán sandbox
     VNPAY_RETURN_URL   backend tự suy từ request nếu không đặt
     VNPAY_MOCK         "true" để dùng trang cọc giả lập khi chưa có
                        tài khoản sandbox (mặc định bật khi thiếu key)

   Chế độ giả lập (MOCK) dựng đúng flow thật: trang thanh toán mẫu hiển
   thị số tiền, nút "Thanh toán thành công" ký sẵn chữ ký hợp lệ rồi đi
   qua đúng đường return xác thực — đổi sang VNPay thật chỉ cần điền key,
   không sửa code. */

import crypto from 'node:crypto';

export const VNPAY_VERSION = '2.1.0';
export const VNPAY_COMMAND = 'pay';
export const VNPAY_CURR = 'VND';
export const VNPAY_LOCALE_DEFAULT = 'vn';
export const VNPAY_SANDBOX_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

export function vnpayConfig() {
  const tmnCode = String(process.env.VNPAY_TMN_CODE ?? '').trim();
  const hashSecret = String(process.env.VNPAY_HASH_SECRET ?? '').trim();
  return {
    tmnCode,
    hashSecret,
    url: String(process.env.VNPAY_URL ?? '').trim() || VNPAY_SANDBOX_URL,
    returnUrl: String(process.env.VNPAY_RETURN_URL ?? '').trim(),
    mock: String(process.env.VNPAY_MOCK ?? '').toLowerCase() === 'true'
      || (!tmnCode || !hashSecret),
  };
}

/** Sắp xếp tham số và ký HMAC-SHA512 đúng mẫu Node.js của VNPay.
   Lưu ý: VNPay tính cả tham số rỗng ('') vào hash trả về, nên chỉ bỏ
   undefined/null — không được lọc ''. Key giữ nguyên (toàn ASCII),
   value encodeURIComponent với khoảng trắng thành '+'. */
export function vnpaySign(params, secret) {
  const sorted = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    sorted[key] = encodeURIComponent(String(value)).replace(/%20/g, '+');
  }
  const hashData = Object.keys(sorted).map((key) => `${key}=${sorted[key]}`).join('&');
  return crypto.createHmac('sha512', secret).update(Buffer.from(hashData, 'utf-8')).digest('hex');
}

/**
 * Tạo URL thanh toán.
 * amountVnd: số tiền VND (sẽ nhân 100 theo quy định VNPay).
 * txnRef: mã tham chiếu duy nhất của giao dịch (bookingId + mốc giờ).
 */
export function buildPaymentUrl({ amountVnd, txnRef, orderInfo, ipAddr, returnUrl, locale, bankCode }) {
  const { tmnCode, hashSecret, url } = vnpayConfig();
  const created = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    + `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  /* Hết hạn thanh toán trên cổng đúng bằng hạn giữ chỗ (15 phút). */
  const expire = new Date(created.getTime() + 15 * 60 * 1000);
  const params = {
    vnp_Version: VNPAY_VERSION,
    vnp_Command: VNPAY_COMMAND,
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(Number(amountVnd) * 100),
    vnp_CurrCode: VNPAY_CURR,
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: locale || VNPAY_LOCALE_DEFAULT,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || '127.0.0.1',
    vnp_CreateDate: stamp(created),
    vnp_ExpireDate: stamp(expire),
  };
  if (bankCode) params.vnp_BankCode = bankCode;
  const secureHash = vnpaySign(params, hashSecret);
  const query = Object.keys(params).sort()
    .map((key) => `${key}=${encodeURIComponent(String(params[key])).replace(/%20/g, '+')}`)
    .join('&');
  return `${url}?${query}&vnp_SecureHash=${secureHash}`;
}

/**
 * Xác thực dữ liệu VNPay trả về (return + IPN dùng chung).
 * Trả { valid, params } — valid false khi sai chữ ký hoặc thiếu hash.
 */
export function verifyReturn(query) {
  const { hashSecret } = vnpayConfig();
  const params = { ...(query ?? {}) };
  const received = String(params.vnp_SecureHash ?? '');
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;
  if (!received || !hashSecret) return { valid: false, params };
  const expected = vnpaySign(params, hashSecret);
  return { valid: expected === received.toLowerCase(), params };
}

/** Mã tham chiếu giao dịch: bookingId + mốc giờ để mỗi lần cọc là duy nhất. */
export function depositTxnRef(bookingId, at = Date.now()) {
  return `${bookingId}-${at}`;
}

/** Tách bookingId từ mã tham chiếu (phần trước dấu gạch đầu tiên). */
export function bookingIdFromTxnRef(txnRef) {
  const id = Number(String(txnRef ?? '').split('-')[0]);
  return Number.isInteger(id) ? id : null;
}

/* ================================================================
   API hoàn tiền VNPay (P0.4)
   ----------------------------------------------------------------
   Sổ két chỉ ghi "đã hoàn" khi cổng xác nhận — trước đây settle ghi
   REFUNDED + dòng REFUND mà chưa hề gọi cổng. Cần cả hai mã gốc của
   giao dịch cọc (vnp_TxnRef của merchant + vnp_TransactionNo của
   VNPay) nên confirmDepositPayment phải lưu chúng vào bảng payment.
   ================================================================ */

export const VNPAY_API_SANDBOX = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
export const VNPAY_API_PROD = 'https://vnpayment.vn/merchant_webapi/api/transaction';

/** URL gọi hoàn: ưu tiên VNPAY_API_URL, còn lại theo sandbox/prod. */
export function vnpayApiUrl() {
  const custom = String(process.env.VNPAY_API_URL ?? '').trim();
  if (custom) return custom;
  const { url } = vnpayConfig();
  return url.includes('sandbox') ? VNPAY_API_SANDBOX : VNPAY_API_PROD;
}

const stamp14 = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    + `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

/** Dựng payload hoàn toàn tiền (vnp_TransactionType 02). Thuần túy, test được. */
export function buildRefundPayload({
  requestId, txnRef, txnNo, amountVnd, orderInfo,
  transactionDate, createBy = 'system', ipAddr = '127.0.0.1', createDate = new Date(),
}) {
  const { tmnCode, hashSecret } = vnpayConfig();
  const created = stamp14(createDate instanceof Date ? createDate : new Date(createDate));
  const params = {
    vnp_RequestId: String(requestId),
    vnp_Version: VNPAY_VERSION,
    vnp_Command: 'refund',
    vnp_TmnCode: tmnCode,
    vnp_TransactionType: '02',
    vnp_TxnRef: String(txnRef),
    vnp_Amount: Math.round(Number(amountVnd) * 100),
    vnp_OrderInfo: String(orderInfo ?? `Hoan tien ${txnRef}`).slice(0, 255),
    vnp_TransactionNo: String(txnNo),
    vnp_TransactionDate: String(transactionDate),
    vnp_CreateBy: String(createBy).slice(0, 50),
    vnp_CreateDate: created,
    vnp_IpAddr: String(ipAddr || '127.0.0.1'),
  };
  /* Chữ ký hoàn khác chữ ký pay: nối bằng '|' theo đúng thứ tự VNPay
     quy định, không sort + không encode query. */
  const data = [
    params.vnp_RequestId, params.vnp_Version, params.vnp_Command,
    params.vnp_TmnCode, params.vnp_TransactionType, params.vnp_TxnRef,
    params.vnp_Amount, params.vnp_OrderInfo, params.vnp_TransactionNo,
    params.vnp_TransactionDate, params.vnp_CreateBy, params.vnp_CreateDate,
    params.vnp_IpAddr,
  ].join('|');
  params.vnp_SecureHash = crypto
    .createHmac('sha512', hashSecret).update(Buffer.from(data, 'utf-8')).digest('hex');
  return params;
}

/**
 * Gọi hoàn tiền lên VNPay. Không bao giờ ném lỗi — trả { ok, message? }.
 * fetchImpl để test chích stub, không gọi mạng thật.
 */
export async function refundViaVNPay(input, fetchImpl = fetch) {
  const config = vnpayConfig();
  if (config.mock || !config.tmnCode || !config.hashSecret) {
    return { ok: false, error: 'VNPay chưa cấu hình (đang ở chế độ giả lập hoặc thiếu key).' };
  }
  if (!input?.txnNo) {
    return { ok: false, error: 'Thiếu mã giao dịch gốc của VNPay nên không gọi hoàn được.' };
  }
  try {
    const payload = buildRefundPayload(input);
    const response = await fetchImpl(vnpayApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => null);
    const code = String(result?.vnp_ResponseCode ?? '');
    if (response.ok && code === '00') return { ok: true, code, message: String(result?.vnp_Message ?? 'OK') };
    return { ok: false, code: code || String(response.status), error: String(result?.vnp_Message ?? `VNPay trả về ${code || response.status}`) };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).slice(0, 200) };
  }
}
