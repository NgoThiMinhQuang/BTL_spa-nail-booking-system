import { Router } from 'express';
import {
  listMyServices, listStaffCategories,
} from '../controllers/staff-service.controller.js';
import { authenticate, requireStaff } from '../lib/auth.js';

const router = Router();

/* Chỉ đọc. Trước đây ở đây có cả POST / PUT / DELETE cho phép nhân viên
   tự tạo, sửa và xoá dịch vụ — trái với quyền hạn trong README và cho
   phép nhân viên tự quyết giá. Nay việc ghi thuộc /api/admin/catalog/*. */
router.use(authenticate, requireStaff);

router.get('/categories', listStaffCategories);
router.get('/', listMyServices);

export default router;