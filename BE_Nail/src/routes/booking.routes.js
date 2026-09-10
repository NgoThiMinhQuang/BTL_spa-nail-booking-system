import { Router } from 'express';
import { createBooking, getAvailableSlots } from '../controllers/booking.controller.js';

const router = Router();
router.get('/availability', getAvailableSlots);
router.post('/', createBooking);
export default router;
