-- ============================================================================
--  HỆ THỐNG QUẢN LÝ ĐẶT LỊCH VÀ QUẢN LÝ DỊCH VỤ NAIL
--  SCHEMA HOÀN CHỈNH — DỰNG MỘT LẦN LÀ ĐỦ
-- ============================================================================
--
--  Cách dùng:
--     mysql -u root -p < DB/Database.sql
--  hoặc trong MySQL Workbench: mở file này rồi Run.
--
--  File này là schema CUỐI CÙNG của dự án: đã gộp hết các thay đổi của
--  toàn bộ file trong DB/migrations. Trước đây file gốc (Databasse.sql)
--  chỉ có 10 bảng còn thiếu nguồn lịch, ảnh khách gửi, nhật ký sự kiện,
--  dịch vụ phát sinh, yêu cầu nghỉ và bảng chụp giá — nên nếu dựng database
--  mới từ file gốc rồi chạy code thì sẽ hỏng loạt.
--
--  Sau khi tạo database bằng file này, vẫn nên chạy:
--     npm run db:migrate
--  vì các migration còn chứa phần dữ liệu mẫu và các câu sửa dữ liệu cũ.
--  Mọi migration đều idempotent nên chạy lại nhiều lần vẫn an toàn.
--
--  Quy ước đặc biệt của dự án:
--   - ACTIVE / INACTIVE là bộ trạng thái DUY NHẤT cho cả dịch vụ, danh mục,
--     nhân viên và khách hàng. Không dùng HIDDEN.
--   - Mật khẩu luôn lưu dạng hash bcrypt, không bao giờ lưu dạng thô.
--   - end_time = start_time + service_duration + buffer_time.
--   - Dữ liệu đã có lịch hẹn tham chiếu thì chuyển sang INACTIVE, không xoá.
-- ============================================================================

DROP DATABASE IF EXISTS nail_management;
CREATE DATABASE nail_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nail_management;

SET NAMES utf8mb4;

-- Tắt kiểm tra khoá ngoại khi dựng lại: thứ tự các bảng con (booking,
-- payment, review) được viết trước bảng cha nhưng khoá ngoại vẫn phải
-- trỏ tới bảng cha có thật, nên bật lại ở cuối file.
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
--  1. USERS — tài khoản của cả ba vai trò
-- ----------------------------------------------------------------------------
--  Một tài khoản = một vai trò. Bảng này là nguồn xác thực duy nhất:
--  không có id người dùng nào được lấy từ request, tất cả đều tra từ
--  token đăng nhập (xem src/lib/auth.js).
--
--  status = 'INACTIVE' nghĩa là khoá tài khoản: vẫn còn tên để các lịch
--  hẹn cũ đọc được, nhưng không đăng nhập được nữa.
-- ============================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    -- Số điện thoại là định danh đăng nhập của khách, nên bắt buộc duy nhất.
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100) NULL,
    -- bcrypt hash, KHÔNG bao giờ lưu mật khẩu thô.
    password VARCHAR(255) NOT NULL,
    avatar VARCHAR(255) NULL,
    role ENUM('CUSTOMER','STAFF','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    password_changed_at DATETIME NULL
        COMMENT 'Lần cuối đổi mật khẩu, dùng cho chính sách bắt buộc đổi mật khẩu',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_users_phone (phone),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_status (status)
) ENGINE=InnoDB;

