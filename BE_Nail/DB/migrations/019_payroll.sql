-- 019_payroll.sql
-- Lương nhân viên: lương cơ bản + hoa hồng dịch vụ (chỉ COMPLETED + PAID).
-- Phiếu lương khóa khi PAID: sửa giá dịch vụ sau này không làm đổi lịch sử.
-- Idempotent: chạy lại nhiều lần vẫn an toàn.

SET NAMES utf8mb4;

-- Lương cơ bản (VND/tháng) và % hoa hồng trên doanh thu dịch vụ thực thu.
SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE staff ADD COLUMN base_salary DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER specialty',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'base_salary');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE staff ADD COLUMN commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER base_salary',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'commission_rate');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Phiếu lương theo tháng. total_salary backend tự tính:
-- base_salary + commission_amount + bonus - deduction (không cho sửa trực tiếp).
CREATE TABLE IF NOT EXISTS payroll (
  payroll_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  period_month CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Chụp lương cơ bản lúc tính',
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT 'Chụp % hoa hồng lúc tính',
  service_revenue DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Doanh thu COMPLETED+PAID trong tháng',
  completed_count INT NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus DECIMAL(12,2) NOT NULL DEFAULT 0,
  deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('DRAFT','CONFIRMED','PAID') NOT NULL DEFAULT 'DRAFT',
  paid_at DATETIME NULL,
  payment_method VARCHAR(50) NULL,
  note VARCHAR(500) NULL,
  created_by BIGINT NULL COMMENT 'users.user_id của Admin tạo',
  paid_by BIGINT NULL COMMENT 'users.user_id của Admin trả',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payroll_staff_month (staff_id, period_month),
  KEY idx_payroll_month (period_month, status),
  CONSTRAINT fk_payroll_staff FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_creator FOREIGN KEY (created_by)
    REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_payroll_payer FOREIGN KEY (paid_by)
    REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Chi tiết từng lịch tạo nên hoa hồng (để đối chiếu, không sửa khi PAID).
CREATE TABLE IF NOT EXISTS payroll_item (
  payroll_item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payroll_id BIGINT NOT NULL,
  booking_id BIGINT NULL,
  service_name VARCHAR(150) NULL,
  starts_at DATETIME NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

  KEY idx_payroll_item_payroll (payroll_id),
  CONSTRAINT fk_payroll_item_payroll FOREIGN KEY (payroll_id)
    REFERENCES payroll(payroll_id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_item_booking FOREIGN KEY (booking_id)
    REFERENCES booking(booking_id) ON DELETE SET NULL
) ENGINE=InnoDB;
