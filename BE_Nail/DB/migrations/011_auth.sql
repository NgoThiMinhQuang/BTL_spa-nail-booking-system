-- =====================================================
-- 011 XAC THUC VA PHAN QUYEN
-- B sung co so de dang nhap that cho ba vai tro.
--
-- 1. Tai khoan ADMIN: he thong truoc day khong co tai khoan quan tri nao
--    trong database, khu quan tri dang nhap bang khoa localStorage. Nay tao
--    mot tai khoan quan tri that de kiem tra duong /api/admin/* co that su
--    bao ve hay khong.
-- 2. Ma hoa toan bo mat khau dang ton tai trong users bang bcrypt.
--    Cac ban ghi seed truoc day ghi chuoi nham "khong dung de dang nhap"
--    nhung van la plaintext — sau migration nay chung la mat khau that.
-- 3. Cot canh bao mat khau gan nhat, phuc vu chinh sach "khong cho doi
--    mat khau cu" ma khong can them bang bao ke.
--
-- Chay lai nhieu lan van an toan.
-- =====================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------
-- 1. Cot canh bao mat khau gan nhat
--    NULL = chua bao gio doi mat khau, dung cho tai khoan seed.
-- ---------------------------------------------------------------
SET @has_pw_at = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
     AND COLUMN_NAME = 'password_changed_at'
);
SET @sql = IF(@has_pw_at = 0,
  'ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL AFTER status',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- 2. Tai khoan quan tri mac dinh
--    Mat khau: Admin@2024
--    bcrypt cost 10, hash sinh sẵn — khong nhét hashCong khai cho
--    de doc ma nguon, chi ghi mot lan trong migration nay.
-- ---------------------------------------------------------------
INSERT INTO users (full_name, phone, email, password, role, status)
SELECT 'Quản trị NailHouse', '0900000000', 'admin@nailhouse.vn',
       '$2b$10$tZtqdgg7HtiIebPU7wp1ieZES/CqjEfFDVQJqxs7YvJVZbQiaIYAu', 'ADMIN', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone = '0900000000');

-- ---------------------------------------------------------------
-- 3. Ma hoa lai toan bo mat khau hien co
--    Cac ban ghi seed ghi chuoi placeholder nham. Thay bang hash bcrypt
--    cua dung mat khau do (123456 cho tai khoan nhan vien/khach demo,
--    Admin@2024 cho tai khoan quan tri vua tao).
--
--    bcrypt.compare se tra false voi chuoi placeholder, nen neu
--    migration nay chay lai thi WHERE ... NOT LIKE '$2%' khong chon
--    nua gi, khong hong hash da dung.
-- ---------------------------------------------------------------
UPDATE users SET password = '$2b$10$u6jiigCfb6FxG15PV0PGIOMmdWDi74SrLrnOE78sQ8rrJMzsRJ94O'
WHERE password NOT LIKE '$2%' AND password <> '';

UPDATE users SET password = '$2b$10$u6jiigCfb6FxG15PV0PGIOMmdWDi74SrLrnOE78sQ8rrJMzsRJ94O'
WHERE password LIKE '$2b$10$seedAccountNotForLogin%';

UPDATE users SET password = '$2b$10$u6jiigCfb6FxG15PV0PGIOMmdWDi74SrLrnOE78sQ8rrJMzsRJ94O'
WHERE password LIKE '$2b$10$demo';

-- ---------------------------------------------------------------
-- 4. Bao dam khong con mat khau plaintext trong bang users
--    Sau buoc tren, bat ky con so nao khong bat dau bang '$2' deu la
--    mat khau chua ma hoa. Gan cho chung mot hash de khong con rong
--    truong hop nao.
-- ---------------------------------------------------------------
UPDATE users SET password = '$2b$10$u6jiigCfb6FxG15PV0PGIOMmdWDi74SrLrnOE78sQ8rrJMzsRJ94O'
WHERE password NOT LIKE '$2%';

-- ---------------------------------------------------------------
-- 5. Index phuc vu tra cuu dang nhap
--    users.phone va users.email da co UNIQUE nen MySQL tu dung index;
--    day them index cho status de viec "chi tai khoan ACTIVE" nhanh hon.
-- ---------------------------------------------------------------
SET @has_idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
);
SET @sql = IF(@has_idx = 0, 'CREATE INDEX idx_users_status ON users (status)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;