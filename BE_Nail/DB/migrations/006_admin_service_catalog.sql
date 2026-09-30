-- =====================================================
-- 006 · DANH MỤC DỊCH VỤ + DỮ LIỆU VẬN HÀNH CHO KHU QUẢN TRỊ
-- Bổ sung dịch vụ thật (mô tả, giá, thời lượng, ảnh), gán nhân viên theo
-- chuyên môn, và sinh lịch hẹn + thanh toán quanh ngày chạy để khu vực quản
-- trị có số liệu hiển thị được. Chạy lại nhiều lần vẫn an toàn: mọi INSERT
-- đều có điều kiện NOT EXISTS.
-- =====================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------
-- 1. Danh mục dịch vụ
-- ---------------------------------------------------------------
-- MySQL bắt buộc có FROM DUAL khi SELECT không lấy từ bảng nào mà vẫn có WHERE.
INSERT INTO service_category (category_name, description)
SELECT 'Sơn móng', 'Sơn và trang trí móng tay cơ bản' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM service_category WHERE category_name = 'Sơn móng');

INSERT INTO service_category (category_name, description)
SELECT 'Đắp móng', 'Đắp gel, bột và đắp sculpting giữ móng bền' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM service_category WHERE category_name = 'Đắp móng');

INSERT INTO service_category (category_name, description)
SELECT 'Chăm sóc móng chân', 'Dịch vụ chăm sóc và làm đẹp móng chân' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM service_category WHERE category_name = 'Chăm sóc móng chân');

INSERT INTO service_category (category_name, description)
SELECT 'Combo', 'Gói chăm sóc trọn bộ tiết kiệm hơn chạy lẻ từng bước' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM service_category WHERE category_name = 'Combo');

-- ---------------------------------------------------------------
-- 2. Dịch vụ
--    Mỗi dòng chỉ thêm khi chưa có dịch vụ trùng tên.
-- ---------------------------------------------------------------
INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Sơn Móng Cổ Điển', 'Sơn một lớp màu cơ bản, giữ mày vàng dài trên móng tự nhiên.', 100000, 45, 10, 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Sơn móng'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Sơn Móng Cổ Điển');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Sơn Móng Trong Suốt', 'Sơn trong suốt hoặc nude tôn dáng bàn tay.', 120000, 45, 10, 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Sơn móng'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Sơn Móng Trong Suốt');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Sơn Móng French Đầu Ngón', 'Sơn viền trắng cổ điển, tạo cảm giác móng dài và thon.', 180000, 60, 15, 'https://images.unsplash.com/photo-1599948128020-9a44abbe7b2a?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Sơn móng'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Sơn Móng French Đầu Ngón');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Sơn Gel Trong Suốt', 'Gel trong suốt chịu lực, không bong trong 3 tuần.', 220000, 60, 15, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Sơn Gel'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Sơn Gel Trong Suốt');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Sơn Gel Ombre Chuyển Màu', 'Phai màu chuyển dần từ nền nhạt sang đậm, lạ và sang trọng.', 280000, 75, 15, 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Sơn Gel'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Sơn Gel Ombre Chuyển Màu');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Nail Art Vẽ Tay', 'Vẽ trực tiếp hình lên móng bằng nét vẽ thủ công.', 320000, 80, 15, 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Nail Art'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Nail Art Vẽ Tay');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Nail Art Đính Đá', 'Đính đá Swarovski theo yêu cầu, chọn mẫu tự do.', 380000, 90, 15, 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Nail Art'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Nail Art Đính Đá');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Nail Art 3D Nổi', 'Đắn khối và phối hạt tạo chiều sâu nổi bật.', 450000, 120, 20, 'https://images.unsplash.com/photo-1595868832863-71a7d6051786?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Nail Art'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Nail Art 3D Nổi');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Đắp Bột Mông', 'Đắp bột PMMA cứng, giữ hình tốt nhất trong các dịch vụ đắp.', 380000, 120, 20, 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Đắp móng'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Đắp Bột Mông');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Đắp Gel Trọn Bộ', 'Đắp gel phủ đều, dễ dạy lại móng tự nhiên.', 320000, 100, 15, 'https://images.unsplash.com/photo-1604902396830-aca29e19b067?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Đắp móng'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Đắp Gel Trọn Bộ');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Đắp Móng Sculpting', 'Kéo dài móng bằng form, bền gấp 2 lần móng tự nhiên.', 520000, 150, 20, 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Đắp móng'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Đắp Móng Sculpting');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Chăm Sóc Móng Chân', 'Cắt tẩy, làm sạch và dưỡng móng chân khô.', 220000, 60, 15, 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Chăm sóc móng chân'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Chăm Sóc Móng Chân');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Ngâm Chân Paraffin', 'Ngâm paraffin nóng giúp mềm da, giảm tích bạch chân.', 180000, 45, 10, 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Chăm sóc móng chân'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Ngâm Chân Paraffin');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Sơn Móng Chân', 'Sơn móng chân theo dải màu, kiểu dâu tây hay nude.', 130000, 45, 10, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Chăm sóc móng chân'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Sơn Móng Chân');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time, image)
SELECT c.category_id, 'Combo Chăm Sóc Trọn Bộ', 'Sơn gel + cắt tẩy + chăm sóc móng chân trong một buổi.', 690000, 180, 20, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=200&h=200&fit=crop'
FROM service_category c
WHERE c.category_name = 'Combo'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_name = 'Combo Chăm Sóc Trọn Bộ');

