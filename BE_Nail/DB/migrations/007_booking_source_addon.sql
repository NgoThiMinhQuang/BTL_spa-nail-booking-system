-- =====================================================
-- 007 · NGUỒN ĐẶT LỊCH, LÝ DO HỦY VÀ DỊCH VỤ PHÁT SINH
-- Phục vụ trang "Quản lý lịch hẹn": lọc theo nguồn, lưu lý do hủy, và
-- cho phép Admin thêm dịch vụ phát sinh (add-on) vào một lịch hẹn.
-- Chạy lại nhiều lần vẫn an toàn.
-- =====================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------
-- 1. Nguồn đặt lịch và thông tin hủy lịch
--    Lịch cũ mặc định là MOBILE vì trước đó toàn bộ lịch đến từ ứng dụng
--    khách hàng; lịch do Admin tạo tại quầy sẽ ghi WALK_IN.
-- ---------------------------------------------------------------
SET @has_source = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'source'
);
SET @sql = IF(@has_source = 0,
  'ALTER TABLE booking
     ADD COLUMN source ENUM(''MOBILE'',''WALK_IN'') NOT NULL DEFAULT ''MOBILE'' AFTER note,
     ADD COLUMN cancel_reason VARCHAR(255) NULL AFTER source,
     ADD COLUMN cancelled_at DATETIME NULL AFTER cancel_reason',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- 2. Dịch vụ phát sinh (add-on)
--    Một lịch hẹn có thể gắn thêm nhiều dịch vụ nữa. UNIQUE (booking_id,
--    service_id) để không thêm trùng cùng một dịch vụ vào cùng một lịch.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_addon (
  addon_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NOT NULL,
  service_id BIGINT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_addon (booking_id, service_id),
  KEY idx_addon_service (service_id),
  CONSTRAINT fk_addon_booking FOREIGN KEY (booking_id)
    REFERENCES booking(booking_id) ON DELETE CASCADE,
  CONSTRAINT fk_addon_service FOREIGN KEY (service_id)
    REFERENCES services(service_id)
);

-- ---------------------------------------------------------------
-- 3. Đánh dấu những lịch do Admin tạo tại quầy
--    Lịch tạo sau thời điểm chạy migration này mặc định đã là WALK_IN ở
--    tầng ứng dụng; các lịch có sẵn giữ MOBILE.
-- ---------------------------------------------------------------
UPDATE booking SET source = 'MOBILE' WHERE source IS NULL OR source = '';
