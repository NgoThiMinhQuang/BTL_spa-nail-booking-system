import { Router } from 'express';
import { getCustomerDetail, updateCustomerNote } from '../controllers/customer.controller.js';
import { authenticate, requireStaff } from '../lib/auth.js';

const router = Router();

/* Chỉ nhân viên, và chỉ khách hàng mà nhân viên đó từng phục vụ. */
router.use(authenticate, requireStaff);

router.get('/:id', getCustomerDetail);
router.put('/:id/note', updateCustomerNote);

export default router;