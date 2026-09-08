import { Router } from 'express';
import { getStaff, listStaff } from '../controllers/staff.controller.js';

const router = Router();
router.get('/', listStaff);
router.get('/:id', getStaff);

export default router;
