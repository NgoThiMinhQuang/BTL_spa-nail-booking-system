-- =====================================================
-- 010 · KHÁCH WALK-IN KHÔNG CÓ TÀI KHOẢN
-- Trước đây mọi lịch đều bắt buộc có customer_id, nên khách đến quầy
-- không có tài khoản cũng phải được tạo tài khoản cho có. Nghiệp vụ
-- walk-in không như vậy: lưu customer_id = NULL cùng tên và số điện
-- thoại ngay trên lịch, không sinh tài khoản, không sinh mật khẩu.
--
-- Các truy vấn đọc lịch phải chuyển JOIN customer thành LEFT JOIN, nếu
-- không những lịch walk-in sẽ biến mất khỏi màn hình quản trị.
-- Chạy lại nhiều lần vẫn an toàn.
-- =====================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------
-- 1. Thông tin khách vãng lai ngay trên lịch hẹn
-- ---------------------------------------------------------------
SET @has_guest = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking'
     AND COLUMN_NAME = 'guest_name'
);
SET @sql = IF(@has_guest = 0,
  'ALTER TABLE booking
     ADD COLUMN guest_name VARCHAR(100) NULL AFTER customer_id,
     ADD COLUMN guest_phone VARCHAR(15) NULL AFTER guest_name',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- 2. Cho phép lịch không gắn tài khoản khách
--    Phải bỏ NOT NULL trước, sau đó khóa ngoại vẫn giữ nguyên: NULL thì
--    không vi phạm ràng buộc tham chiếu.
-- ---------------------------------------------------------------
ALTER TABLE booking MODIFY customer_id BIGINT NULL;

-- ---------------------------------------------------------------
-- 3. Chuẩn dữ liệu: một lịch walk-in phải có tên, một lịch có tài khoản
--    thì không được nhập thêm tên vãng lai. Ràng buộc này chặn ở tầng
--    database để không chỉ dựa vào kiểm tra ở giao diện.
-- ---------------------------------------------------------------
SET @has_chk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'booking'
     AND CONSTRAINT_NAME = 'chk_booking_guest'
);
SET @sql = IF(@has_chk = 0,
  'ALTER TABLE booking
     ADD CONSTRAINT chk_booking_guest CHECK (
       (customer_id IS NULL AND guest_name IS NOT NULL AND guest_phone IS NOT NULL)
       OR (customer_id IS NOT NULL AND guest_name IS NULL AND guest_phone IS NULL)
     )',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- 4. Lịch cũ không có tên khách ngay trên lịch: lấy từ hồ sơ khách để
--    không mất dữ liệu khi bắt buộc kiểm tra ở trên.
-- ---------------------------------------------------------------
UPDATE booking b
  JOIN customer c ON c.customer_id = b.customer_id
  JOIN users u ON u.user_id = c.user_id
   SET b.guest_name = u.full_name, b.guest_phone = u.phone
 WHERE b.customer_id IS NULL;

-- Nới ràng buộc tạm thời để bước 5 chạy được: tại thời điểm này lịch có
-- cả customer_id lẫn guest_name.
SET @sql = 'ALTER TABLE booking DROP CHECK chk_booking_guest';
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Với lịch đã có tài khoản thì xóa phần tên vãng lai đi, vì hồ sơ khách
-- đã là nguồn sự thật và truy vấn LEFT JOIN sẽ lấy từ đó.
UPDATE booking b
  JOIN customer c ON c.customer_id = b.customer_id
   SET b.guest_name = NULL, b.guest_phone = NULL
 WHERE b.customer_id IS NOT NULL;

SET @sql = 'ALTER TABLE booking ADD CONSTRAINT chk_booking_guest CHECK (
  (customer_id IS NULL AND guest_name IS NOT NULL AND guest_phone IS NOT NULL)
  OR (customer_id IS NOT NULL AND guest_name IS NULL AND guest_phone IS NULL))';
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- 5. Truy vấn theo số điện thoại khách vãng lai
-- ---------------------------------------------------------------
SET @has_idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking'
     AND COLUMN_NAME = 'guest_phone'
);
SET @sql = IF(@has_idx = 0,
  'CREATE INDEX idx_booking_guest_phone ON booking (guest_phone)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;