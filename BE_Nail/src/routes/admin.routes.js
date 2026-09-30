import { Router } from 'express';
import {
  getOverview,
  listBookings,
  listCustomers,
  listPayments,
  listReviews,
  listSchedule,
  listServices,
  listStaff,
  updateBookingStatus,
} from '../controllers/admin.controller.js';

const router = Router();

router.get('/overview', getOverview);
router.get('/services', listServices);
router.get('/bookings', listBookings);
router.patch('/bookings/:id', updateBookingStatus);
router.get('/staff', listStaff);
router.get('/customers', listCustomers);
router.get('/schedule', listSchedule);
router.get('/reviews', listReviews);
router.get('/payments', listPayments);

export default router;
