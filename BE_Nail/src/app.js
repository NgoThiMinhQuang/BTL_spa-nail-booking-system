import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bookingRoutes from './routes/booking.routes.js';
import customerRoutes from './routes/customer.routes.js';
import homeRoutes from './routes/home.routes.js';
import serviceRoutes from './routes/service.routes.js';
import staffServiceRoutes from './routes/staff-service.routes.js';
import staffRoutes from './routes/staff.routes.js';
import { staffDashboard } from './controllers/staff-dashboard.controller.js';

export const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: { directives: {
  imgSrc: ["'self'", 'data:', 'https:'],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
} } }));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(currentDirectory, '../public/uploads')));

/* Giao diện nhân viên (Admin-web, bản build Vite): phục vụ file tĩnh trong
   dist/ và trả index.html cho mọi đường dẫn con. */
const adminWebBuild = path.resolve(currentDirectory, '../../Admin-web/dist');
app.use('/staff', express.static(adminWebBuild, { index: false, maxAge: '1h' }));
app.get(/^\/staff(\/.*)?$/, (_req, res) => res.sendFile(path.join(adminWebBuild, 'index.html')));
app.get('/api/staff-dashboard/:id', staffDashboard);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nailhouse-api' }));
app.use('/api/home', homeRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/staff/customers', customerRoutes);
/* Đăng ký trước `/api/staff` để không bị router('/:id') của staff bắt mất. */
app.use('/api/staff/services', staffServiceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/bookings', bookingRoutes);

app.use((_req, res) => res.status(404).json({ message: 'API endpoint không tồn tại' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Máy chủ đang gặp lỗi', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
});
