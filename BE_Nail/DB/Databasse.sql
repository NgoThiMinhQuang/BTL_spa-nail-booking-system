-- =====================================================
-- DATABASE: NAIL BOOKING MANAGEMENT SYSTEM
-- MOBILE CROSS PLATFORM PROJECT
-- =====================================================

DROP DATABASE IF EXISTS nail_management;
CREATE DATABASE nail_management
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE nail_management;

-- =====================================================
-- 1. USERS
-- Quản lý tài khoản Customer / Staff / Admin
-- =====================================================

CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    role ENUM(
        'CUSTOMER',
        'STAFF',
        'ADMIN'
    ) NOT NULL DEFAULT 'CUSTOMER',
    status ENUM(
        'ACTIVE',
        'INACTIVE'
    ) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);



-- =====================================================
-- 2. CUSTOMER
-- Thông tin khách hàng
-- =====================================================

CREATE TABLE customer (
    customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    total_spending DECIMAL(12,2)
    DEFAULT 0,
    no_show_count INT
    DEFAULT 0,
    FOREIGN KEY(user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE

);



-- =====================================================
-- 3. STAFF
-- Nhân viên Nail
-- =====================================================

CREATE TABLE staff (
    staff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    experience_year INT DEFAULT 0,
    specialty VARCHAR(255),
    rating DECIMAL(2,1)
    DEFAULT 0,
    FOREIGN KEY(user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE

);



-- =====================================================
-- 4. SERVICE CATEGORY
-- Loại dịch vụ
-- =====================================================

CREATE TABLE service_category (

    category_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100)
    NOT NULL,
    description TEXT

);



-- =====================================================
-- 5. SERVICES
-- Dịch vụ Nail
-- =====================================================

CREATE TABLE services (
    service_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT,
    service_name VARCHAR(150)
    NOT NULL,
    image VARCHAR(255),
    description TEXT,
    price DECIMAL(12,2)
    NOT NULL,
    duration INT NOT NULL
    COMMENT 'Thời gian thực hiện (phút)',
    buffer_time INT DEFAULT 0
    COMMENT 'Thời gian nghỉ sau dịch vụ',
    status ENUM(
        'ACTIVE',
        'HIDDEN'
    )
    DEFAULT 'ACTIVE',
    FOREIGN KEY(category_id)
    REFERENCES service_category(category_id)

);

-- =====================================================
-- 6. STAFF_SERVICE
-- Nhân viên có thể thực hiện dịch vụ nào
-- Quan hệ nhiều nhiều
-- =====================================================

CREATE TABLE staff_service (
    staff_id BIGINT,
    service_id BIGINT,
    PRIMARY KEY(
        staff_id,
        service_id
    ),

    FOREIGN KEY(staff_id)
    REFERENCES staff(staff_id)
    ON DELETE CASCADE,
    
    FOREIGN KEY(service_id)
    REFERENCES services(service_id)
    ON DELETE CASCADE

);



-- =====================================================
-- 7. STAFF SCHEDULE
-- Lịch làm việc nhân viên
-- =====================================================

CREATE TABLE staff_schedule (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    staff_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM(
        'AVAILABLE',
        'OFF'
    )
    DEFAULT 'AVAILABLE',

    FOREIGN KEY(staff_id)
    REFERENCES staff(staff_id)
    ON DELETE CASCADE

);



-- =====================================================
-- 8. BOOKING
-- Đặt lịch
-- =====================================================

CREATE TABLE booking (

    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    staff_id BIGINT NULL,
    service_id BIGINT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM(
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW'
    )
    DEFAULT 'PENDING',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id)
    REFERENCES customer(customer_id),
    FOREIGN KEY(staff_id)
    REFERENCES staff(staff_id),
    FOREIGN KEY(service_id)
    REFERENCES services(service_id)

);



-- =====================================================
-- 9. PAYMENT
-- Thanh toán
-- =====================================================

CREATE TABLE payment (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNIQUE NOT NULL,
    amount DECIMAL(12,2)
    NOT NULL,
    payment_method ENUM(
        'CASH',
        'BANK_TRANSFER',
        'ONLINE'
    ),

    payment_status ENUM(
        'UNPAID',
        'DEPOSITED',
        'PAID'

    )
    DEFAULT 'UNPAID',
    payment_date DATETIME,
    FOREIGN KEY(booking_id)
    REFERENCES booking(booking_id)
    ON DELETE CASCADE

);



-- =====================================================
-- 10. REVIEW
-- Đánh giá dịch vụ
-- =====================================================

CREATE TABLE review (

    review_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNIQUE NOT NULL,
    customer_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(booking_id)
    REFERENCES booking(booking_id)
    ON DELETE CASCADE,
    FOREIGN KEY(customer_id)
    REFERENCES customer(customer_id)

);



-- =====================================================
-- INDEX TỐI ƯU KIỂM TRA LỊCH TRỐNG
-- =====================================================


CREATE INDEX idx_booking_staff_time

ON booking(
    staff_id,
    start_time,
    end_time
);



CREATE INDEX idx_booking_customer

ON booking(customer_id);



CREATE INDEX idx_service_category

ON services(category_id);



-- =====================================================
-- DỮ LIỆU MẪU
-- =====================================================


INSERT INTO service_category
(category_name, description)

VALUES

('Sơn Gel','Dịch vụ sơn gel cao cấp'),

('Nail Art','Trang trí móng nghệ thuật'),

('Chăm sóc móng','Chăm sóc và phục hồi móng');




INSERT INTO services
(
category_id,
service_name,
description,
price,
duration,
buffer_time
)

VALUES


(
1,
'Sơn Gel Cao Cấp',
'Sơn gel nhiều màu',
200000,
60,
15
),


(
2,
'Nail Art Nghệ Thuật',
'Vẽ móng nghệ thuật',
350000,
90,
15
),


(
3,
'Chăm Sóc Móng',
'Chăm sóc móng cơ bản',
150000,
45,
10
);



-- =====================================================
-- END DATABASE
-- =====================================================