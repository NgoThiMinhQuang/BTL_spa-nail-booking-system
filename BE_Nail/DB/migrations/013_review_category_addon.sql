-- =====================================================
-- 013 DANH GIA, ANH DANH GIA, TRANG THAI DANH MUC VA LUOT CHUP
--
-- Bo sung nhung thu README mo ta nhung database chua co:
--
--   1. review_images — mot danh gia co the nhieu anh. Bang review chi
--      co mot cot image, khong du theo hinh duoc bai viet danh gia.
--   2. service_category.status — README noi khach chi thay danh muc
--      ACTIVE va Admin co the Activate/Deactivate, nhung bang
--      service_category chua co cot status.
--   3. services.status — doi HIDDEN thanh INACTIVE cho khop README va
--      dung chung mot bo ten voi customer/staff. HIDDEN la tu rieng
--      cua tang staff nen khi bao cao se gay nham lan.
--   4. booking_addon — chup lai ten don gia va thanh tien tai luc them
--      vao lich, de sau nay doi gia/doi ten dich vu thi hoa don cu
--      khong doi theo.
--   5. cancelled_by — biet ai huy lich.
--   6. payment.status — noi ro cac buoc chuyen hop le. README khong
--      co nghiep vu hoan tien nen PAID khong quay lai UNPAID duoc.
--
-- Chay lai nhieu lan van an toan.
-- =====================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------
-- 1. ANH DANH GIA
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_images (
  review_image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  review_id BIGINT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_review_image (review_id),
  CONSTRAINT fk_review_image FOREIGN KEY (review_id)
    REFERENCES review(review_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------
-- 2. TRANG THAI DANH MUC
--    Khach chi thay danh muc ACTIVE; danh muc INACTIVE van giu nguyen
--    dich vu cu da tao, chi khong hien thi nua.
-- ---------------------------------------------------------------
SET @has_cat_status = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_category'
     AND COLUMN_NAME = 'status'
);
SET @sql = IF(@has_cat_status = 0,
  "ALTER TABLE service_category
     ADD COLUMN status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE' AFTER description",
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Không cho bỏ danh mục còn dịch vụ — dịch vụ sẽ mất chỗ thuộc về nó.
SET @has_cat_full = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_category'
     AND COLUMN_NAME = 'service_count'
);
SET @sql = IF(@has_cat_full = 0,
  'ALTER TABLE service_category
     ADD COLUMN service_count INT NOT NULL DEFAULT 0 AFTER status',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Đếm số dịch vụ cho từng danh mục.
UPDATE service_category c
   SET c.service_count = (
     SELECT COUNT(*) FROM services s WHERE s.category_id = c.category_id);

-- ---------------------------------------------------------------
-- 3. ĐỔI TÊN TRẠNG THÁI DỊCH VỤ: HIDDEN → INACTIVE
--    Một bộ tên thống nhất cho cả khách, nhân viên và quản trị.
-- ---------------------------------------------------------------
UPDATE services SET status = 'INACTIVE' WHERE status = 'HIDDEN';
ALTER TABLE services
  MODIFY COLUMN status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE';

-- ---------------------------------------------------------------
-- 4. CHỤP TÊN VÀ GIÁ DỊCH VỤ PHÁT SINH
--    booking_addon chi lưu price và service_id. Sau này đổi giá hoặc
--    đổi tên dịch vụ thì hóa đơn của các lịch cũ sẽ tự đổi theo —
--    sai, vì khách đã trả theo giá cũ.
-- ---------------------------------------------------------------
SET @has_addon_name = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_addon'
     AND COLUMN_NAME = 'service_name'
);
SET @sql = IF(@has_addon_name = 0,
  'ALTER TABLE booking_addon
     ADD COLUMN service_name VARCHAR(150) NULL AFTER service_id,
     ADD COLUMN added_by_role ENUM(''CUSTOMER'',''STAFF'',''ADMIN'',''SYSTEM'') NOT NULL DEFAULT ''ADMIN'' AFTER price',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ghi tên dịch vụ cho các dòng đã có.
UPDATE booking_addon ba
  JOIN services s ON s.service_id = ba.service_id
   SET ba.service_name = s.service_name
 WHERE ba.service_name IS NULL;

-- ---------------------------------------------------------------
-- 5. AI HỦY LỊCH
-- ---------------------------------------------------------------
SET @has_cancel_by = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking'
     AND COLUMN_NAME = 'cancelled_by'
);
SET @sql = IF(@has_cancel_by = 0,
  'ALTER TABLE booking
     ADD COLUMN cancelled_by ENUM(''CUSTOMER'',''STAFF'',''ADMIN'') NULL AFTER cancelled_at',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------
-- 6. SỐ PHÚT THỰC TẾ
--    booking.service_duration là thời lượng lúc ĐẶT. Thời lượng thực
--    tế có thể khác (khách đến muộn, làm lâu hơn dự kiến). Giữ riêng để
--    báo cáo "thời gian phục vụ trung bình" phản ánh việc thực tế chứ
--    không phải con số khách đặt.
-- ---------------------------------------------------------------
SET @has_actual = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking'
     AND COLUMN_NAME = 'actual_duration'
);
SET @sql = IF(@has_actual = 0,
  'ALTER TABLE booking
     ADD COLUMN actual_duration INT NULL AFTER buffer_time',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE booking
   SET actual_duration = service_duration
 WHERE status = 'COMPLETED' AND actual_duration IS NULL AND service_duration IS NOT NULL;

-- ---------------------------------------------------------------
-- 7. BƯỚC CHUYỂN TRẠNG THÁI THANH TOÁN
--    UNPAID → DEPOSITED → PAID, và UNPAID → PAID (trả một lần).
--    PAID không quay lại được: README không có nghiệp vụ hoàn tiền nên
--    không mở đường đi ngược.
--
--    MySQL không có CHECK trên ENUM dùng được ở mọi phiên bản nên luật
--    này đặt ở tầng ứng dụng (lib/payment-state.js) — một chỗ duy nhất cho
--    mọi API chạm vào thanh toán.
--
--    payment.booking_id đã có UNIQUE: mỗi lịch chỉ có một dòng thanh toán,
--    nên "ghi đè" chính là cập nhật dòng đó chứ không phải thêm mới.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 8. BẢNG ĐIỂM NHÂN VIÊN KHÔNG LƯU SẴN
--    staff.rating từng là cột cache nhưng không được cập nhật khi có
--    đánh giá mới, nên nó và AVG(review.rating) có thể cho hai con số
--    khác nhau cho cùng một người. Bỏ hẳn cột đó: điểm nhân viên tính
--    trực tiếp bằng AVG(review.rating), không có nơi nào lưu trùng.
--    Các câu truy vấn đã chuyển sang đọc thẳng bảng review.
-- ---------------------------------------------------------------
SET @has_staff_rating = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff'
     AND COLUMN_NAME = 'rating'
);
SET @sql = IF(@has_staff_rating > 0,
  'ALTER TABLE staff DROP COLUMN rating',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
