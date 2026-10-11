import { Router } from 'express';
import {
  listMine, markRead, registerDevice,
} from '../controllers/notification.controller.js';
import { authenticate } from '../lib/auth.js';

const router = Router();

/* Mọi vai trò đã đăng nhập đều có hộp thư và máy riêng. */
router.use(authenticate);

router.post('/device', registerDevice);
router.get('/me', listMine);
router.patch('/:id/read', markRead);

export default router;
