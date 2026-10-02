-- =====================================================
-- 012 YEU CAU NGHI VA YEU CAU LICH LAM VIEC
--
-- Hai khái niem trong README nhung database chua co bang nao:
--
--   1. StaffLeaveRequest — nhan vien xin nghi, Admin duyet hoac tu choi.
--      Truoc day he thong chi danh dau nghi bang staff_schedule.status = 'OFF'.
--      Cach do thieu han: khong biet ai xin nghi, Admin duyet luc nao, va
--      quan tri KHONG DUOC DUYET — nghỉ la dac biet khong can xin.
--
--   2. StaffScheduleRequest — nhan vien xin them/bot ca, Admin duyet.
--      Khong duyet thi khong duoc sua staff_schedule truc tiep.
--
-- Ca hai deu ghi nhat ky viec su, khong sua truc tiep vao lich lam viec.
--
-- Chay lai nhieu lan van an toan.
-- =====================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------
-- 1. YEU CAU NGHI
--    status: PENDING → APPROVED | REJECTED
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_leave_request (
  leave_request_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  -- Admin xu ly: reviewed_by tro ve users.user_id, khong phai staff_id,
  -- vi nguoi duyet la quan tri chu khong phai nhan vien khac.
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  KEY idx_leave_staff (staff_id, status),
  -- Availability phai tra loi "nguoi nay dang nghi tu luc nao den luc nao"
  -- nhieu lan moi mot lan dat lich, index nay phuc vu dung cau hoi do.
  KEY idx_leave_range (status, start_datetime, end_datetime),
  CONSTRAINT fk_leave_staff FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES users(user_id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------
-- 2. YEU CAU LICH LAM VIEC
--    status: PENDING → APPROVED | REJECTED
--    Chi khi APPROVED moi tao / cap nhat dong staff_schedule tuong ung.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_schedule_request (
  schedule_request_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  -- Loai yeu cau cho biet khi duyet se tao ca moi hay sua ca cu.
  action ENUM('ADD','UPDATE','REMOVE') NOT NULL DEFAULT 'ADD',
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  KEY idx_schedule_req_staff (staff_id, status),
  KEY idx_schedule_req_date (work_date, status),
  CONSTRAINT fk_schedule_req_staff FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_req_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES users(user_id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------
-- 3. Ca OFF da duoc tao tu dau = OFF nghi chua qua duyet
--    Lan dau chay migration, cac dong staff_schedule co status = 'OFF'
--    chua nao cung tu phia Admin gan tay. Ghi lai mot yeu cau da duyet
--    de admin xem lai duoc lich nao truoc day da bi chan.
--    Chi ghi cho nhung ngay CON LAI — ngay qua thi la lich su, khong can.
-- ---------------------------------------------------------------
INSERT INTO staff_leave_request
  (staff_id, start_datetime, end_datetime, reason, status, created_at)
SELECT sc.staff_id,
       TIMESTAMP(sc.work_date, sc.start_time),
       TIMESTAMP(sc.work_date, sc.end_time),
       'Chuyển từ ca OFF có sẵn trước khi có bảng yêu cầu nghỉ.',
       'APPROVED',
       sc.work_date
  FROM staff_schedule sc
 WHERE sc.status = 'OFF' AND sc.work_date >= CURDATE()
   AND NOT EXISTS (
     SELECT 1 FROM staff_leave_request lr
      WHERE lr.staff_id = sc.staff_id
        AND DATE(lr.start_datetime) = sc.work_date
   );

-- ---------------------------------------------------------------
-- 4. Khong cho ca OFF trong ngay qua
--    Ca OFF la mot duong nganh: chan booking vao ca do. Nhưng ngay da
--    qua roi thi khong con y nghia chan gi, chi la du lieu rac.
-- ---------------------------------------------------------------
DELETE FROM staff_schedule WHERE status = 'OFF' AND work_date < CURDATE();