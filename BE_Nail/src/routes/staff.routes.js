import { Router } from 'express';
import { getStaff, listStaff } from '../controllers/staff.controller.js';
import {
  createLeaveRequest,
  createScheduleRequest,
  listMyLeaveRequests,
  listMyScheduleRequests,
} from '../controllers/request.controller.js';
import {
  checkIn,
  checkOut,
  listMyAttendance,
} from '../controllers/attendance.controller.js';
import { staffDashboard } from '../controllers/staff-dashboard.controller.js';
import { authenticate, requireStaff } from '../lib/auth.js';

const router = Router();

/* Trước đây nhân viên tự chọn id trên URL và không có kiểm tra gì cả, nên
   chỉ cần đổi con số là xem được lịch của nhân viên khác. Nay danh tính
   lấy từ token. */

/* ================================================================
   1. ĐƯỜNG RIÊNG CỦA NHÂN VIÊN
   ---------------------------------------------------------------
   Phải khai báo TRƯỚC `/:id` bên dưới, nếu không chuỗi "dashboard" hay
   "leave-requests" sẽ bị `:id` nuốn và nhân viên không vào được màn
   hình của chính mình. */
router.get('/dashboard', authenticate, requireStaff, staffDashboard);

/* Yêu cầu nghỉ — chỉ tạo cho chính mình, không tự duyệt được. */
router.post('/leave-requests', authenticate, requireStaff, createLeaveRequest);
router.get('/leave-requests', authenticate, requireStaff, listMyLeaveRequests);

/* Yêu cầu lịch làm việc — chỉ gửi đề nghị, chưa có hiệu lực. */
router.post('/schedule-requests', authenticate, requireStaff, createScheduleRequest);
router.get('/schedule-requests', authenticate, requireStaff, listMyScheduleRequests);

/* Chấm công thực tế — chỉ cho chính mình, chỉ trong hôm nay. */
router.post('/attendance/check-in', authenticate, requireStaff, checkIn);
router.post('/attendance/check-out', authenticate, requireStaff, checkOut);
router.get('/attendance/me', authenticate, requireStaff, listMyAttendance);

/* ================================================================
   2. DANH MỤC NHÂN VIÊN — công khai
   ---------------------------------------------------------------
   Khách cần xem nhân viên và hồ sơ của họ TRƯỚC khi đặt lịch, nên hai
   đường này không yêu cầu đăng nhập. Nội dung trả về chỉ gồm tên, ảnh,
   chuyên môn, kinh nghiệm và điểm đánh giá — không có thông tin riêng tư
   nào cần đăng nhập.

   Đặt CUỐI router vì `/:id` sẽ khớp mọi đường còn lại. */
router.get('/', listStaff);
router.get('/:id', getStaff);

export default router;