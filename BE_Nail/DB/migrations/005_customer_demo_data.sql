-- 005_customer_demo_data.sql
-- Dữ liệu khách hàng mẫu cho trang "Khách hàng của tôi":
--   hồ sơ (địa chỉ / ngày sinh / ghi chú) + lịch sử đặt dịch vụ + đánh giá.
-- Idempotent: chạy lại nhiều lần không tạo bản ghi trùng.

SET NAMES utf8mb4;

-- =====================================================
-- 1. Tài khoản khách hàng
-- =====================================================
INSERT INTO users (full_name, phone, email, password, avatar, role, status) VALUES
('Trần Thị Mai',   '0910000001', 'mai.tran@gmail.com',      '$2b$10$demo', '/uploads/avatars/cust-0910000001.jpg', 'CUSTOMER', 'ACTIVE'),
('Nguyễn Thu Hà',  '0910000002', 'ha.nguyen@gmail.com',    '$2b$10$demo', '/uploads/avatars/cust-0910000002.jpg', 'CUSTOMER', 'ACTIVE'),
('Lê Kim Chi',     '0910000003', 'chi.le@gmail.com',       '$2b$10$demo', '/uploads/avatars/cust-0910000003.jpg', 'CUSTOMER', 'ACTIVE'),
('Phạm Yến',       '0910000004', 'yen.pham@gmail.com',     '$2b$10$demo', '/uploads/avatars/cust-0910000004.jpg', 'CUSTOMER', 'ACTIVE'),
('Hoàng Minh',     '0910000005', 'minh.hoang@gmail.com',   '$2b$10$demo', '/uploads/avatars/cust-0910000005.jpg', 'CUSTOMER', 'ACTIVE'),
('Trần Ngọc Anh',  '0910000006', 'anh.tran@gmail.com',     '$2b$10$demo', '/uploads/avatars/cust-0910000006.jpg', 'CUSTOMER', 'ACTIVE'),
('Đỗ Thảo Vy',     '0910000007', 'vy.do@gmail.com',        '$2b$10$demo', '/uploads/avatars/cust-0910000007.jpg', 'CUSTOMER', 'ACTIVE'),
('Nguyễn Phương Linh','0910000008','linh.nguyen@gmail.com', '$2b$10$demo', '/uploads/avatars/cust-0910000008.jpg', 'CUSTOMER', 'ACTIVE'),
('Vũ Khánh Duy',   '0910000009', 'duy.vu@gmail.com',       '$2b$10$demo', '/uploads/avatars/cust-0910000009.jpg', 'CUSTOMER', 'ACTIVE'),
('Bùi Thu Hà',     '0910000010', 'bha.bui@gmail.com',      '$2b$10$demo', '/uploads/avatars/cust-0910000010.jpg', 'CUSTOMER', 'ACTIVE'),
('Đặng Thu Trang', '0910000011', 'trang.dang@gmail.com',   '$2b$10$demo', '/uploads/avatars/cust-0910000011.jpg', 'CUSTOMER', 'ACTIVE'),
('Lê Hoàng Long',  '0910000012', 'long.le@gmail.com',      '$2b$10$demo', '/uploads/avatars/cust-0910000012.jpg', 'CUSTOMER', 'ACTIVE'),
('Huỳnh Mai Anh',  '0910000013', 'maihanh.huynh@gmail.com','$2b$10$demo', '/uploads/avatars/cust-0910000013.jpg', 'CUSTOMER', 'ACTIVE'),
('Tạ Quốc Bảo',    '0910000014', 'bao.ta@gmail.com',       '$2b$10$demo', '/uploads/avatars/cust-0910000014.jpg', 'CUSTOMER', 'ACTIVE')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name), email = VALUES(email), avatar = VALUES(avatar),
  role = 'CUSTOMER', status = 'ACTIVE';