-- ============================================================================
--  2. CUSTOMER — hồ sơ khách hàng
-- ----------------------------------------------------------------------------
--  KHÔNG còn cột cache total_spending / no_show_count: mọi báo cáo tính
--  trực tiếp từ payment (PAID) và booking (NO_SHOW). Cột cache dễ lệch
--  khi lịch bị hủy hoặc thanh toán muộn, lại gây câu hỏi thừa khi bảo vệ.
-- ============================================================================
DROP TABLE IF EXISTS `customer`;
CREATE TABLE customer (
    customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    address VARCHAR(255) NULL,
    birthday DATE NULL,
    note TEXT NULL COMMENT 'Ghi chú nội bộ của nhân viên về khách này (tối đa 2000 ký tự theo customer.controller.js)',

    UNIQUE KEY uq_customer_user (user_id),
    CONSTRAINT fk_customer_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  3. STAFF — hồ sơ nghề nghiệp của nhân viên
-- ----------------------------------------------------------------------------
--  KHÔNG cột rating. Điểm đánh giá nhân viên được tính trực tiếp bằng
--  AVG(review.rating). Trước đây có cả hai nơi lưu nên dễ lệch: staff.rating
--  là 4.2 trong khi trung bình đánh giá thật là 4.8.
--
--  Nhân viên từng có lịch hẹn thì không xoá hồ sơ này — khoá tài khoản
--  trong bảng users bằng cách đặt status = 'INACTIVE'.
-- ============================================================================
DROP TABLE IF EXISTS `staff`;
CREATE TABLE staff (
    staff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    experience_year INT NOT NULL DEFAULT 0 COMMENT 'Số năm kinh nghiệm',
    specialty VARCHAR(255) NULL COMMENT 'Chuyên môn',

    UNIQUE KEY uq_staff_user (user_id),
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  4. SERVICE_CATEGORY — nhóm dịch vụ
-- ----------------------------------------------------------------------------
--  Khách chỉ thấy danh mục ACTIVE. Tắt một danh mục là ẩn luôn cả nhóm
--  dịch vụ của nó mà không cần sửa từng dịch vụ con.
-- ============================================================================
DROP TABLE IF EXISTS `service_category`;
CREATE TABLE service_category (
    category_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    service_count INT NOT NULL DEFAULT 0 COMMENT 'Cache số dịch vụ thuộc danh mục',

    KEY idx_category_status (status)
) ENGINE=InnoDB;

-- ============================================================================
--  5. SERVICES — dịch vụ trong danh mục
-- ----------------------------------------------------------------------------
--  duration  = thời lượng thực hiện (phút)
--  buffer_time = khoảng nghỉ sau dịch vụ (phút)
--
--  Nhân viên bị chiếm lịch trong duration + buffer_time, nên hai lịch kề
--  nhau phải cách nhau ít nhất tổng buffer của lịch trước.
--
--  Giá và thời lượng ở đây là GIÁ HIỆN TẠI của danh mục. Lịch hẹn đã chụp
--  lại giá và thời lượng tại thời điểm khách đặt (xem bảng booking), nên
--  đổi giá ở đây không làm thay đổi các lịch cũ.
-- ============================================================================
DROP TABLE IF EXISTS `services`;
CREATE TABLE services (
    service_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT NULL,
    service_name VARCHAR(150) NOT NULL,
    image VARCHAR(255) NULL,
    description TEXT NULL,
    price DECIMAL(12,2) NOT NULL,
    duration INT NOT NULL COMMENT 'Thời gian thực hiện (phút)',
    buffer_time INT NOT NULL DEFAULT 0 COMMENT 'Khoảng nghỉ sau dịch vụ (phút)',
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
        COMMENT 'INACTIVE = ngừng cung cấp, KHÔNG xoá vì lịch cũ còn tham chiếu',

    KEY idx_services_category (category_id),
    KEY idx_services_status (status),
    CONSTRAINT fk_services_category FOREIGN KEY (category_id)
        REFERENCES service_category(category_id)
) ENGINE=InnoDB;

-- ============================================================================
--  6. STAFF_SERVICE — nhân viên thực hiện được dịch vụ nào (nhiều–nhiều)
-- ----------------------------------------------------------------------------
--  Quan hệ này quyết định ai nhận được lịch: một nhân viên không có dòng
--  ở đây thì không thể đặt lịch dịch vụ đó, dù ca làm việc còn trống.
-- ============================================================================
DROP TABLE IF EXISTS `staff_service`;
CREATE TABLE staff_service (
    staff_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    PRIMARY KEY (staff_id, service_id),
    KEY idx_staff_service_service (service_id),
    CONSTRAINT fk_staff_service_staff FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_service_service FOREIGN KEY (service_id)
        REFERENCES services(service_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  7. STAFF_SCHEDULE — ca làm việc đã được duyệt
-- ----------------------------------------------------------------------------
--  Một ngày có tối đa một ca. Ca là ngày được làm việc; ngày nghỉ được
--  ghi ở bảng staff_leave_request chứ không ghi bằng status = 'OFF'.
-- ============================================================================
DROP TABLE IF EXISTS `staff_schedule`;
CREATE TABLE staff_schedule (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    staff_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('AVAILABLE','OFF') NOT NULL DEFAULT 'AVAILABLE',

    UNIQUE KEY uq_staff_schedule_day (staff_id, work_date),
    CONSTRAINT fk_schedule_staff FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  8. STAFF_LEAVE_REQUEST — yêu cầu nghỉ
-- ----------------------------------------------------------------------------
--  Nhân viên xin nghỉ → Admin duyệt / từ chối. Chỉ khi status = 'APPROVED'
--  thì nhân viên mới thật sự không nhận được lịch trong khoảng đó.
--
--  Đây là điểm khác biệt so với cách cũ: trước đây nghỉ được ghi bằng
--  staff_schedule.status = 'OFF', nên không biết ai xin, ai duyệt, duyệt
--  lúc nào — và quản trị không có việc gì để duyệt.
--
--  Ràng buộc nghiệp vụ: Admin chỉ duyệt được khi trong khoảng nghỉ không còn
--  lịch nào đang chạy. Nếu còn thì phải đổi nhân viên / đổi giờ / hủy lịch
--  trước rồi mới duyệt (kiểm tra tại controllers/request.controller.js).
-- ============================================================================
DROP TABLE IF EXISTS `staff_leave_request`;
CREATE TABLE staff_leave_request (
    leave_request_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    staff_id BIGINT NOT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    reason VARCHAR(500) NULL,
    leave_type ENUM('NORMAL','EMERGENCY') NOT NULL DEFAULT 'NORMAL'
        COMMENT 'NORMAL = xin trước, duyệt mới hiệu lực; EMERGENCY = báo nghỉ ngay, tự APPROVED để chặn booking mới',
    status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    -- Trỏ tới users.user_id vì người duyệt là quản trị, không phải nhân viên khác.
    reviewed_by BIGINT NULL,
    reviewed_at DATETIME NULL,
    review_note VARCHAR(500) NULL COMMENT 'Lý do Admin duyệt hoặc từ chối',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_leave_staff (staff_id, status),
    KEY idx_leave_range (status, start_datetime, end_datetime),
    CONSTRAINT fk_leave_staff FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
--  9. STAFF_SCHEDULE_REQUEST — yêu cầu thay đổi ca làm việc
-- ----------------------------------------------------------------------------
--  Nhân viên muốn thêm ca (ADD) hoặc bỏ ca (REMOVE) thì gửi yêu cầu ở đây.
--  Chỉ khi Admin duyệt thì bảng staff_schedule mới thay đổi.
-- ============================================================================
DROP TABLE IF EXISTS `staff_schedule_request`;
CREATE TABLE staff_schedule_request (
    schedule_request_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    staff_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    action ENUM('ADD','UPDATE','REMOVE') NOT NULL DEFAULT 'ADD',
    status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    reviewed_by BIGINT NULL,
    reviewed_at DATETIME NULL,
    review_note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_schedule_req_staff (staff_id, status),
    KEY idx_schedule_req_date (work_date, status),
    CONSTRAINT fk_schedule_req_staff FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id) ON DELETE CASCADE,
    CONSTRAINT fk_schedule_req_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
--  10. BOOKING — lịch hẹn
-- ----------------------------------------------------------------------------
--  MÁY TRẠNG THÁI (luật duy nhất ở src/lib/booking-state.js):
--
--      PENDING ──► CONFIRMED ──► PROCESSING ──► COMPLETED
--         │            │
--         │            ├──► NO_SHOW
--         ▼            ▼
--      CANCELLED   CANCELLED
--
--    Ba trạng thái cuối là dữ liệu lịch sử: không đổi trạng thái,
--    không đổi nhân viên, không đổi giờ được nữa.
--
--  KHÔNG có cột payment_status: trạng thái thanh toán nằm ở bảng payment.
--  Một lịch có thể đã hoàn thành nhưng chưa thu tiền — hai thứ đó khác
--  nhau, gộp chung vào một cột sẽ không diễn tả được.
--
--  CHỤP GIÁ (snapshot) — ba cột dưới đây chép lại lúc khách đặt:
--     service_price     giá dịch vụ tại thời điểm đặt
--     service_duration  thời lượng tại thời điểm đặt
--     buffer_time       khoảng nghỉ tại thời điểm đặt
--  Nhờ vậy sau này Admin đổi giá hoặc thời lượng dịch vụ, các lịch cũ vẫn
--  hiện đúng số tiền và đúng độ dài khách đã đặt. Đổi giờ một lịch cũ
--  cũng phải dùng đúng bộ ba số này, không đọc services.duration hiện tại.
--
--  KHÁCH VÃNG LAI (walk-in) không có tài khoản:
--     customer_id = NULL  +  guest_name, guest_phone bắt buộc có
--     Không tạo tài khoản, không tạo mật khẩu cho khách vãng lai.
--     Ràng buộc chk_booking_ghi bắt buộc đúng một trong hai trường hợp.
-- ============================================================================
DROP TABLE IF EXISTS `booking`;
CREATE TABLE booking (
    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NULL COMMENT 'NULL = khách vãng lai, không có tài khoản',
    guest_name VARCHAR(100) NULL COMMENT 'Tên khách ngay trên lịch, khi không có hồ sơ',
    guest_phone VARCHAR(15) NULL,
    staff_id BIGINT NULL COMMENT 'NULL = chưa phân công nhân viên',
    service_id BIGINT NOT NULL,

    -- ---- Chụp giá tại thời điểm đặt ----
    service_price DECIMAL(12,2) NULL,
    service_duration INT NULL,
    buffer_time INT NOT NULL DEFAULT 0,
    -- Thời lượng thực tế khi làm xong, khác thời lượng đặt (khách đến muộn...).
    actual_duration INT NULL,

    start_time DATETIME NOT NULL,
    -- end_time = start_time + service_duration + buffer_time
    -- Nói cách khác: nhân viên bị chiếm lịch tới cả khoảng nghỉ giữa hai lịch.
    end_time DATETIME NOT NULL,

    status ENUM('PENDING','CONFIRMED','PROCESSING','COMPLETED','CANCELLED','NO_SHOW')
        NOT NULL DEFAULT 'PENDING',
    note TEXT NULL COMMENT 'Ghi chú của khách, ví dụ yêu cầu mẫu móng',

    source ENUM('MOBILE','WALK_IN') NOT NULL DEFAULT 'MOBILE',

    cancel_reason VARCHAR(255) NULL,
    cancelled_at DATETIME NULL,
    cancelled_by ENUM('CUSTOMER','STAFF','ADMIN') NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Index phục vụ kiểm tra trùng lịch: truy vấn luôn có điều kiện
    -- staff_id = ? AND start_time < ? AND end_time > ?
    KEY idx_booking_staff_time (staff_id, start_time, end_time),
    KEY idx_booking_customer (customer_id),
    KEY idx_booking_guest_phone (guest_phone),
    KEY idx_booking_status (status),
    KEY idx_booking_day (start_time),

    CONSTRAINT fk_booking_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id),
    CONSTRAINT fk_booking_staff FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id),
    CONSTRAINT fk_booking_service FOREIGN KEY (service_id)
        REFERENCES services(service_id),

    CONSTRAINT chk_booking_guest CHECK (
        (customer_id IS NULL     AND guest_name IS NOT NULL AND guest_phone IS NOT NULL)
     OR (customer_id IS NOT NULL AND guest_name IS NULL     AND guest_phone IS NULL)
    )
) ENGINE=InnoDB;

-- ============================================================================
--  11. BOOKING_ADDON — dịch vụ phát sinh
-- ----------------------------------------------------------------------------
--  service_name chụp lại tên dịch vụ lúc thêm, price chụp lại đơn giá lúc
--  thêm. Nhờ vậy đổi tên hoặc đổi giá dịch vụ sau này không làm thay đổi
--  hoá đơn của các lịch cũ.
--
--  THÀNH TIỀN = SUM(price * quantity), KHÔNG phải SUM(price).
--  Ba món cùng loại giá 40.000 là 120.000.
--
--  UNIQUE (booking_id, service_id): một lịch không có hai dòng cho cùng
--  một dịch vụ — muốn thêm ba món thì tăng quantity.
--
--  Luật thêm dịch vụ phát sinh:
--    Nhân viên : chỉ khi lịch đang PROCESSING
--    Quản trị  : CONFIRMED / PROCESSING / COMPLETED, nhưng payment
--                phải CHƯA PAID. Đã PAID thì khoá lại.
-- ============================================================================
DROP TABLE IF EXISTS `booking_addon`;
CREATE TABLE booking_addon (
    addon_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    service_name VARCHAR(150) NULL COMMENT 'Chụp tên lúc thêm, không đọc lại từ services',
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(12,2) NOT NULL COMMENT 'Đơn giá của MỘT món, lúc thêm',
    added_by_role ENUM('CUSTOMER','STAFF','ADMIN','SYSTEM') NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_booking_addon (booking_id, service_id),
    KEY idx_addon_service (service_id),
    CONSTRAINT fk_addon_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_addon_service FOREIGN KEY (service_id)
        REFERENCES services(service_id)
) ENGINE=InnoDB;

-- ============================================================================
--  12. BOOKING_IMAGE — ảnh khách gửi kèm lịch hẹn
-- ----------------------------------------------------------------------------
--  Khách gửi ảnh mẫu móng khi đặt lịch để nhân viên xem trước khi khách
--  tới cửa hàng.
-- ============================================================================
DROP TABLE IF EXISTS `booking_image`;
CREATE TABLE booking_image (
    image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_image_booking (booking_id),
    CONSTRAINT fk_image_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  13. BOOKING_EVENT — nhật ký thay đổi của một lịch hẹn
-- ----------------------------------------------------------------------------
--  Mọi thao tác trên lịch đều ghi một dòng ở đây, kể cả thao tác bị từ
--  chối thì không ghi — nhật ký chỉ ghi những gì đã thật sự xảy ra.
--
--  actor_name lấy từ token đăng nhập, không lấy từ request, nên không thể
--  giả danh người khác trong nhật ký.
-- ============================================================================
DROP TABLE IF EXISTS `booking_event`;
CREATE TABLE booking_event (
    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    event_type ENUM(
        'CREATED','CONFIRMED','RESCHEDULED','STAFF_CHANGED',
        'SERVICE_STARTED','SERVICE_COMPLETED','CANCELLED','NO_SHOW',
        'PAYMENT','ADDON_ADDED','ADDON_REMOVED','NOTE'
    ) NOT NULL,
    detail VARCHAR(500) NULL COMMENT 'Mô tả bằng tiếng Việt, hiện thẳng ra giao diện',
    actor_role ENUM('CUSTOMER','STAFF','ADMIN','SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    actor_name VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_event_booking (booking_id, created_at),
    CONSTRAINT fk_event_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  14. PAYMENT — thanh toán
-- ----------------------------------------------------------------------------
--  Tách khỏi booking vì trạng thái lịch và trạng thái tiền là hai thứ
--  khác nhau: lịch đã xong nhưng chưa thu tiền rất phổ biến.
--
--  Máy trạng thái (luật duy nhất ở src/lib/payment-state.js):
--      UNPAID ──► DEPOSITED ──► PAID
--         └──────────────────►
--
--    PAID không quay lại được: dự án chưa có nghiệp vụ hoàn tiền. Mở
--    đường đi ngược thì báo cáo doanh thu không bao giờ khớp thực tế.
--
--  booking_id UNIQUE: một lịch chỉ có một dòng thanh toán, nên không thể
--  có tình huống cộng tiền hai lần cho cùng một lịch.
--
--  DOANH THU CHỈ TÍNH payment_status = 'PAID'. Lịch COMPLETED mà UNPAID
--  thì doanh thu bằng 0.
-- ============================================================================
DROP TABLE IF EXISTS `payment`;
CREATE TABLE payment (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL
        COMMENT 'Số tiền đã thu. Với DEPOSITED là số tiền cọc, với PAID là tổng',
    payment_method ENUM('CASH','BANK_TRANSFER','ONLINE') NULL,
    payment_status ENUM('UNPAID','DEPOSITED','PAID') NOT NULL DEFAULT 'UNPAID',
    payment_date DATETIME NULL COMMENT 'Mốc thời gian nhận tiền',

    UNIQUE KEY uq_payment_booking (booking_id),
    KEY idx_payment_status (payment_status),
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  15. REVIEW — đánh giá lịch hẹn
-- ----------------------------------------------------------------------------
--  Chỉ đánh giá được lịch đã COMPLETED, mỗi lịch một lần (UNIQUE booking_id).
--  Không lưu staff_id / service_id: lấy từ booking là ra, tránh hai nơi
--  ghi khác nhau. README cũ mô tả có hai cột này — schema này cố tình bỏ,
--  vì suất ra luôn khớp.
-- ============================================================================
DROP TABLE IF EXISTS `review`;
CREATE TABLE review (
    review_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    rating INT NOT NULL COMMENT 'Từ 1 đến 5 sao',
    comment TEXT NULL,
    image VARCHAR(255) NULL COMMENT 'Ảnh cũ một ô, giữ lại để tương thích dữ liệu cũ',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_review_booking (booking_id),
    KEY idx_review_customer (customer_id),
    KEY idx_review_rating (rating),
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_review_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id)
) ENGINE=InnoDB;

-- ============================================================================
--  16. REVIEW_IMAGES — nhiều ảnh cho một đánh giá
-- ----------------------------------------------------------------------------
--  Bảng review chỉ có một cột image nên không đủ cho bài viết đánh giá có
--  nhiều ảnh.
-- ============================================================================
DROP TABLE IF EXISTS `review_images`;
CREATE TABLE review_images (
    review_image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    review_id BIGINT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_review_image (review_id),
    CONSTRAINT fk_review_image FOREIGN KEY (review_id)
        REFERENCES review(review_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  17. NHÓM ẢNH TRANG TRÍ (trang chủ)
-- ============================================================================
DROP TABLE IF EXISTS `service_images`;
CREATE TABLE service_images (
    image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,

    KEY idx_service_images (service_id),
    CONSTRAINT fk_service_images FOREIGN KEY (service_id)
        REFERENCES services(service_id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS `service_benefits`;
CREATE TABLE service_benefits (
    benefit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    subtitle VARCHAR(150) NULL,
    icon VARCHAR(50) NULL,
    color VARCHAR(20) NULL,
    sort_order INT NOT NULL DEFAULT 0,

    KEY idx_service_benefits (service_id),
    CONSTRAINT fk_service_benefits FOREIGN KEY (service_id)
        REFERENCES services(service_id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS `service_steps`;
CREATE TABLE service_steps (
    step_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL,
    step_number INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description VARCHAR(500) NULL,
    estimated_minutes INT NOT NULL DEFAULT 0,

    UNIQUE KEY uq_service_step (service_id, step_number),
    CONSTRAINT fk_service_steps FOREIGN KEY (service_id)
        REFERENCES services(service_id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS `nail_designs`;
CREATE TABLE nail_designs (
    design_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_name VARCHAR(150) NOT NULL,
    image VARCHAR(255) NOT NULL,
    category_id BIGINT NULL,
    is_trending TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_design_category (category_id),
    KEY idx_design_status (status),
    CONSTRAINT fk_design_category FOREIGN KEY (category_id)
        REFERENCES service_category(category_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS `promotions`;
CREATE TABLE promotions (
    promotion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(255) NULL,
    button_text VARCHAR(50) NOT NULL DEFAULT 'Đặt lịch ngay',
    image VARCHAR(255) NOT NULL,
    discount_percent DECIMAL(5,2) NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_promotion_status (status)
) ENGINE=InnoDB;

-- ============================================================================
--  18. STAFF_ATTENDANCE — chấm công thực tế (check-in / check-out)
-- ----------------------------------------------------------------------------
--  Một ngày một dòng. So với ca (staff_schedule) để biết đi muộn / về sớm.
--  Nghỉ đã duyệt (kể cả EMERGENCY) thì không check-in được.
-- ============================================================================
DROP TABLE IF EXISTS `staff_attendance`;
CREATE TABLE staff_attendance (
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

-- ============================================================================
--  DỮ LIỆU MẪU
-- ----------------------------------------------------------------------------
--  Mật khẩu tất cả tài khoản demo: 123456
--  Tài khoản quản trị: 0900000000 / Admin@2024
--
--  Đây chỉ là dữ liệu để chạy thử trên máy sinh viên. Trước khi triển khai
--  thật phải đổi toàn bộ mật khẩu này.
-- ============================================================================

INSERT INTO service_category (category_name, description) VALUES
  ('Sơn Gel', 'Dịch vụ sơn gel cao cấp'),
  ('Nail Art', 'Trang trí móng nghệ thuật'),
  ('Chăm sóc móng', 'Chăm sóc và phục hồi móng');

INSERT INTO services (category_id, service_name, description, price, duration, buffer_time) VALUES
  (1, 'Sơn Gel Cao Cấp', 'Sơn gel nhiều màu, bền màu tới 3 tuần', 200000, 60, 15),
  (2, 'Nail Art Nghệ Thuật', 'Vẽ móng nghệ thuật theo yêu cầu', 350000, 90, 15),
  (3, 'Chăm Sóc Móng', 'Chăm sóc móng cơ bản, cắt dũa móng', 150000, 45, 10);

-- Tài khoản quản trị (bcrypt của "Admin@2024")
INSERT INTO users (full_name, phone, email, password, role, status) VALUES
  ('Quản trị NailHouse', '0900000000', 'admin@nailhouse.vn',
   '$2b$10$tZtqdgg7HtiIebPU7wp1ieZES/CqjEfFDVQJqxs7YvJVZbQiaIYAu', 'ADMIN', 'ACTIVE');

-- Khách hàng mẫu (bcrypt của "123456")
INSERT INTO users (full_name, phone, email, password, role, status) VALUES
  ('Trần Thị Mai',  '0910000001', 'mai.tran@gmail.com',
   '$2b$10$u6jiigCfb6FxG15PV0PGIOMmdWDi74SrLrnOE78sQ8rrJMzsRJ94O', 'CUSTOMER', 'ACTIVE'),
  ('Nguyễn Thu Hà','0910000002', 'ha.nguyen@gmail.com',
   '$2b$10$u6jiigCfb6FxG15PV0PGIOMmdWDi74SrLrnOE78sQ8rrJMzsRJ94O', 'CUSTOMER', 'ACTIVE');

INSERT INTO customer (user_id)
SELECT u.user_id FROM users u
 WHERE u.email IN ('mai.tran@gmail.com', 'ha.nguyen@gmail.com');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
--  Sau khi chạy file này, chạy tiếp:
--      npm run db:migrate
--  để nạp các bảng còn lại của trang chủ và sinh ca làm việc, dữ liệu mẫu.
-- ============================================================================
-- END OF SCHEMA
