import { Router } from 'express';
import {
  addCustomerImage,
  cancelBooking,
  createBooking,
  createReview,
  getAvailableSlots,
  getBookings,
  updateBookingStatus,
} from '../controllers/booking.controller.js';
/* addAddon nằm ở controller quản trị nhưng đã chia nhánh actorRole STAFF /
   ADMIN ngay trong hàm — nhân viên thêm lúc PROCESSING, quản trị thêm khi
   chưa PAID. Dùng chung một hàm để hai vai trò không lệch luật. */
import { addAddon } from '../controllers/booking-admin.controller.js';
import { authenticate, requireCustomer, requireStaff } from '../lib/auth.js';

const router = Router();

/* Xem khung giờ và đặt lịch là chuyện của khách — có thể xem không cần
   đăng nhập, nhưng đặt lịch thì bắt buộc đã đăng nhập, vì lệch đó
   chính là lúc dùng danh tính của khách để ghi vào lịch. */
router.get('/availability', getAvailableSlots);

/* Danh sách lịch của chính khách đang đăng nhập. Không nhận customerId
   từ query — trước đây nhận, nên chỉ cần đổi con số là xem được lịch
   của người khác. */
router.get('/', authenticate, requireCustomer, getBookings);

router.post('/', authenticate, requireCustomer, createBooking);

/* Khách tự hủy lịch của mình: PENDING hủy ngay, CONFIRMED hủy khi còn
   trên 2 giờ. */
router.patch('/:id/cancel', authenticate, requireCustomer, cancelBooking);

/* Khách đánh giá lịch đã hoàn thành, mỗi lịch một lần. */
router.post('/:bookingId/review', authenticate, requireCustomer, createReview);

/* Ảnh mẫu khách gửi kèm lịch của chính mình. */
router.post('/:id/images', authenticate, requireCustomer, addCustomerImage);

/* Nhân viên bắt đầu / hoàn thành lịch được phân công cho mình. Nhân viên
   tự lấy danh tính từ token nên không có đường gọi chéo lịch của
   người khác. */
router.patch('/:id/status', authenticate, requireStaff, updateBookingStatus);

/* Nhân viên thêm dịch vụ phát sinh khi khách đang được phục vụ
   (PROCESSING) — đúng luồng Staff: Processing → thêm phát sinh →
   Completed. Luật STAFF nằm sẵn trong addAddon, trước đây đường này chỉ
   có ở /api/admin nên nhánh đó không bao giờ chạy được. */
router.post('/:id/addons', authenticate, requireStaff, addAddon);

export default router;