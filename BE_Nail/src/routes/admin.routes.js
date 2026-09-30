import { Router } from 'express';
import {
  createBooking,
  getOverview,
  getReports,
  listBookings,
  listCustomers,
  listLeaveRequests,
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
router.post('/bookings', createBooking);
router.patch('/bookings/:id', updateBookingStatus);
router.get('/staff', listStaff);
router.get('/customers', listCustomers);
router.get('/schedule', listSchedule);
router.get('/leave', listLeaveRequests);
router.get('/reviews', listReviews);
router.get('/payments', listPayments);
router.get('/reports', getReports);

export default router;
