import { Router } from 'express';
import {
  changePassword, login, me, register, updateProfile,
} from '../controllers/auth.controller.js';
import { authenticate } from '../lib/auth.js';

const router = Router();

/* Đăng ký và đăng nhập là hai đường công khai — đây chính là chỗ duy nhất
   một người chưa có token vẫn gọi được. */
router.post('/register', register);
router.post('/login', login);

/* Từ đây trở xuống bắt buộc có token hợp lệ. */
router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.put('/password', authenticate, changePassword);

export default router;