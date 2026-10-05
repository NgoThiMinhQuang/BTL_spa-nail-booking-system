SET NAMES utf8mb4;

-- ============================================================================
--  Đồng bộ schema cho các DB dựng từ bản Database.sql cũ
-- ============================================================================
--
--  1. customer.note: code cho ghi chú tới 2000 ký tự
--     (customer.controller.js MAX_NOTE_LENGTH) nhưng Database.sql cũ dựng
--     cột VARCHAR(255) trong khi migration 004 thêm TEXT. Ghi chú dài
--     trên DB dựng mới sẽ văng ER_DATA_TOO_LONG thành 500.
--
--  2. nail_designs.status: migration 001 dùng ENUM ACTIVE/HIDDEN, schema
--     chuẩn dùng ACTIVE/INACTIVE. DB dựng incremental giữ HIDDEN — mọi
--     lệnh ghi INACTIVE tương lai vào bảng này sẽ lỗi ENUM.
--
--  Mọi câu đều idempotent, chạy lại nhiều lần an toàn. Thứ tự bắt buộc:
--  đổi dữ liệu HIDDEN trước, rồi mới thu hẹp ENUM (strict mode từ chối
--  ALTER khi còn giá trị ngoài danh sách mới).
-- ============================================================================

SELECT COLUMN_TYPE INTO @note_type
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'note';

SET @stmt = IF(@note_type IS NOT NULL AND @note_type != 'text',
  'ALTER TABLE customer MODIFY COLUMN note TEXT NULL',
  'DO 0');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COLUMN_TYPE INTO @design_status
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nail_designs' AND COLUMN_NAME = 'status';

SET @stmt = IF(@design_status IS NOT NULL AND LOCATE('HIDDEN', @design_status) > 0,
  'UPDATE nail_designs SET status = ''INACTIVE'' WHERE status = ''HIDDEN''',
  'DO 0');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = IF(@design_status IS NOT NULL AND LOCATE('HIDDEN', @design_status) > 0,
  'ALTER TABLE nail_designs MODIFY COLUMN status ENUM(''ACTIVE'',''INACTIVE'') NOT NULL DEFAULT ''ACTIVE''',
  'DO 0');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