-- =====================================================
-- 2. Hồ sơ khách hàng
-- =====================================================
INSERT INTO customer (user_id, address, birthday, note)
SELECT u.user_id, p.address, p.birthday, p.note
FROM users u
JOIN (
  SELECT '0910000001' AS phone, 'Quận 1, TP. Hồ Chí Minh' AS address, '1996-05-12' AS birthday, 'Thích tone hồng nhạt, thường đặt lịch cuối tuần.' AS note
  UNION ALL SELECT '0910000002', 'Quận 7, TP. Hồ Chí Minh',        '1994-11-03', 'Dị ứng sơn chứa acetone, nhắc khách trước khi làm.'
  UNION ALL SELECT '0910000003', 'Thủ Đức, TP. Hồ Chí Minh',        '1998-08-21', 'Ưu tiên nail art tối giản, màu trung tính.'
  UNION ALL SELECT '0910000004', 'Quận 3, TP. Hồ Chí Minh',         '1995-02-14', 'Hay đặt lịch gần trưa.'
  UNION ALL SELECT '0910000005', 'Bình Thạnh, TP. Hồ Chí Minh',     '1993-07-30', 'Khách nam, thích màu trung tính, móng mỏng.'
  UNION ALL SELECT '0910000006', 'Quận 5, TP. Hồ Chí Minh',         '1997-12-09', ''
  UNION ALL SELECT '0910000007', 'Tân Bình, TP. Hồ Chí Minh',        '1999-04-17', 'Sinh nhật 17/04, nên nhắc mừng khi khách ghé.'
  UNION ALL SELECT '0910000008', 'Quận 2, TP. Hồ Chí Minh',         '1992-09-25', 'Khách VIP — luôn ưu tiên giữ chỗ khung giờ tốt.'
  UNION ALL SELECT '0910000009', 'Gò Vấp, TP. Hồ Chí Minh',         '1996-01-08', ''
  UNION ALL SELECT '0910000010', 'Quận 8, TP. Hồ Chí Minh',         '1994-06-11', 'Chỉ quan tâm dịch vụ chăm sóc móng.'
  UNION ALL SELECT '0910000011', 'Phú Nhuận, TP. Hồ Chí Minh',      '1997-03-19', 'Hay đi cùng bạn, đặt lịch song song.'
  UNION ALL SELECT '0910000012', 'Quận 11, TP. Hồ Chí Minh',        '1993-10-02', 'Móng yếu, cần chăm sóc kỹ trước khi sơn.'
  UNION ALL SELECT '0910000013', 'Bình Chánh, TP. Hồ Chí Minh',     '1998-11-27', ''
  UNION ALL SELECT '0910000014', 'Củ Chi, TP. Hồ Chí Minh',         '1995-08-05', 'Chỉ liên hệ qua Zalo, không nhận cuộc gọi.'
) p ON p.phone = u.phone
ON DUPLICATE KEY UPDATE
  address = VALUES(address), birthday = VALUES(birthday), note = VALUES(note);

-- =====================================================
-- 3. Lịch sử đặt dịch vụ
--    plan: khách / nhân viên / số lượt / bước bị hủy / bước không đến / giờ bắt đầu
--    ladder: bước -> số ngày lệch so với hôm nay
-- =====================================================
INSERT INTO booking (customer_id, staff_id, service_id, start_time, end_time, status, note)
SELECT y.customer_id, y.staff_id, y.service_id, y.start_time,
       DATE_ADD(y.start_time, INTERVAL sv.duration MINUTE), y.status, NULL
