import { Router } from 'express';
import { getCustomerDetail, updateCustomerNote } from '../controllers/customer.controller.js';

const router = Router();
router.get('/:id', getCustomerDetail);
router.put('/:id/note', updateCustomerNote);

export default router;
