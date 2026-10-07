-- 017_emergency_leave.sql
-- Nghỉ đột xuất giữa ca: nhân viên báo nghỉ ngay (startsAt <= now),
-- hệ thống khóa khả năng nhận Booking mới lập tức.
-- Idempotent: chạy lại nhiều lần vẫn an toàn (dùng information_schema + PREPARE).

SET NAMES utf8mb4;

-- Loại nghỉ: NORMAL (xin trước, duyệt mới hiệu lực) và EMERGENCY
-- (báo nghỉ ngay, tự động APPROVED để staff-availability chặn booking mới).
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE staff_leave_request ADD COLUMN leave_type ENUM(''NORMAL'',''EMERGENCY'') NOT NULL DEFAULT ''NORMAL'' AFTER reason',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_leave_request' AND COLUMN_NAME = 'leave_type');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Index phục vụ câu hỏi "nhân viên này có đang nghỉ đột xuất không".
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'CREATE INDEX idx_leave_emergency ON staff_leave_request (staff_id, status, leave_type)',
  'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_leave_request' AND INDEX_NAME = 'idx_leave_emergency');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
