import { Router } from 'express';
import {
  createLeaveRequest,
  createScheduleRequest,
  listMyLeaveRequests,
  listMyScheduleRequests,
} from '../controllers/request.controller.js';
import { staffDashboard } from '../controllers/staff-dashboard.controller.js';
import { authenticate, requireStaff } from '../lib/auth.js';

const router = Router();

/* Mọi thứ dưới đây là việc riêng của nhân viên, nên bắt buộc có token
   vai trò STAFF. Trước đây nhân viên tự chọn id trên URL và không có
   kiểm tra gì cả. */
router.use(authenticate, requireStaff);

/* Bảng điều khiển: chỉ trả lịch của chính mình. */
router.get('/dashboard', staffDashboard);

/* Yêu cầu nghỉ — chỉ tạo cho chính mình, không tự duyệt được. */
router.post('/leave-requests', createLeaveRequest);
router.get('/leave-requests', listMyLeaveRequests);

/* Yêu cầu lịch làm việc — chỉ gửi đề nghị, chưa có hiệu lực. */
router.post('/schedule-requests', createScheduleRequest);
router.get('/schedule-requests', listMyScheduleRequests);

export default router;