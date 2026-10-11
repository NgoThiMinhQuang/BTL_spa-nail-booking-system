-- 021_notifications.sql
-- Thong bao cho khach: lich nghi dot xuat, doi lich, hoan tien...
-- notification = hop thu trong app (doc ngay, khong phu thuoc mang day).
-- device_token = dia chi push (Expo) cua tung may, de day thong bao ra
-- man hinh khoa ngay ca khi khach khong mo app.
-- Idempotent: chay lai nhieu lan van an toan.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS notification (
  notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NULL COMMENT 'NULL = khach vang lai, chi gui SMS',
  title VARCHAR(150) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  type ENUM('LEAVE_DISRUPTION','RESCHEDULE','REFUND','BOOKING','PAYMENT','GENERAL') NOT NULL DEFAULT 'GENERAL',
  ref_type VARCHAR(30) NULL COMMENT 'booking | leave_request | payroll ...',
  ref_id BIGINT NULL,
  channel ENUM('INAPP','PUSH','SMS') NOT NULL DEFAULT 'INAPP',
  status ENUM('PENDING','SENT','FAILED','READ') NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  error_message VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_notif_user (user_id, status),
  KEY idx_notif_ref (ref_type, ref_id),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS device_token (
  device_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  platform ENUM('android','ios','web') NOT NULL DEFAULT 'android',
  push_token VARCHAR(255) NOT NULL COMMENT 'ExponentPushToken[...] (Expo) hoac FCM token',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_device_token (push_token),
  KEY idx_device_user (user_id),
  CONSTRAINT fk_device_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
