-- 022_leave_reason_category.sql
-- Nhóm lý do nghỉ đột xuất: sức khỏe / gia đình / cá nhân / khác.
-- Biểu mẫu đột xuất mới chỉ cho chọn nhóm (ghi chú tùy chọn) nên cần cột
-- riêng, tách khỏi ô reason tự do. Nghỉ thường cũ để NULL.
-- Idempotent: chạy lại nhiều lần vẫn an toàn.

SET NAMES utf8mb4;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE staff_leave_request ADD COLUMN reason_category VARCHAR(20) NULL AFTER leave_type',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_leave_request' AND COLUMN_NAME = 'reason_category');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
