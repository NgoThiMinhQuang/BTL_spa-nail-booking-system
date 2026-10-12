import { Router } from 'express';
import {
  addCustomerImage,
  addCustomerImageUpload,
  cancelBooking,
  changeBookingStaff,
  createBooking,
  createReview,
  getAvailableSlots,
  getBookingDetail,
  getBookingReceipt,
  getBookings,
  getStaffOptions,
  rescheduleBooking,
  updateBookingStatus,
} from '../controllers/booking.controller.js';
/* addAddon nằm ở controller quản trị nhưng đã chia nhánh actorRole STAFF /
   ADMIN ngay trong hàm — nhân viên thêm lúc PROCESSING, quản trị thêm khi
   chưa PAID. Dùng chung một hàm để hai vai trò không lệch luật. */
import { addAddon } from '../controllers/booking-admin.controller.js';
import { authenticate, requireCustomer, requireStaff } from '../lib/auth.js';
import { createDepositIntent } from '../controllers/deposit.controller.js';
const router = Router();

/* Xem khung giờ và đặt lịch là chuyện của khách — có thể xem không cần
   đăng nhập, nhưng đặt lịch thì bắt buộc đã đăng nhập, vì lệch đó
   chính là lúc dùng danh tính của khách để ghi vào lịch. */
router.get('/availability', getAvailableSlots);

/* Danh sách lịch của chính khách đang đăng nhập. Không nhận customerId
   từ query — trước đây nhận, nên chỉ cần đổi con số là xem được lịch
   của người khác. */
router.get('/', authenticate, requireCustomer, getBookings);

/* Chi tiết lịch của chính mình. Đặt sau /availability để không nuốt
   đường khung giờ. */
router.get('/:id', authenticate, requireCustomer, getBookingDetail);

/* Biên nhận thanh toán của chính mình (/:id chỉ khớp một đoạn nên
   không nuốt đường hai đoạn này). */
router.get('/:id/receipt', authenticate, requireCustomer, getBookingReceipt);

router.post('/', authenticate, requireCustomer, createBooking);

/* Khách tự hủy lịch của mình: PENDING hủy ngay, CONFIRMED hủy khi còn
   trên 2 giờ. */
router.patch('/:id/cancel', authenticate, requireCustomer, cancelBooking);

/* Khách tự đổi ngày/giờ lịch PENDING/CONFIRMED của mình: giữ nguyên nhân
   viên và tiền cọc, kiểm tra lại khả dụng như lúc đặt lịch. */
router.patch('/:id/reschedule', authenticate, requireCustomer, rescheduleBooking);

/* Khách tự đổi nhân viên khi lịch bị biến động (nghỉ đột xuất...):
   xem người còn trống + chốt người mới, giữ nguyên giờ và tiền cọc. */
router.get('/:id/staff-options', authenticate, requireCustomer, getStaffOptions);
router.patch('/:id/staff', authenticate, requireCustomer, changeBookingStaff);

/* Xin URL thanh toán đặt cọc 30% cho lịch PENDING của chính mình. */
router.post('/:id/deposit-intent', authenticate, requireCustomer, createDepositIntent);

/* Khách đánh giá lịch đã hoàn thành, mỗi lịch một lần. */
router.post('/:bookingId/review', authenticate, requireCustomer, createReview);

/* Ảnh mẫu khách gửi kèm lịch của chính mình (URL). */
router.post('/:id/images', authenticate, requireCustomer, addCustomerImage);

/* Upload file ảnh mẫu thật (multipart, tối đa 6 file, mỗi file 5MB). */
router.post('/:id/images/upload', authenticate, requireCustomer, addCustomerImageUpload);

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