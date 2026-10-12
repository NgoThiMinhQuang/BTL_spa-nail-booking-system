-- 023_refund_tracking.sql
-- Theo doi hoan tien that (P0.4) + chong dat trung (P1).
--
-- 1. payment.gateway_txn_no / gateway_txn_ref: ma giao dich cua cong VNPay
--    cho khoan coc online. Khong co hai ma nay thi khong goi duoc API hoan
--    VNPay (API doi ca ma goc cua merchant lan ma cua VNPay).
-- 2. payment_transaction.status: PENDING (da xac dinh khoan phai hoan) ->
--    PROCESSING (da goi cong) -> SUCCEEDED (cong xac nhan) / FAILED.
--    DEPOSIT/FINAL ghi khi tien da vao ket nen mac dinh SUCCEEDED.
--    REFUND do settle tao ra o PENDING, processor/confirm moi doi.
-- 3. payment_transaction.is_mock: 1 = tien gia lap (che do MOCK, chua co key
--    VNPay that) — giao dien phai hien ro "Mo phong", khong duoc hien nhu
--    tien that da chuyen.
-- 4. payment_transaction.gateway_message: ket qua/loi tra ve tu cong.
-- 5. booking.client_key: ma chong gui trung do client sinh (UUID). UNIQUE
--    cho phep nhieu NULL (lich cu khong co key van hop le).
-- Idempotent: chay lai nhieu lan van an toan.

SET NAMES utf8mb4;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE payment ADD COLUMN gateway_txn_no VARCHAR(60) NULL AFTER payment_date',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment' AND COLUMN_NAME = 'gateway_txn_no');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE payment ADD COLUMN gateway_txn_ref VARCHAR(100) NULL AFTER gateway_txn_no',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment' AND COLUMN_NAME = 'gateway_txn_ref');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE payment_transaction ADD COLUMN status ENUM(''PENDING'',''PROCESSING'',''SUCCEEDED'',''FAILED'') NOT NULL DEFAULT ''SUCCEEDED''',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction' AND COLUMN_NAME = 'status');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE payment_transaction ADD COLUMN is_mock TINYINT(1) NOT NULL DEFAULT 0',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction' AND COLUMN_NAME = 'is_mock');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE payment_transaction ADD COLUMN gateway_message VARCHAR(255) NULL',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction' AND COLUMN_NAME = 'gateway_message');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE booking ADD COLUMN client_key VARCHAR(64) NULL',
  'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND COLUMN_NAME = 'client_key');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE booking ADD UNIQUE KEY uq_booking_client_key (client_key)',
  'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' AND INDEX_NAME = 'uq_booking_client_key');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
