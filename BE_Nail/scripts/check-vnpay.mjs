/* Kiểm tra key VNPay sandbox: node scripts/check-vnpay.mjs
   Đọc VNPAY_TMN_CODE/SECRET từ .env, sinh URL thanh toán thử 150.000đ
   rồi tự xác thực ngược chữ ký — đạt là key sống và code hashing đúng. */
import 'dotenv/config';
import { buildPaymentUrl, verifyReturn, vnpayConfig } from '../src/lib/vnpay.js';

const config = vnpayConfig();
if (!config.tmnCode || !config.hashSecret) {
  console.error('THIEU KEY: dien VNPAY_TMN_CODE + VNPAY_HASH_SECRET vao BE_Nail/.env');
  process.exit(1);
}
const url = buildPaymentUrl({
  amountVnd: 150000,
  txnRef: `CHECK-${Date.now()}`,
  orderInfo: 'Kiem tra key VNPay',
  ipAddr: '127.0.0.1',
  returnUrl: config.returnUrl || 'http://localhost:3000/api/payments/vnpay-return',
});
console.log('URL thanh toan thu:\n' + url);

const query = Object.fromEntries(new URL(url).searchParams.entries());
const { valid } = verifyReturn(query);
if (!valid) {
  console.error('SAI CHU KY: URL vua sinh khong tu xac thuc nguoc duoc.');
  process.exit(1);
}
console.log('KEY SONG: chu ky tu xac thuc nguoc hop le. Dan URL tren vao trinh duyet de thay trang sandbox VNPay.');
