-- KHÔNG có câu `USE nail_management` ở đây.
--
-- Trước đây file này bắt đầu bằng `USE nail_management;`. Mỗi file
-- migration được nối vào đúng database đã cấu hình sẵn (DB_NAME trong
-- .env), nên câu `USE` cứng này chỉ gây hại: khi chạy test trên database
-- riêng, toàn bộ câu lệnh của file vẫn ghi vào database thật. Đó là lý
-- do dữ liệu test "biến mất" mà không báo lỗi.
--
-- Muốn đổi sang database khác thì đặt DB_NAME trong .env, không sửa ở đây.

CREATE TABLE IF NOT EXISTS promotions (
    promotion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(255),
    button_text VARCHAR(50) DEFAULT 'Đặt lịch ngay',
    image VARCHAR(255) NOT NULL,
    discount_percent DECIMAL(5,2),
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nail_designs (
    design_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_name VARCHAR(150) NOT NULL,
    image VARCHAR(255) NOT NULL,
    category_id BIGINT NULL,
    is_trending BOOLEAN DEFAULT FALSE,
    status ENUM('ACTIVE', 'HIDDEN') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES service_category(category_id)
);

CREATE TABLE IF NOT EXISTS service_images (
    image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_benefits (
    benefit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    subtitle VARCHAR(150),
    icon VARCHAR(50),
    color VARCHAR(20),
    sort_order INT DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_steps (
    step_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL,
    step_number INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description VARCHAR(500),
    estimated_minutes INT DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
    UNIQUE KEY uk_service_step (service_id, step_number)
);

INSERT INTO promotions (title, subtitle, button_text, image, discount_percent, start_date, end_date)
SELECT 'Nails là ngôn ngữ của sự tự tin', 'Đẹp hơn mỗi ngày cùng NailHouse', 'Đặt lịch ngay', '/uploads/banner/nail-banner-v2.png', 20, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR)
WHERE NOT EXISTS (SELECT 1 FROM promotions);

INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Blush French', '/uploads/nails/nail_blush_french.png', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Blush French');
INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Pink Blossom', '/uploads/nails/nail_pink_blossom.png', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Pink Blossom');
INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Nude Garden', '/uploads/nails/nail_nude_garden.png', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Nude Garden');
INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Rose Glow', '/uploads/nails/nail-collection-v2.png', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Rose Glow');

/* Mỗi dịch vụ một ảnh đại diện đúng món (không dùng chung một ảnh cho cả
   menu — nhìn là biết ảnh minh họa giả). */
UPDATE services SET image = CASE
  WHEN service_name LIKE '%Nail Art%' THEN '/uploads/nails/nail_pink_blossom.png'
  WHEN service_name LIKE '%Chăm Sóc Móng%' OR service_name LIKE '%Cham Soc Mong%' THEN '/uploads/nails/nail_nude_garden.png'
  ELSE '/uploads/nails/nail-collection-v2.png' END
WHERE image IS NULL OR image = '';

INSERT INTO service_images (service_id, image_url, sort_order)
SELECT s.service_id, s.image, 1 FROM services s
WHERE s.image IS NOT NULL AND s.image <> ''
  AND NOT EXISTS (SELECT 1 FROM service_images si WHERE si.service_id = s.service_id);

/* Sua du lieu cu bi gan anh chung truoc day: anh dai dien dung mon,
   anh mau ve dung hinh that, xoa anh trung lap. Cac lenh nay chi cham
   vao dong con giu nguyen gia tri seed cu — anh Admin tu doi thi giu. */
UPDATE services SET image = CASE
  WHEN service_name LIKE '%Nail Art%' THEN '/uploads/nails/nail_pink_blossom.png'
  WHEN service_name LIKE '%Chăm Sóc Móng%' OR service_name LIKE '%Cham Soc Mong%' THEN '/uploads/nails/nail_nude_garden.png'
  ELSE '/uploads/nails/nail-collection-v2.png' END
WHERE image = '/uploads/nails/nail-collection-v2.png';

DELETE si FROM service_images si
  JOIN service_images keep
    ON keep.service_id = si.service_id AND keep.sort_order = 1
 WHERE si.sort_order > 1 AND si.image_url = keep.image_url;

