-- 020_payment_transaction.sql
-- Lich su thu/hoan tien theo tung giao dich.
-- Truoc day 1 booking = 1 dong payment nen coc thang 9 + tra not thang 10
-- bi ghi de thanh 1 dong PAID duy nhat: bao cao tien thu theo ky sai thang.
-- Tu nay: payment giu vai tro TRANG THAI tong hop (UNPAID/DEPOSITED/PAID/
-- REFUNDED), payment_transaction giu tung KHOAN TIEN (coc, tra not, hoan).
-- Tien thu theo ky = SUM(transaction) theo paid_at.
-- Idempotent: chay lai nhieu lan van an toan.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS payment_transaction (
  transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NOT NULL,
  type ENUM('DEPOSIT','FINAL','REFUND') NOT NULL
    COMMENT 'DEPOSIT = coc, FINAL = tra not/tra du, REFUND = hoan coc khi cua hang huy',
  amount DECIMAL(12,2) NOT NULL COMMENT 'Duong = thu, am = hoan',
  payment_method ENUM('CASH','BANK_TRANSFER','ONLINE') NULL,
  paid_at DATETIME NOT NULL COMMENT 'Thoi diem tien thuc te vao/ra ket',
  created_by BIGINT NULL COMMENT 'users.user_id nguoi ghi nhan, NULL = cong thanh toan',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_txn_booking (booking_id),
  KEY idx_txn_paid_at (paid_at),
  CONSTRAINT fk_txn_booking FOREIGN KEY (booking_id)
    REFERENCES booking(booking_id) ON DELETE CASCADE,
  CONSTRAINT fk_txn_creator FOREIGN KEY (created_by)
    REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Trang thai hoan coc: cua hang huy lich da coc thi tra coc, phan biet
-- voi coc giu lai (khach tu huy / khong den).
SET @stmt = (SELECT IF(COUNT(*) > 0,
  'ALTER TABLE payment MODIFY COLUMN payment_status ENUM(''UNPAID'',''DEPOSITED'',''PAID'',''REFUNDED'') NOT NULL DEFAULT ''UNPAID''',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment' AND COLUMN_NAME = 'payment_status'
    AND COLUMN_TYPE NOT LIKE '%REFUNDED%');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
