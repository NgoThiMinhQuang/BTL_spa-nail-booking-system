USE nail_management;

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

INSERT INTO promotions (title, subtitle, button_text, image, discount_percent, start_date, end_date)
SELECT 'Nails là ngôn ngữ của sự tự tin', 'Đẹp hơn mỗi ngày cùng NailHouse', 'Đặt lịch ngay', '/uploads/banner/nail-banner-v2.png', 20, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR)
WHERE NOT EXISTS (SELECT 1 FROM promotions);

INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Blush French', '/uploads/nails/nail-collection-v2.png', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Blush French');
INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Pink Blossom', '/uploads/nails/nail-collection-v2.png', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Pink Blossom');
INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Nude Garden', '/uploads/nails/nail-collection-v2.png', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Nude Garden');
INSERT INTO nail_designs (design_name, image, category_id, is_trending)
SELECT 'Rose Glow', '/uploads/nails/nail-collection-v2.png', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nail_designs WHERE design_name = 'Rose Glow');

UPDATE services
SET image = '/uploads/nails/nail-collection-v2.png'
WHERE image IS NULL OR image = '';

INSERT INTO users (full_name, phone, email, password, avatar, role)
VALUES ('Thợ chính Lan', '0900000001', 'lan@nailhouse.local', '$2b$10$seedAccountNotForLogin000000000000000000000000000', '/uploads/artists/lan-v2.png', 'STAFF')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), avatar = VALUES(avatar);
SET @lan_user_id = (SELECT user_id FROM users WHERE phone = '0900000001');
INSERT INTO staff (user_id, experience_year, specialty, rating)
VALUES (@lan_user_id, 3, 'Sơn gel & Nail Art', 4.9)
ON DUPLICATE KEY UPDATE experience_year = VALUES(experience_year), specialty = VALUES(specialty), rating = VALUES(rating);

INSERT INTO users (full_name, phone, email, password, avatar, role)
VALUES ('Mai Anh', '0900000002', 'maianh@nailhouse.local', '$2b$10$seedAccountNotForLogin000000000000000000000000000', '/uploads/artists/mai-anh-v2.png', 'STAFF')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), avatar = VALUES(avatar);
SET @mai_user_id = (SELECT user_id FROM users WHERE phone = '0900000002');
INSERT INTO staff (user_id, experience_year, specialty, rating)
VALUES (@mai_user_id, 5, 'Đắp gel & Vẽ hoa 3D', 5.0)
ON DUPLICATE KEY UPDATE experience_year = VALUES(experience_year), specialty = VALUES(specialty), rating = VALUES(rating);

INSERT INTO users (full_name, phone, email, password, avatar, role)
VALUES ('Minh', '0900000003', 'minh@nailhouse.local', '$2b$10$seedAccountNotForLogin000000000000000000000000000', NULL, 'CUSTOMER')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role);
SET @minh_user_id = (SELECT user_id FROM users WHERE phone = '0900000003');
INSERT INTO customer (user_id)
VALUES (@minh_user_id)
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
SET @minh_customer_id = (SELECT customer_id FROM customer WHERE user_id = @minh_user_id);
SET @first_staff_id = (SELECT staff_id FROM staff ORDER BY rating DESC LIMIT 1);
SET @first_service_id = (SELECT service_id FROM services WHERE status = 'ACTIVE' ORDER BY service_id LIMIT 1);

INSERT INTO booking (customer_id, staff_id, service_id, start_time, end_time, status, note)
SELECT @minh_customer_id, @first_staff_id, @first_service_id,
       TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '09:00:00'),
       TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:00:00'),
       'CONFIRMED', 'Lịch hẹn mẫu từ dữ liệu MySQL'
WHERE @first_service_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM booking
    WHERE customer_id = @minh_customer_id
      AND start_time >= NOW()
      AND status IN ('PENDING', 'CONFIRMED')
  );
