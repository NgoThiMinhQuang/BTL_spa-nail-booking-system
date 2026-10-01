import { Router } from 'express';
import {
  getCustomer,
  getOverview,
  getReports,
  listCustomers,
  listLeaveRequests,
  listPayments,
  listReviews,
  listSchedule,
  listServices,
  listStaff,
} from '../controllers/admin.controller.js';
import {
  addAddon,
  addImage,
  bookingCounts,
  createBooking,
  getAvailableStaff,
  getBooking,
  getFreeSlots,
  listBookings,
  patchBooking,
  postAvailability,
  removeAddon,
  removeImage,
} from '../controllers/booking-admin.controller.js';
import {
  listEligibleStaff,
  lookupCustomer,
  walkInSlots,
} from '../controllers/walkin.controller.js';

const router = Router();

router.get('/overview', getOverview);
router.get('/services', listServices);
router.get('/staff', listStaff);
router.get('/customers', listCustomers);
/* Đặt sau /customers để "customers" không bị ":id" nuốt mất. */
router.get('/customers/:id', getCustomer);
router.get('/schedule', listSchedule);
router.get('/leave', listLeaveRequests);
router.get('/reviews', listReviews);
router.get('/payments', listPayments);
router.get('/reports', getReports);

/* ---- Lịch hẹn: đặt trước /:id để không bị "id" nuốt các đường con ---- */
router.get('/bookings', listBookings);
router.get('/bookings/counts', bookingCounts);
router.get('/bookings/availability', getAvailableStaff);
router.get('/bookings/free-slots', getFreeSlots);
router.post('/bookings/availability', postAvailability);
router.post('/bookings', createBooking);

/* ---- Tạo lịch khách walk-in ----
   Đặt trước /bookings/:id để các đường con không bị ":id" nuốt. */
router.get('/walkin/customer', lookupCustomer);
router.get('/walkin/staff', listEligibleStaff);
router.get('/walkin/slots', walkInSlots);

router.get('/bookings/:id', getBooking);
router.patch('/bookings/:id', patchBooking);
router.post('/bookings/:id/addons', addAddon);
router.delete('/bookings/:id/addons/:addonId', removeAddon);
router.post('/bookings/:id/images', addImage);
router.delete('/bookings/:id/images/:imageId', removeImage);

export default router;
