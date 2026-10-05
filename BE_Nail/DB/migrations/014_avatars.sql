SET NAMES utf8mb4;

-- ============================================================================
--  Ảnh đại diện nhân viên và khách hàng
-- ============================================================================
--
--  LÝ DO ĐỔI ẢNH
--  Trước đây avatar lấy từ hai nguồn không ổn định:
--
--  1. Hai nhân viên đầu danh sách (Thợ chính Lan, Mai Anh) trỏ tới
--     /uploads/artists/lan-v2.png và mai-anh-v2.png. Hai ảnh đó do máy sinh,
--     nhìn rõ lỗi: nhãn thiết bị ghi sai chính tả, các hộp sơn trên kệ méo
--     và lặp bất thường, chi tiết trang sức nhoè. Người xem nhận ra ngay là ảnh
--     AI nên app mất tin cậy ngay ở màn hình danh bạ nhân viên.
--
--  2. Nhân viên còn lại và toàn bộ khách hàng trỏ tới ảnh Unsplash. Ngoài ra
--     năm ảnh bị dùng lại cho mười người: NV "Nguyễn Thị Lan" và KH
--     "Trần Thị Mai" có cùng một khuôn mặt. Tệ hơn, khuôn mặt không phải
--     người Việt nên không hợp tiệm nail trong nước.
--
--  Nay tất cả ảnh nằm trong public/uploads/avatars/, đặt tên theo số điện
--  thoại để tra ngược được. Đây là ảnh chụp thật, mỗi người một ảnh riêng,
--  giới tính và tông da khớp với tên.
--
--  Ghi đè cột users.avatar theo số điện thoại nên chạy lại nhiều lần cũng
--  cho cùng kết quả.
-- ============================================================================

-- Nhân viên: ảnh dọc 360x480, hiển thị ở thẻ "Nghệ nhân nổi bật" và trang hồ sơ.
UPDATE users SET avatar = '/uploads/avatars/staff-0900000001.jpg' WHERE phone = '0900000001';
UPDATE users SET avatar = '/uploads/avatars/staff-0900000002.jpg' WHERE phone = '0900000002';
UPDATE users SET avatar = '/uploads/avatars/staff-0901000001.jpg' WHERE phone = '0901000001';
UPDATE users SET avatar = '/uploads/avatars/staff-0901000002.jpg' WHERE phone = '0901000002';
UPDATE users SET avatar = '/uploads/avatars/staff-0901000003.jpg' WHERE phone = '0901000003';
UPDATE users SET avatar = '/uploads/avatars/staff-0901000004.jpg' WHERE phone = '0901000004';
UPDATE users SET avatar = '/uploads/avatars/staff-0901000005.jpg' WHERE phone = '0901000005';

-- Khách hàng: ảnh vuông 320x320.
UPDATE users SET avatar = '/uploads/avatars/cust-0910000001.jpg' WHERE phone = '0910000001';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000002.jpg' WHERE phone = '0910000002';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000003.jpg' WHERE phone = '0910000003';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000004.jpg' WHERE phone = '0910000004';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000005.jpg' WHERE phone = '0910000005';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000006.jpg' WHERE phone = '0910000006';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000007.jpg' WHERE phone = '0910000007';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000008.jpg' WHERE phone = '0910000008';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000009.jpg' WHERE phone = '0910000009';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000010.jpg' WHERE phone = '0910000010';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000011.jpg' WHERE phone = '0910000011';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000012.jpg' WHERE phone = '0910000012';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000013.jpg' WHERE phone = '0910000013';
UPDATE users SET avatar = '/uploads/avatars/cust-0910000014.jpg' WHERE phone = '0910000014';