FROM (
  SELECT n.customer_id, n.staff_id, n.service_id, n.status,
         TIMESTAMPADD(MINUTE, n.slot,
           TIMESTAMPADD(DAY, n.day_offset, TIMESTAMP(CURRENT_DATE, '09:00:00'))) AS start_time
  FROM (
    SELECT pl.customer_id, pl.staff_id, ladder.day_offset,
           ((pl.service_id - 1 + ladder.step) % 3) + 1 AS service_id,
           CASE
             WHEN ladder.step = pl.skip_step  THEN 'NO_SHOW'
             WHEN ladder.step = pl.drop_step  THEN 'CANCELLED'
             WHEN ladder.day_offset >= 0      THEN 'CONFIRMED'
             WHEN ladder.day_offset >= -2     THEN 'COMPLETED'
             ELSE 'COMPLETED'
           END AS status,
           (pl.start_slot + ladder.step * 90) % 600 AS slot
    FROM (
      SELECT c.customer_id, st.staff_id, p.service_id, p.visits,
             p.skip_step, p.drop_step, p.start_slot
      FROM (
        SELECT '0910000001' AS cphone, '0901000001' AS sphone, 1 AS service_id, 8 AS visits, 5 AS skip_step, 3 AS drop_step,  0 AS start_slot
        UNION ALL SELECT '0910000002', '0901000001', 3, 5, -1, 4,  40
        UNION ALL SELECT '0910000003', '0901000001', 2, 4, -1, 3,  80
        UNION ALL SELECT '0910000004', '0901000001', 1, 6,  6, -1, 120
        UNION ALL SELECT '0910000005', '0901000001', 3, 3, -1, 2, 160
        UNION ALL SELECT '0910000006', '0901000001', 2, 2, -1, -1, 200
        UNION ALL SELECT '0910000007', '0901000001', 1, 4, -1, 3, 240
        UNION ALL SELECT '0910000008', '0901000001', 2, 7,  4, 2, 280
        UNION ALL SELECT '0910000009', '0901000001', 3, 3, -1, -1, 320
        UNION ALL SELECT '0910000010', '0901000001', 3, 2, -1, -1, 360
        UNION ALL SELECT '0910000011', '0901000001', 1, 5, -1, 3, 400
        UNION ALL SELECT '0910000012', '0901000001', 3, 1, -1, -1, 440
        UNION ALL SELECT '0910000013', '0901000001', 2, 3, -1, 2, 480
        UNION ALL SELECT '0910000014', '0901000001', 1, 2, -1, -1, 520
        -- Một phần lịch sử của các khách nằm với nhân viên khác
        UNION ALL SELECT '0910000001', '0901000002', 2, 2, -1, -1,  60
        UNION ALL SELECT '0910000004', '0901000002', 3, 2, -1, -1, 140
        UNION ALL SELECT '0910000008', '0901000002', 1, 2, -1, -1, 300
        UNION ALL SELECT '0910000003', '0901000003', 2, 2, -1, -1, 100
        UNION ALL SELECT '0910000007', '0901000003', 1, 2, -1, -1, 260
        UNION ALL SELECT '0910000011', '0901000005', 2, 2, -1, -1, 420
      ) p
      JOIN customer c ON c.user_id = (SELECT user_id FROM users WHERE phone = p.cphone)
      JOIN staff   st ON st.user_id = (SELECT user_id FROM users WHERE phone = p.sphone)
      WHERE c.customer_id IS NOT NULL AND st.staff_id IS NOT NULL
    ) pl
    JOIN (
      SELECT 0 AS step,  0 AS day_offset
      UNION ALL SELECT 1,  -1
      UNION ALL SELECT 2,  -5
      UNION ALL SELECT 3, -11
      UNION ALL SELECT 4, -19
      UNION ALL SELECT 5, -29
      UNION ALL SELECT 6, -41
      UNION ALL SELECT 7, -56
      UNION ALL SELECT 8, -74
      UNION ALL SELECT 9, -95
    ) ladder ON ladder.step < pl.visits
  ) n
) y
JOIN services sv ON sv.service_id = y.service_id
WHERE NOT EXISTS (
  SELECT 1 FROM booking ob
  WHERE ob.customer_id = y.customer_id
    AND ob.staff_id = y.staff_id
    AND ob.service_id = y.service_id
    AND DATE(ob.start_time) = DATE(y.start_time)
);

-- =====================================================
-- 4. Đánh giá cho các lịch đã hoàn thành
-- =====================================================
INSERT INTO review (booking_id, customer_id, rating, comment)
SELECT b.booking_id, b.customer_id,
       CASE WHEN (b.booking_id * 7) % 10 < 6 THEN 5
            WHEN (b.booking_id * 7) % 10 < 9 THEN 4
            ELSE 3 END,
       CASE WHEN (b.booking_id * 7) % 10 < 6 THEN 'Nhân viên làm rất cẩn thậ, móng đẹp và đúng màu mình thích.'
            WHEN (b.booking_id * 7) % 10 < 9 THEN 'Dịch vụ ổn, hơi lâu hơn dự kiến một chút.'
            ELSE 'Chưa thật sự hài lòng về độ bám của sơn.' END
FROM booking b
WHERE b.status = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM review r WHERE r.booking_id = b.booking_id);

-- =====================================================
-- 5. Tổng chi tiêu và số lần không đến
-- =====================================================
UPDATE customer c
SET c.total_spending = COALESCE((
      SELECT SUM(s.price) FROM booking b JOIN services s ON s.service_id = b.service_id
      WHERE b.customer_id = c.customer_id AND b.status = 'COMPLETED'), 0),
    c.no_show_count = (
      SELECT COUNT(*) FROM booking b
      WHERE b.customer_id = c.customer_id AND b.status = 'NO_SHOW');
