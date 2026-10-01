import { Router } from 'express';
import {
  createBooking,
  getAvailableSlots,
  getBookings,
  updateBookingStatus,
} from '../controllers/booking.controller.js';

const router = Router();
router.get('/availability', getAvailableSlots);
router.get('/', getBookings);
router.post('/', createBooking);
/* Nhân viên cập nhật tiến trình phục vụ. Khu quản trị gọi chung file này
   nhưng bị chặn hai bước này ở tầng controller của khu quản trị. */
router.patch('/:id/status', updateBookingStatus);
export default router;