-- ---------------------------------------------------------------
-- 3. Gán nhân viên theo chuyên môn
--    Chuyên Spa nhận nhóm "Chăm sóc móng chân", các nhóm còn lại nhận dịch vụ
--    móng tay và đắp móng. Nhân viên chuyên Gội đầu không nhận dịch vụ móng.
-- ---------------------------------------------------------------
INSERT IGNORE INTO staff_service (staff_id, service_id)
SELECT st.staff_id, s.service_id
FROM staff st
JOIN users u ON u.user_id = st.user_id
JOIN services s
JOIN service_category c ON c.category_id = s.category_id
WHERE c.category_name = 'Chăm sóc móng chân'
  AND (st.specialty LIKE '%Spa%' OR st.specialty LIKE '%Nail%');

INSERT IGNORE INTO staff_service (staff_id, service_id)
SELECT st.staff_id, s.service_id
FROM staff st
JOIN services s
JOIN service_category c ON c.category_id = s.category_id
WHERE c.category_name <> 'Chăm sóc móng chân'
  AND (st.specialty LIKE '%Nail%' OR st.specialty LIKE '%gel%');

-- ---------------------------------------------------------------
-- 4. Lịch hẹn quanh ngày chạy
--    Kế hoạch đặt trước rồi nối vào bảng booking, nên có thể đọc lại dễ kiểm tra.
-- ---------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_plan;

CREATE TEMPORARY TABLE tmp_plan (
  day_offset INT,
  slot TIME,
  service_name VARCHAR(150),
  staff_phone VARCHAR(15),
  customer_phone VARCHAR(15),
  status VARCHAR(20),
  note TEXT
);

INSERT INTO tmp_plan VALUES
  -- Hôm nay: 6 lịch, trạng thái trải ra để bảng điều khiển có số thật
  (0, '09:00', 'Sơn Gel Trong Suốt',      '0901000002', '0910000001', 'COMPLETED', 'Khách yêu thích màu nude'),
  (0, '10:30', 'Nail Art Đính Đá',        '0901000003', '0910000008', 'PROCESSING', NULL),
  (0, '11:15', 'Chăm Sóc Móng Chân',      '0901000004', '0910000004', 'CONFIRMED',  'Nhờ chăm sóc móng chân'),
  (0, '13:00', 'Sơn Móng French Đầu Ngón','0901000001', '0910000011', 'CONFIRMED',  NULL),
  (0, '14:30', 'Đắp Gel Trọn Bộ',         '0901000002', '0910000003', 'CONFIRMED',  NULL),
  (0, '16:00', 'Sơn Móng Cổ Điển',        '0901000005', '0910000005', 'PENDING',    'Khách hỏi giá trước khi làm'),
  -- Bảy ngày tới
  (1, '09:30', 'Nail Art Vẽ Tay',     '0901000001', '0910000002', 'CONFIRMED', NULL),
  (1, '11:00', 'Đắp Bột Mông',        '0901000002', '0910000006', 'PENDING',   NULL),
  (1, '15:00', 'Sơn Gel Ombre Chuyển Màu', '0901000003', '0910000007', 'CONFIRMED', 'Mẫu nhạt chuyển hồng'),
  (2, '10:00', 'Sơn Móng Trong Suốt', '0901000004', '0910000009', 'CONFIRMED', NULL),
  (2, '13:30', 'Combo Chăm Sóc Trọn Bộ', '0901000001', '0910000010', 'PENDING', 'Cả gia đình, hẹn giờ yên tĩnh'),
  (3, '09:00', 'Đắp Móng Sculpting',   '0901000002', '0910000012', 'CONFIRMED', 'Mong dài 2cm'),
  (3, '14:00', 'Ngâm Chân Paraffin',   '0901000005', '0910000013', 'CONFIRMED', NULL),
  (4, '10:30', 'Nail Art 3D Nổi',      '0901000003', '0910000014', 'PENDING',   NULL),
  (4, '15:30', 'Sơn Móng Chân',        '0901000004', '0910000015', 'CONFIRMED', NULL),
  (5, '09:00', 'Sơn Gel Cao Cấp',      '0901000001', '0910000001', 'CONFIRMED', NULL),
  (5, '11:30', 'Chăm Sóc Móng Chân',   '0901000005', '0910000002', 'CONFIRMED', NULL),
  (6, '14:00', 'Nail Art Nghệ Thuật',  '0901000003', '0910000003', 'PENDING',   NULL),
  (6, '16:30', 'Sơn Móng French Đầu Ngón', '0901000002', '0910000004', 'CONFIRMED', NULL);

