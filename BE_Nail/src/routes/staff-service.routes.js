import { Router } from 'express';
import {
  createStaffService, deleteStaffService, listServiceCategories, updateStaffService,
} from '../controllers/staff-service.controller.js';

const router = Router();

router.get('/categories', listServiceCategories);
router.post('/', createStaffService);
router.put('/:id', updateStaffService);
router.delete('/:id', deleteStaffService);

export default router;
