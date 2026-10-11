import 'dotenv/config';
import { app } from './app.js';
import { checkDatabaseConnection } from './config/database.js';
import { sweepExpiredDeposits } from './controllers/deposit.controller.js';
import { DEPOSIT_WINDOW_MINUTES } from './lib/deposit.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await checkDatabaseConnection();
  app.listen(port, host, () => {
    console.log(`NailHouse API: http://${host}:${port}`);
  });

  /* Lịch PENDING quá hạn cọc thì tự hủy để trả slot cho khách khác. */
  console.log(`Sweeper giữ chỗ: tự hủy lịch PENDING quá ${DEPOSIT_WINDOW_MINUTES} phút chưa cọc, mỗi 60 giây.`);
  setInterval(async () => {
    try {
      const { cancelled } = await sweepExpiredDeposits();
      if (cancelled > 0) {
        console.log(`Tự động hủy ${cancelled} lịch quá ${DEPOSIT_WINDOW_MINUTES} phút chờ đặt cọc.`);
      }
    } catch (error) {
      console.error('Quét lịch quá hạn cọc thất bại:', error.message);
    }
  }, 60 * 1000).unref?.();
} catch (error) {
  console.error('Không thể kết nối MySQL:', error.message);
  process.exit(1);
}
