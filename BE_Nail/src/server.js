import 'dotenv/config';
import { app } from './app.js';
import { checkDatabaseConnection } from './config/database.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await checkDatabaseConnection();
  app.listen(port, host, () => {
    console.log(`NailHouse API: http://${host}:${port}`);
  });
} catch (error) {
  console.error('Không thể kết nối MySQL:', error.message);
  process.exit(1);
}
