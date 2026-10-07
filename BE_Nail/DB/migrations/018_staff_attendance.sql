-- 018_staff_attendance.sql
-- Chấm công thực tế: nhân viên check-in/out mỗi ngày có ca.
-- Một ngày một dòng (UNIQUE staff_id + work_date). Giờ giấc lưu DATETIME
-- để sau này Payroll tính đi muộn / về sớm / thiếu công.
-- Idempotent: chạy lại nhiều lần vẫn an toàn.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS staff_attendance (
  attendance_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  work_date DATE NOT NULL,
  check_in_at DATETIME NULL,
  check_out_at DATETIME NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_attendance_day (staff_id, work_date),
  KEY idx_attendance_date (work_date),
  CONSTRAINT fk_attendance_staff FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id) ON DELETE CASCADE
) ENGINE=InnoDB;
