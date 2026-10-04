import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import customerRoutes from './routes/customer.routes.js';
import homeRoutes from './routes/home.routes.js';
import serviceRoutes from './routes/service.routes.js';
import staffServiceRoutes from './routes/staff-service.routes.js';
import staffRoutes from './routes/staff.routes.js';
import { getMyPayments } from './controllers/payment.controller.js';
import { authenticate, requireCustomer } from './lib/auth.js';

export const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: { directives: {
  imgSrc: ["'self'", 'data:', 'https:'],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
} } }));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(currentDirectory, '../public/uploads')));

/* Hai giao diện tách riêng, mỗi bên một bản build Vite:
     /staff -> Admin-web      (không gian nhân viên)
     /admin -> AdminPanel-web (khu vực quản trị)

   Lưu ý: việc hiển thị giao diện ở đây KHÔNG phải bảo mật. Cả hai đều
   là trang tĩnh công khai, và bảo vệ thật nằm ở các API: mọi đường
   /api/admin/* yêu cầu token vai trò ADMIN, mọi đường /api/staff/*
   yêu cầu token vai trò STAFF. Giao diện chỉ tự ẩn màn hình khi
   chưa đăng nhập, còn dữ liệu thì backend không chịu trả cho người
   không đúng vai trò. */
const staffWebBuild = path.resolve(currentDirectory, '../../Admin-web/dist');
const adminWebBuild = path.resolve(currentDirectory, '../../AdminPanel-web/dist');

app.use('/staff', express.static(staffWebBuild, { index: false, maxAge: '1h' }));
app.get(/^\/staff(\/.*)?$/, (_req, res) => res.sendFile(path.join(staffWebBuild, 'index.html')));

app.use('/admin', express.static(adminWebBuild, { index: false, maxAge: '1h' }));
app.get(/^\/admin(\/.*)?$/, (_req, res) => res.sendFile(path.join(adminWebBuild, 'index.html')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nailhouse-api' }));

/* ---- Đăng nhập ----
   Đăng ký và đăng nhập là hai đường công khai duy nhất của toàn hệ
   thống. Mọi đường còn lại đều đi qua middleware authenticate, kiểm tra
   token và tài khoản còn ACTIVE. */
app.use('/api/auth', authRoutes);

/* ---- Danh mục công khai: khách xem dịch vụ và nhân viên ----
   Các API này không chứa dữ liệu cá nhân nên mở công khai, giúp khách
   xem dịch vụ và nhân viên trước khi đăng ký. */
app.use('/api/home', homeRoutes);
app.use('/api/services', serviceRoutes);

/* ---- Hồ sơ khách phía nhân viên, danh mục dịch vụ của nhân viên ----
   Hai nhóm này MANG ĐƯỜNG DẪN RIÊNG (/api/staff/customers, /api/staff/services)
   nên phải đăng ký TRƯỚC /api/staff. Nếu để sau, router của /api/staff sẽ
   bắt trước và áp middleware "bắt buộc token nhân viên" lên cả hai — đúng
   vai trò thì chạy, nhưng dễ vỡ khi ai đó thêm route mới. */
app.use('/api/staff/customers', customerRoutes);
app.use('/api/staff/services', staffServiceRoutes);

/* Danh mục nhân viên: / và /:id công khai cho khách xem trước khi đặt lịch,
   còn /dashboard và /leave-requests bắt buộc token nhân viên (xem trong
   staff.routes.js). */
app.use('/api/staff', staffRoutes);

/* ---- Lịch hẹn phía khách + cập nhật tiến trình của nhân viên ----
   Router tự gắn middleware theo từng nhóm: xem lịch và đặt lịch cần
   token CUSTOMER, bắt đầu/hoàn thành cần token STAFF. */
app.use('/api/bookings', bookingRoutes);

/* ---- Thanh toán của khách ---- */
app.get('/api/customer/payments', authenticate, requireCustomer, getMyPayments);

/* ---- Khu quản trị ----
   Router này tự bắt buộc token ADMIN ngay từ đầu, nên mọi đường bên
   dưới đều được bảo vệ mà không cần ghi lặp ở từng route. */
app.use('/api/admin', adminRoutes);

app.use((_req, res) => res.status(404).json({ message: 'API endpoint không tồn tại' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Máy chủ đang gặp lỗi', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
});