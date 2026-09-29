-- 004_customer_profile.sql
-- Bổ sung hồ sơ khách hàng: địa chỉ, ngày sinh và ghi chú nội bộ của nhân viên.
-- Idempotent: chạy lại nhiều lần vẫn an toàn (dùng information_schema + PREPARE).

SET NAMES utf8mb4;

-- address
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE customer ADD COLUMN address VARCHAR(255) NULL AFTER no_show_count',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'address');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- birthday
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE customer ADD COLUMN birthday DATE NULL AFTER address',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'birthday');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- note
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE customer ADD COLUMN note TEXT NULL AFTER birthday',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'note');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
