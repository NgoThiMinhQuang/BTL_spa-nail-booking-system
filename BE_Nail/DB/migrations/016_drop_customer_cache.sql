SET NAMES utf8mb4;

-- ============================================================================
--  Bỏ cột cache customer.total_spending / customer.no_show_count
-- ============================================================================
--
--  Mọi báo cáo tính trực tiếp từ payment (PAID) và booking (NO_SHOW), API
--  vẫn trả hai trường cùng tên nhưng là số tính tươi. Giữ cột trong DB
--  chỉ gây câu hỏi thừa khi bảo vệ ("sao có hai nguồn số liệu").
--
--  Idempotent: kiểm tra information_schema trước khi DROP.
-- ============================================================================

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer'
      AND COLUMN_NAME = 'total_spending') > 0,
  'ALTER TABLE customer DROP COLUMN total_spending',
  'DO 0');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer'
      AND COLUMN_NAME = 'no_show_count') > 0,
  'ALTER TABLE customer DROP COLUMN no_show_count',
  'DO 0');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