UPDATE nail_designs SET image = '/uploads/nails/nail_blush_french.png'
 WHERE design_name = 'Blush French' AND image = '/uploads/nails/nail-collection-v2.png';
UPDATE nail_designs SET image = '/uploads/nails/nail_pink_blossom.png'
 WHERE design_name = 'Pink Blossom' AND image = '/uploads/nails/nail-collection-v2.png';
UPDATE nail_designs SET image = '/uploads/nails/nail_nude_garden.png'
 WHERE design_name = 'Nude Garden' AND image = '/uploads/nails/nail-collection-v2.png';

INSERT INTO service_benefits (service_id, title, subtitle, icon, color, sort_order)
SELECT s.service_id, 'Bền màu', '3–4 tuần', 'diamond-outline', '#4E9A91', 1 FROM services s
WHERE NOT EXISTS (SELECT 1 FROM service_benefits sb WHERE sb.service_id = s.service_id AND sb.title = 'Bền màu');
INSERT INTO service_benefits (service_id, title, subtitle, icon, color, sort_order)
SELECT s.service_id, 'Bóng đẹp', 'Tự nhiên', 'sparkles-outline', '#B57CC2', 2 FROM services s
WHERE NOT EXISTS (SELECT 1 FROM service_benefits sb WHERE sb.service_id = s.service_id AND sb.title = 'Bóng đẹp');
INSERT INTO service_benefits (service_id, title, subtitle, icon, color, sort_order)
SELECT s.service_id, 'An toàn', 'Cho móng', 'shield-checkmark-outline', '#D99A3E', 3 FROM services s
WHERE NOT EXISTS (SELECT 1 FROM service_benefits sb WHERE sb.service_id = s.service_id AND sb.title = 'An toàn');
INSERT INTO service_benefits (service_id, title, subtitle, icon, color, sort_order)
SELECT s.service_id, 'Phù hợp', 'Nhiều phong cách', 'heart-outline', '#E26D6D', 4 FROM services s
WHERE NOT EXISTS (SELECT 1 FROM service_benefits sb WHERE sb.service_id = s.service_id AND sb.title = 'Phù hợp');

INSERT INTO service_steps (service_id, step_number, title, description, estimated_minutes)
SELECT s.service_id, 1, 'Vệ sinh và tạo dáng móng', 'Làm sạch móng, xử lý da thừa và chỉnh form phù hợp với bàn tay.', 10 FROM services s
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), estimated_minutes = VALUES(estimated_minutes);
INSERT INTO service_steps (service_id, step_number, title, description, estimated_minutes)
SELECT s.service_id, 2, 'Dưỡng và bảo vệ móng', 'Thoa lớp dưỡng giúp bề mặt móng chắc khỏe trước khi sơn.', 5 FROM services s
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), estimated_minutes = VALUES(estimated_minutes);
INSERT INTO service_steps (service_id, step_number, title, description, estimated_minutes)
SELECT s.service_id, 3, 'Sơn lớp nền', 'Sơn lớp base mỏng và hơ đèn để tăng độ bám cho màu sơn.', 10 FROM services s
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), estimated_minutes = VALUES(estimated_minutes);
INSERT INTO service_steps (service_id, step_number, title, description, estimated_minutes)
SELECT s.service_id, 4, 'Sơn màu và trang trí', 'Thực hiện màu sơn hoặc mẫu trang trí đã chọn, kiểm tra từng lớp.', 25 FROM services s
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), estimated_minutes = VALUES(estimated_minutes);
INSERT INTO service_steps (service_id, step_number, title, description, estimated_minutes)
SELECT s.service_id, 5, 'Phủ bóng và hoàn thiện', 'Phủ top bảo vệ, làm sạch và dưỡng vùng da quanh móng.', 10 FROM services s
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), estimated_minutes = VALUES(estimated_minutes);

-- HET: tai khoan/khach/lich mau tu nhoi truoc day da chuyen sang script
-- rieng `npm run db:seed-demo` (dang nhap 123456, lich kem thanh toan
-- khop). db:migrate khong tao du lieu gia tu dong nua.
