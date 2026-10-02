import { Router } from 'express';
import {
  getCustomer,
  getOverview,
  getReports,
  listCustomers,
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
import {
  approveLeaveRequest,
  approveScheduleRequest,
  listLeaveRequests,
  listScheduleRequests,
  rejectLeaveRequest,
  rejectScheduleRequest,
} from '../controllers/request.controller.js';
import { patchPayment, savePayment } from '../controllers/payment.controller.js';
import {
  assignServices,
  createCategory,
  createService,
  createStaff,
  deleteCategory,
  deleteService,
  deleteStaff,
  listCategories,
  removeServiceFromStaff,
  setCategoryStatus,
  setServiceStatus,
  setStaffStatus,
  updateCategory,
  updateService,
  updateStaff,
} from '../controllers/catalog.controller.js';
import { authenticate, requireAdmin } from '../lib/auth.js';

const router = Router();

/* ================================================================
   CỔNG AN TOÀN CỦA KHU QUẢN TRỊ
   ---------------------------------------------------------------
   Trước đây toàn bộ /api/admin/* mở cho mọi người: khu quản trị chỉ
   kiểm tra một khoá trong localStorage trình duyệt, và bất kỳ ai gõ
   trực tiếp GET /api/admin/customers cũng xem được toàn bộ khách hàng,
   doanh thu và đặt / sửa lịch hẹn.

   Nay middleware `authenticate` + `requireAdmin` kiểm tra token và vai
   trò thật ở phía server. Đặt ở đầu router nên không đường nào lọt:
   thêm một route mới mà quên gắn middleware cũng không có đường nào.
   ================================================================ */
router.use(authenticate, requireAdmin);

/* ---- Số liệu toàn cửa hàng ---- */
router.get('/overview', getOverview);
router.get('/staff', listStaff);
router.get('/customers', listCustomers);
/* Đặt sau /customers để "customers" không bị ":id" nuốt mất. */
router.get('/customers/:id', getCustomer);
router.get('/schedule', listSchedule);
router.get('/reviews', listReviews);
router.get('/payments', listPayments);
router.get('/reports', getReports);

/* ---- Danh mục: dịch vụ / danh mục / nhân viên ----
   Trước đây phần ghi nằm ở /api/staff/services, tức là nhân viên tự
   thêm, sửa, xoá và đổi giá dịch vụ. Nay toàn bộ ở đây. */
router.get('/catalog/services', listServices);
router.post('/catalog/services', createService);
router.put('/catalog/services/:id', updateService);
router.patch('/catalog/services/:id/status', setServiceStatus);
router.delete('/catalog/services/:id', deleteService);

router.get('/catalog/categories', listCategories);
router.post('/catalog/categories', createCategory);
router.put('/catalog/categories/:id', updateCategory);
router.patch('/catalog/categories/:id/status', setCategoryStatus);
router.delete('/catalog/categories/:id', deleteCategory);

router.get('/catalog/staff', listStaff);
router.post('/catalog/staff', createStaff);
router.put('/catalog/staff/:id', updateStaff);
router.patch('/catalog/staff/:id/status', setStaffStatus);
router.delete('/catalog/staff/:id', deleteStaff);

/* Gán / gỡ dịch vụ cho nhân viên */
router.post('/catalog/staff/:id/services', assignServices);
router.delete('/catalog/staff/:id/services/:serviceId', removeServiceFromStaff);

/* ---- Yêu cầu nghỉ và lịch làm việc ---- */
router.get('/leave-requests', listLeaveRequests);
router.patch('/leave-requests/:id/approve', approveLeaveRequest);
router.patch('/leave-requests/:id/reject', rejectLeaveRequest);

router.get('/schedule-requests', listScheduleRequests);
router.patch('/schedule-requests/:id/approve', approveScheduleRequest);
router.patch('/schedule-requests/:id/reject', rejectScheduleRequest);

/* Alias giữ lại đường cũ /api/admin/leave cho các màn hình đang dùng. */
router.get('/leave', listLeaveRequests);

/* ---- Thanh toán ---- */
router.patch('/payments/:id', patchPayment);

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

/* ---- Đường con phải khai báo TRƯỚC /bookings/:id ----
   Nếu để sau, chuỗi "payment" của /bookings/:id/payment sẽ bị :id nuốn
   mất và request đó rơi vào getBooking, trả về 404. */
router.post('/bookings/:id/payment', savePayment);

router.get('/bookings/:id', getBooking);
router.patch('/bookings/:id', patchBooking);
router.post('/bookings/:id/addons', addAddon);
router.delete('/bookings/:id/addons/:addonId', removeAddon);
router.post('/bookings/:id/images', addImage);
router.delete('/bookings/:id/images/:imageId', removeImage);

export default router;