INSERT INTO booking (customer_id, staff_id, service_id, start_time, end_time, status, note)
SELECT
  c.customer_id,
  st.staff_id,
  s.service_id,
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL p.day_offset DAY), p.slot),
  TIMESTAMP(
    DATE_ADD(CURDATE(), INTERVAL p.day_offset DAY),
    ADDTIME(p.slot, SEC_TO_TIME((s.duration + s.buffer_time) * 60))
  ),
  p.status,
  p.note
FROM tmp_plan p
JOIN users cu ON cu.phone = p.customer_phone
JOIN customer c ON c.user_id = cu.user_id
JOIN users su ON su.phone = p.staff_phone
JOIN staff st ON st.user_id = su.user_id
JOIN services s ON s.service_name = p.service_name
WHERE NOT EXISTS (
  SELECT 1 FROM booking b
  WHERE b.customer_id = c.customer_id
    AND b.service_id = s.service_id
    AND b.start_time = TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL p.day_offset DAY), p.slot)
);

-- ---------------------------------------------------------------
-- 5. Thanh toán cho các lịch đã hoàn thành
--    Bảng payment trước đó rỗng nên trang Doanh thu chưa có gì để hiển thị.
--    payment.booking_id là UNIQUE: mỗi lịch chỉ có một bản ghi thanh toán, nên
--    hình thức và trạng thái chọn theo booking_id thay vì nhân bảng, và dùng
--    INSERT IGNORE để lần chạy sau không va chạm bản ghi đã có.
-- ---------------------------------------------------------------
INSERT IGNORE INTO payment (booking_id, amount, payment_method, payment_status, payment_date)
SELECT
  b.booking_id,
  s.price,
  ELT(1 + (b.booking_id % 3), 'CASH', 'ONLINE', 'BANK_TRANSFER'),
  ELT(1 + (b.booking_id % 4), 'PAID', 'PAID', 'DEPOSITED', 'UNPAID'),
  b.end_time
FROM booking b
JOIN services s ON s.service_id = b.service_id
WHERE b.status = 'COMPLETED';

-- ---------------------------------------------------------------
-- 6. Đánh giá cho một phần lịch đã hoàn thành
--    review.booking_id cũng là UNIQUE nên mỗi lịch chỉ nhận một đánh giá;
--    INSERT IGNORE giữ cho việc chạy lại migration không lỗi.
-- ---------------------------------------------------------------
INSERT IGNORE INTO review (booking_id, customer_id, rating, comment)
SELECT b.booking_id, b.customer_id, p.rating, p.comment
FROM booking b
JOIN (
  SELECT 5 AS rating, 'Móng làm rất đẹp, dính hơn ba tuần, nhân viên nhiệt tình.' AS comment
  UNION ALL SELECT 5, 'Sạch sẹ, thoải mái, giá hợp lý so với chất lượng.'
  UNION ALL SELECT 4, 'Làm ổn, hơi lâu vì phải chờ một chút.'
  UNION ALL SELECT 4, 'Màu sơn đúng ý, móng bền.'
  UNION ALL SELECT 3, 'Vẽ hơi khác bản mẫu, nhưng nhân viên chịu sửa lại cho mình.'
) p
WHERE b.status = 'COMPLETED'
ORDER BY b.booking_id
LIMIT 5;

DROP TEMPORARY TABLE IF EXISTS tmp_plan;
