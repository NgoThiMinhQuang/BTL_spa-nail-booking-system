-- =====================================================
-- 009 · DỮ LIỆU CHO TRANG CHI TIẾT LỊCH HẸN
-- Trang chi tiết cần những thứ bảng booking chưa lưu:
--   1. Ảnh mỏng khách gửi kèm theo booking.
--   2. Lịch sử thay đổi để dựng dòng thời gian.
--   3. Giá / thời gian / buffer tại lúc đặt, để sau này Admin đổi giá dịch
--      vụ thì lịch cũ vẫn hiện đúng số khách đã trả.
-- Chạy lại nhiều lần vẫn an toàn.
-- =====================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------
-- 1. Snapshot giá tại lúc đặt
--    booking.service_price để trả lại đúng số khách đã trả; không đọc
--    giá hiện tại của services.
-- ---------------------------------------------------------------
SET @has_price = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking'
     AND COLUMN_NAME = 'service_price'
);
SET @sql = IF(@has_price = 0,
  'ALTER TABLE booking
     ADD COLUMN service_price DECIMAL(12,2) NULL AFTER service_id,
     ADD COLUMN service_duration INT NULL AFTER service_price,
     ADD COLUMN buffer_time INT NOT NULL DEFAULT 0 AFTER service_duration',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Lịch cũ chưa có snapshot thì lấy giá hiện tại làm giá trị khởi đầu.
UPDATE booking b
  JOIN services s ON s.service_id = b.service_id
   SET b.service_price = s.price,
       b.service_duration = s.duration,
       b.buffer_time = s.buffer_time
 WHERE b.service_price IS NULL;

-- ---------------------------------------------------------------
-- 2. Ảnh mẫu khách gửi
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_image (
  image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_image_booking (booking_id),
  CONSTRAINT fk_image_booking FOREIGN KEY (booking_id)
    REFERENCES booking(booking_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------
-- 3. Lịch sử hoạt động của một lịch hẹn
--    Mỗi dòng ghi rõ ai làm và làm gì, đúng như yêu cầu kiểm tra lịch sử.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_event (
  event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NOT NULL,
  event_type ENUM('CREATED','CONFIRMED','RESCHEDULED','STAFF_CHANGED',
                  'SERVICE_STARTED','SERVICE_COMPLETED','CANCELLED','NO_SHOW',
                  'PAYMENT','ADDON_ADDED','ADDON_REMOVED','NOTE')
    NOT NULL,
  detail VARCHAR(500) NULL,
  actor_role ENUM('CUSTOMER','STAFF','ADMIN','SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  actor_name VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_event_booking (booking_id, created_at),
  CONSTRAINT fk_event_booking FOREIGN KEY (booking_id)
    REFERENCES booking(booking_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------
-- 4. Lấp lịch sử cho các lịch đã có sẵn
--    Chỉ ghi những mốc thời gian thật trong database: lúc tạo booking,
--    lúc thanh toán, lúc thêm dịch vụ phát sinh, lúc hủy. Các mốc chuyển
--    trạng thái trong quá khứ không có dấu vết thời gian nên không bịa,
--    các lần thay đổi từ hôm nay sẽ được ghi đầy đủ.
-- ---------------------------------------------------------------
INSERT INTO booking_event (booking_id, event_type, detail, actor_role, actor_name, created_at)
SELECT b.booking_id, 'CREATED',
       CONCAT('Khách đặt lịch qua ',
              CASE b.source WHEN 'WALK_IN' THEN 'quầy' ELSE 'ứng dụng Mobile' END, '.'),
       'CUSTOMER', u.full_name, b.created_at
  FROM booking b
  JOIN customer c ON c.customer_id = b.customer_id
  JOIN users u ON u.user_id = c.user_id
 WHERE NOT EXISTS (SELECT 1 FROM booking_event e
                    WHERE e.booking_id = b.booking_id AND e.event_type = 'CREATED');

INSERT INTO booking_event (booking_id, event_type, detail, actor_role, actor_name, created_at)
SELECT b.booking_id, 'CANCELLED',
       CONCAT('Lịch đã hủy. Lý do: ', COALESCE(b.cancel_reason, 'không ghi nhận'), '.'),
       'ADMIN', 'Quản trị viên', b.cancelled_at
  FROM booking b
 WHERE b.status = 'CANCELLED' AND b.cancelled_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM booking_event e
                    WHERE e.booking_id = b.booking_id AND e.event_type = 'CANCELLED');

INSERT INTO booking_event (booking_id, event_type, detail, actor_role, actor_name, created_at)
SELECT pay.booking_id, 'PAYMENT',
       CONCAT('Thanh toán ', LOWER(PAYMENT_TEXT),
              '. Số tiền: ', FORMAT(pay.amount, 0), ' đ.'),
       'SYSTEM', 'Hệ thống', pay.payment_date
  FROM (
    SELECT p.booking_id, p.amount, p.payment_date,
           CASE p.payment_status
             WHEN 'PAID' THEN 'hoàn tất'
             WHEN 'DEPOSITED' THEN 'đặt cọc'
             ELSE 'chưa thanh toán' END AS PAYMENT_TEXT
      FROM payment p
     WHERE p.payment_status IN ('PAID','DEPOSITED') AND p.payment_date IS NOT NULL
  ) pay
 WHERE NOT EXISTS (SELECT 1 FROM booking_event e
                    WHERE e.booking_id = pay.booking_id AND e.event_type = 'PAYMENT');

INSERT INTO booking_event (booking_id, event_type, detail, actor_role, actor_name, created_at)
SELECT ba.booking_id, 'ADDON_ADDED',
       CONCAT('Thêm dịch vụ phát sinh: ', s.service_name, ' - ',
              FORMAT(ba.price, 0), ' đ.'),
       'ADMIN', 'Quản trị viên', ba.created_at
  FROM booking_addon ba
  JOIN services s ON s.service_id = ba.service_id
 WHERE NOT EXISTS (SELECT 1 FROM booking_event e
                    WHERE e.booking_id = ba.booking_id AND e.event_type = 'ADDON_ADDED');
