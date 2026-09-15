import { Router } from 'express';
import { createBooking, getAvailableSlots, getBookings } from '../controllers/booking.controller.js';

const router = Router();
router.get('/availability', getAvailableSlots);
router.get('/', getBookings);
router.post('/', createBooking);
export default router;
