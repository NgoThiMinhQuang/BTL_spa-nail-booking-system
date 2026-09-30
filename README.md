# 💅 HỆ THỐNG ĐẶT LỊCH VÀ QUẢN LÝ DỊCH VỤ NAIL

# 1. GIỚI THIỆU ĐỀ TÀI

## 1.1. Tên đề tài

**Xây dựng ứng dụng đặt lịch và quản lý dịch vụ Nail**

## 1.2. Mô tả

Hệ thống được xây dựng nhằm số hóa quy trình đặt lịch và quản lý hoạt động kinh doanh của cửa hàng Nail.

Ứng dụng cho phép khách hàng sử dụng ứng dụng Mobile để xem dịch vụ, lựa chọn nhân viên, lựa chọn thời gian phù hợp, đặt lịch, theo dõi lịch hẹn, thanh toán và đánh giá dịch vụ.

Bên cạnh đó, hệ thống cung cấp Web Administration giúp quản lý cửa hàng và nhân viên quản lý dịch vụ, lịch làm việc, booking, khách hàng, doanh thu và quá trình thực hiện dịch vụ.

Hệ thống gồm hai nền tảng chính:

### Mobile Application

Dành cho khách hàng.

Các chức năng chính:

- Đăng ký tài khoản.
- Đăng nhập.
- Quản lý thông tin cá nhân.
- Xem danh sách dịch vụ.
- Xem chi tiết dịch vụ.
- Xem thông tin nhân viên.
- Chọn nhân viên.
- Chọn ngày và giờ đặt lịch.
- Kiểm tra lịch trống.
- Đặt lịch dịch vụ.
- Theo dõi lịch hẹn.
- Hủy lịch.
- Thanh toán.
- Xem lịch sử sử dụng dịch vụ.
- Đánh giá dịch vụ.

### Web Administration

Dành cho Admin/Manager và Staff.

Các chức năng chính:

- Quản lý dịch vụ.
- Quản lý danh mục dịch vụ.
- Quản lý nhân viên.
- Quản lý chuyên môn của nhân viên.
- Quản lý lịch làm việc của nhân viên.
- Quản lý lịch đặt.
- Xác nhận hoặc điều chỉnh booking.
- Tạo booking cho khách trực tiếp tại cửa hàng.
- Theo dõi khách hàng.
- Theo dõi quá trình thực hiện dịch vụ.
- Quản lý thanh toán.
- Quản lý đánh giá.
- Theo dõi doanh thu.
- Xem báo cáo thống kê.

---

# 2. ĐỐI TƯỢNG SỬ DỤNG

Hệ thống có ba nhóm người dùng chính:

| Vai trò | Mô tả |
|---|---|
| Customer | Khách hàng sử dụng Mobile App để xem dịch vụ và đặt lịch |
| Staff | Nhân viên trực tiếp thực hiện dịch vụ Nail |
| Admin/Manager | Chủ cửa hàng hoặc quản lý, có quyền quản lý toàn bộ hệ thống |

---

# 3. QUY TRÌNH NGHIỆP VỤ TỔNG QUAN

Quy trình cơ bản:

```text
Customer đăng nhập Mobile App

        ↓

Xem và chọn dịch vụ

        ↓

Chọn ngày

        ↓

Chọn nhân viên
- Nhân viên cụ thể
hoặc
- Nhân viên bất kỳ

        ↓

Chọn thời gian

        ↓

Hệ thống kiểm tra lịch làm việc
và lịch trống của nhân viên

        ↓

Customer xác nhận đặt lịch

        ↓

Backend kiểm tra lại lịch lần cuối

        ↓

Tạo Booking
Status = Pending

        ↓

Admin xác nhận / điều chỉnh

        ↓

Booking
Status = Confirmed

        ↓

Customer đến cửa hàng

        ↓

Staff bắt đầu thực hiện dịch vụ

        ↓

Booking
Status = Processing

        ↓

Staff hoàn thành dịch vụ

        ↓

Booking
Status = Completed

        ↓

Thanh toán

        ↓

Customer đánh giá
```

---

# 4. NGHIỆP VỤ MOBILE APPLICATION

# 4.1. Quản lý tài khoản

## Đăng ký

Khách hàng có thể tạo tài khoản bằng các thông tin:

- Họ tên.
- Số điện thoại.
- Email.
- Mật khẩu.

Hệ thống thực hiện:

- Kiểm tra dữ liệu hợp lệ.
- Kiểm tra email hoặc số điện thoại đã tồn tại hay chưa.
- Mã hóa mật khẩu.
- Tạo tài khoản mới.
- Gán quyền Customer.

## Đăng nhập

Khách hàng đăng nhập bằng email/số điện thoại và mật khẩu.

Sau khi đăng nhập, khách hàng có thể:

- Xem dịch vụ.
- Xem nhân viên.
- Đặt lịch.
- Theo dõi lịch hẹn.
- Xem lịch sử.
- Thanh toán.
- Đánh giá.
- Quản lý hồ sơ cá nhân.

## Cập nhật thông tin cá nhân

Khách hàng có thể:

- Thay đổi họ tên.
- Cập nhật ảnh đại diện.
- Thay đổi số điện thoại.
- Đổi mật khẩu.

---

# 4.2. Xem danh mục dịch vụ

Hệ thống có thể phân loại dịch vụ thành các nhóm.

Ví dụ:

- Manicure.
- Pedicure.
- Sơn Gel.
- Nail Art.
- Chăm sóc móng.
- Dịch vụ khác.

Thông tin Category:

```text
Category
--------
id
name
description
status
```

Admin có thể:

- Thêm Category.
- Sửa Category.
- Ẩn/hiện Category.

---

# 4.3. Xem danh sách dịch vụ Nail

Khách hàng có thể xem danh sách dịch vụ mà cửa hàng cung cấp.

Thông tin mỗi dịch vụ gồm:

| Thuộc tính | Mô tả |
|---|---|
| Name | Tên dịch vụ |
| Image | Hình ảnh |
| Description | Mô tả |
| Price | Giá |
| Duration | Thời gian thực hiện |
| Buffer Time | Thời gian nghỉ/dọn dẹp |
| Category | Loại dịch vụ |
| Status | Trạng thái đang cung cấp hay tạm ẩn |

Ví dụ:

```text
Tên:
Sơn Gel Cao Cấp

Giá:
200.000 VNĐ

Thời gian:
60 phút

Buffer:
15 phút
```

Khách hàng chỉ nhìn thấy những dịch vụ đang được bật trạng thái hoạt động.

---

# 4.4. Xem thông tin nhân viên

Khách hàng có thể xem danh sách nhân viên.

Thông tin nhân viên gồm:

- Họ tên.
- Ảnh đại diện.
- Kinh nghiệm.
- Chuyên môn.
- Những dịch vụ có thể thực hiện.
- Điểm đánh giá trung bình.

Ví dụ:

```text
Nguyễn Lan

Chuyên môn:
- Sơn Gel
- Nail Art

Kinh nghiệm:
3 năm

Rating:
4.8/5
```

---

# 4.5. Quan hệ giữa Staff và Service

Một nhân viên có thể thực hiện nhiều dịch vụ.

Một dịch vụ cũng có thể được thực hiện bởi nhiều nhân viên.

Do đó Staff và Service có quan hệ Many-to-Many.

Sử dụng bảng:

```text
StaffService
------------
id
staff_id
service_id
```

Ví dụ:

```text
Lan -> Sơn Gel
Lan -> Nail Art
Hoa -> Sơn Gel
Hoa -> Manicure
```

Khi khách chọn dịch vụ, hệ thống chỉ hiển thị những nhân viên có khả năng thực hiện dịch vụ đó.

---

# 4.6. Lịch làm việc của nhân viên

Mỗi nhân viên có lịch làm việc riêng.

Hệ thống cần biết nhân viên có đang làm việc tại thời điểm khách muốn đặt hay không.

Thông tin lịch làm việc:

```text
StaffSchedule
-------------
id
staff_id
date
start_time
end_time
status
```

Ví dụ:

```text
Staff:
Nguyễn Lan

Ngày:
30/09/2026

Ca làm:
08:00 - 17:00

Status:
AVAILABLE
```

Ngoài ra có thể quản lý ngày nghỉ của nhân viên:

```text
StaffLeave
----------
id
staff_id
start_datetime
end_datetime
reason
```

Khi kiểm tra lịch, hệ thống phải kiểm tra:

1. Nhân viên có lịch làm việc vào ngày đó hay không.
2. Thời gian khách chọn có nằm trong ca làm việc không.
3. Nhân viên có đăng ký nghỉ trong thời gian đó không.
4. Có booking khác bị trùng không.

---

# 4.7. Đặt lịch dịch vụ

Khách hàng đặt lịch theo quy trình:

```text
Chọn Service

      ↓

Chọn ngày

      ↓

Chọn Staff

      ↓

Chọn giờ

      ↓

Kiểm tra Availability

      ↓

Xác nhận thông tin Booking

      ↓

Backend kiểm tra Availability lần cuối

      ↓

Tạo Booking
```

Thông tin xác nhận trước khi đặt:

```text
Service
Staff
Date
Start Time
End Time
Price
Duration
```

---

# 4.8. Lựa chọn nhân viên

Khách hàng có hai lựa chọn.

## Trường hợp 1: Chọn nhân viên cụ thể

Ví dụ:

```text
Dịch vụ:
Sơn Gel

Nhân viên:
Nguyễn Lan

Ngày:
30/09/2026

Thời gian:
09:00
```

Hệ thống kiểm tra:

- Lan có thể thực hiện dịch vụ Sơn Gel hay không.
- Lan có đi làm vào ngày đó hay không.
- 09:00 có nằm trong ca làm của Lan không.
- Lan có đang nghỉ phép không.
- Khoảng thời gian thực hiện có trùng với booking nào khác không.

Nếu hợp lệ:

```text
Booking Status = Pending
```

Nếu không hợp lệ:

Hệ thống thông báo slot không còn khả dụng và yêu cầu khách chọn thời gian khác.

---

## Trường hợp 2: Nhân viên bất kỳ

Khách hàng có thể chọn:

```text
Any Staff
```

Hệ thống thực hiện:

```text
Customer chọn Service
        ↓
Customer chọn Date + Time
        ↓
Tìm những Staff có thể thực hiện Service
        ↓
Kiểm tra Staff đang làm việc
        ↓
Loại Staff đang nghỉ
        ↓
Loại Staff bị trùng Booking
        ↓
Lấy danh sách Staff khả dụng
```

Nếu có nhiều Staff phù hợp:

Hệ thống ưu tiên nhân viên có số lượng booking trong ngày thấp hơn để phân bổ công việc cân bằng.

Nếu không còn Staff nào:

```text
Slot unavailable
```

Khách hàng phải chọn thời gian khác.

---

# 4.9. Kiểm tra lịch trống

Đây là một trong những nghiệp vụ quan trọng nhất của hệ thống.

Thời gian kết thúc dịch vụ:

```text
End Time = Start Time + Service Duration
```

Ví dụ:

```text
Service:
Sơn Gel

Duration:
60 phút

Start:
09:00

End:
10:00
```

Nếu có Buffer Time:

```text
Service Duration:
60 phút

Buffer:
15 phút

Total occupied time:
75 phút
```

Nhân viên sẽ bị chiếm lịch:

```text
09:00 - 10:15
```

---

# 4.10. Quy tắc kiểm tra trùng lịch

Một booking mới không được phép trùng với booking đang tồn tại của cùng một nhân viên.

Hai khoảng thời gian bị trùng nếu:

```text
NewStart < ExistingEnd
AND
NewEnd > ExistingStart
```

Nếu điều kiện trên đúng:

```text
Booking Conflict
```

Hệ thống không cho phép tạo booking.

Nếu:

```text
NewStart >= ExistingEnd
```

hoặc:

```text
NewEnd <= ExistingStart
```

thì booking không bị trùng.

---

# 4.11. Kiểm tra đồng thời khi nhiều khách đặt lịch

Việc hiển thị slot còn trống trên Mobile App không đảm bảo slot vẫn còn trống tại thời điểm khách bấm xác nhận.

Ví dụ:

```text
Customer A thấy 09:00 available.
Customer B cũng thấy 09:00 available.
```

Hai người cùng đặt.

Khi request tới Backend:

```text
Customer A -> 09:00
Customer B -> 09:00
```

Backend phải kiểm tra lại lịch một lần nữa trước khi tạo Booking.

Chỉ một Booking được phép thành công đối với cùng Staff và cùng khoảng thời gian.

Request còn lại phải nhận thông báo:

```text
Slot is no longer available.
```

Điều này giúp tránh double booking.

---

# 4.12. Trạng thái Booking

Booking có các trạng thái:

```text
Pending
Confirmed
Processing
Completed
Cancelled
No-show
```

Ý nghĩa:

### Pending

Khách vừa tạo booking và đang chờ cửa hàng xác nhận.

### Confirmed

Booking đã được cửa hàng xác nhận.

### Processing

Khách đã đến và Staff đang thực hiện dịch vụ.

### Completed

Dịch vụ đã hoàn thành.

### Cancelled

Booking đã bị hủy.

### No-show

Khách không đến theo lịch đã đặt.

---

# 4.13. Luồng trạng thái Booking

Luồng bình thường:

```text
Pending
   ↓
Confirmed
   ↓
Processing
   ↓
Completed
```

Luồng hủy:

```text
Pending
   ↓
Cancelled
```

hoặc:

```text
Confirmed
   ↓
Cancelled
```

Khách không đến:

```text
Confirmed
   ↓
No-show
```

Không cho phép:

```text
Completed -> Processing
Completed -> Pending
Cancelled -> Confirmed
No-show -> Processing
```

trừ trường hợp Admin có chức năng đặc biệt để xử lý dữ liệu sai.

---

# 4.14. Quản lý lịch hẹn

Khách hàng có thể xem hai nhóm lịch.

## Upcoming Bookings

Hiển thị:

- Dịch vụ.
- Nhân viên.
- Ngày.
- Thời gian.
- Giá.
- Trạng thái Booking.
- Trạng thái Payment.

## Booking History

Bao gồm:

- Completed.
- Cancelled.
- No-show.

---

# 4.15. Hủy lịch

Khách hàng có thể hủy booking theo quy định của cửa hàng.

Ví dụ:

```text
Chỉ được hủy trước giờ hẹn ít nhất 2 giờ.
```

Quy tắc:

```text
Pending
-> Có thể hủy

Confirmed
-> Có thể hủy nếu còn hơn 2 giờ

Processing
-> Không được hủy

Completed
-> Không được hủy

Cancelled
-> Không thay đổi

No-show
-> Không thay đổi
```

---

# 4.16. Giá và thời gian dịch vụ tại thời điểm Booking

Booking phải lưu lại giá và thời gian thực hiện tại thời điểm khách đặt.

Ví dụ:

Ngày 01/10:

```text
Sơn Gel
Price = 200.000
```

Khách tạo booking.

Ngày 05/10 Admin thay đổi:

```text
Price = 250.000
```

Booking cũ vẫn phải giữ:

```text
200.000
```

Do đó Booking cần lưu:

```text
service_price
service_duration
buffer_time
```

như dữ liệu snapshot tại thời điểm đặt.

---

# 4.17. Thanh toán

Booking Status và Payment Status phải được quản lý riêng.

## Booking Status

```text
Pending
Confirmed
Processing
Completed
Cancelled
No-show
```

## Payment Status

```text
Unpaid
Deposited
Paid
```

Ví dụ:

```text
Booking:
Completed

Payment:
Unpaid
```

trường hợp này vẫn hợp lệ vì khách đã hoàn thành dịch vụ nhưng chưa thanh toán.

---

# 4.18. Payment

Nếu hệ thống chỉ phục vụ mục đích demo môn học, có thể mô phỏng thanh toán.

Thông tin Payment:

```text
Payment
-------
id
booking_id
amount
payment_method
transaction_id
status
paid_at
created_at
```

Payment Method có thể gồm:

```text
CASH
BANK_TRANSFER
ONLINE
```

Payment Status:

```text
UNPAID
DEPOSITED
PAID
FAILED
```

---

# 4.19. Đánh giá dịch vụ

Khách hàng chỉ được đánh giá khi:

```text
Booking Status = Completed
```

Khách hàng có thể:

- Chấm sao từ 1 đến 5.
- Viết nhận xét.
- Upload hình ảnh.

Thông tin Review:

```text
Review
------
id
booking_id
customer_id
staff_id
service_id
rating
comment
image_url
created_at
```

Mỗi Booking chỉ được tạo một Review.

```text
booking_id = UNIQUE
```

---

# 5. NGHIỆP VỤ WEB ADMINISTRATION

# 5.1. Phân quyền

## Admin/Manager

Có quyền:

- Quản lý người dùng.
- Quản lý khách hàng.
- Quản lý Staff.
- Quản lý Service.
- Quản lý Category.
- Quản lý chuyên môn Staff.
- Quản lý lịch làm việc.
- Quản lý Booking.
- Điều chỉnh Booking.
- Tạo Booking thủ công.
- Quản lý Payment.
- Xem Revenue.
- Xem Dashboard.
- Quản lý Review.

## Staff

Staff có quyền:

- Xem lịch cá nhân.
- Xem booking được phân công.
- Xem thông tin khách trong booking.
- Xem dịch vụ cần thực hiện.
- Chuyển trạng thái từ Confirmed sang Processing.
- Chuyển trạng thái từ Processing sang Completed.

Staff không được:

- Xem toàn bộ doanh thu.
- Quản lý nhân viên khác.
- Thay đổi cấu hình hệ thống.
- Quản lý tài khoản Admin.

---

# 5.2. Dashboard

Admin có thể xem các thông tin tổng quan:

- Tổng số khách hàng.
- Tổng số nhân viên.
- Booking hôm nay.
- Booking đang Pending.
- Booking đang Processing.
- Booking Completed.
- Booking Cancelled.
- Booking No-show.
- Doanh thu ngày.
- Doanh thu tháng.
- Dịch vụ phổ biến.
- Nhân viên có nhiều booking.

---

# 5.3. Quản lý dịch vụ

Admin có thể:

## Thêm dịch vụ

Thông tin gồm:

- Tên.
- Category.
- Hình ảnh.
- Mô tả.
- Giá.
- Duration.
- Buffer Time.
- Status.

## Cập nhật dịch vụ

Admin có thể:

- Sửa tên.
- Đổi giá.
- Đổi mô tả.
- Đổi Duration.
- Đổi Buffer.
- Đổi Category.
- Ẩn/hiện Service.

Không nên xóa hoàn toàn Service đã từng xuất hiện trong Booking.

Nên sử dụng:

```text
ACTIVE
INACTIVE
```

để ẩn dịch vụ khỏi Mobile App nhưng vẫn giữ dữ liệu lịch sử.

---

# 5.4. Quản lý nhân viên

Admin có thể:

- Thêm nhân viên.
- Cập nhật thông tin.
- Upload ảnh.
- Cập nhật kinh nghiệm.
- Quản lý chuyên môn.
- Gán Service.
- Quản lý lịch làm việc.
- Quản lý ngày nghỉ.
- Khóa/ngưng hoạt động nhân viên.

Không nên xóa cứng Staff nếu nhân viên đã từng có Booking.

Nên sử dụng:

```text
ACTIVE
INACTIVE
```

---

# 5.5. Quản lý Staff-Service

Admin có thể xác định Staff nào thực hiện được Service nào.

Ví dụ:

```text
Lan:
- Sơn Gel
- Nail Art

Hoa:
- Sơn Gel
- Manicure
```

Thông tin được lưu trong:

```text
StaffService
```

---

# 5.6. Quản lý lịch làm việc Staff

Admin có thể:

- Tạo ca làm.
- Sửa ca làm.
- Xóa ca làm chưa phát sinh booking.
- Đăng ký ngày nghỉ.
- Theo dõi lịch của từng Staff.

Ví dụ:

```text
Staff:
Lan

Date:
30/09/2026

Working Time:
08:00 - 17:00
```

---

# 5.7. Quản lý Booking

Admin xem toàn bộ Booking.

Thông tin:

| Field | Ý nghĩa |
|---|---|
| Customer | Khách hàng |
| Service | Dịch vụ |
| Staff | Nhân viên |
| Start Time | Thời gian bắt đầu |
| End Time | Thời gian kết thúc |
| Price | Giá tại thời điểm đặt |
| Booking Status | Trạng thái booking |
| Payment Status | Trạng thái thanh toán |
| Source | Nguồn booking |

Admin có thể tìm kiếm theo:

- Customer.
- Staff.
- Service.
- Date.
- Booking Status.
- Payment Status.

---

# 5.8. Xác nhận và điều chỉnh Booking

Sau khi khách đặt:

```text
Booking Status = Pending
```

Admin có thể:

- Xác nhận.
- Đổi Staff.
- Đổi thời gian.
- Hủy Booking.

Ví dụ:

```text
Customer chọn:
Lan
```

nhưng Lan đột xuất nghỉ.

Admin có thể đổi:

```text
Hoa
```

Trước khi thay đổi Staff hoặc Time, hệ thống phải kiểm tra Availability lại.

---

# 5.9. Tạo Booking thủ công cho Walk-in Customer

Khách có thể tới cửa hàng trực tiếp mà không đặt qua Mobile App.

Admin có thể tạo Booking thủ công.

Thông tin:

- Tên khách.
- Số điện thoại.
- Service.
- Staff.
- Date.
- Time.
- Note.

Booking Source:

```text
WALK_IN
```

Booking từ Mobile App:

```text
MOBILE
```

Nếu khách Walk-in không có tài khoản:

```text
customer_id = NULL
```

và Booking lưu thêm:

```text
guest_name
guest_phone
```

Booking Walk-in vẫn phải chiếm slot giống booking từ Mobile App để tránh khách khác đặt trùng.

---

# 5.10. Staff quản lý công việc

Staff có thể xem:

- Lịch hôm nay.
- Booking tiếp theo.
- Customer.
- Service.
- Note.
- Thời gian thực hiện.

Luồng thực hiện:

```text
Confirmed
      ↓
Processing
      ↓
Completed
```

Khi bắt đầu làm:

```text
Status = Processing
```

Khi hoàn thành:

```text
Status = Completed
```

---

# 5.11. Quản lý khách hàng

Admin có thể xem:

- Danh sách Customer.
- Thông tin liên hệ.
- Lịch sử Booking.
- Tổng số Booking.
- Tổng số Booking Completed.
- Tổng số Cancelled.
- Tổng số No-show.
- Tổng chi tiêu.

---

# 5.12. Quản lý Review

Admin có thể xem:

- Customer.
- Service.
- Staff.
- Rating.
- Comment.
- Image.
- Created Date.

Điểm Rating của Staff có thể được tính từ trung bình các Review liên quan.

---

# 5.13. Báo cáo doanh thu

Hệ thống thống kê:

- Doanh thu ngày.
- Doanh thu tuần.
- Doanh thu tháng.
- Doanh thu năm.
- Doanh thu theo Service.
- Dịch vụ phổ biến.

Doanh thu chỉ nên được tính từ Payment:

```text
Status = PAID
```

Không tính booking:

```text
Cancelled
No-show
```

nếu không có khoản thanh toán thực tế.

---

# 6. DATABASE SCHEMA

## Users

```text
Users
-----
id
name
phone
email
password
avatar
role
status
created_at
updated_at
```

Role:

```text
CUSTOMER
STAFF
ADMIN
```

---

## Categories

```text
Categories
----------
id
name
description
status
created_at
updated_at
```

---

## Services

```text
Services
--------
id
category_id
name
description
image
price
duration
buffer_time
status
created_at
updated_at
```

---

## Staff

```text
Staff
-----
id
user_id
experience
description
status
created_at
updated_at
```

---

## StaffService

```text
StaffService
------------
id
staff_id
service_id
```

---

## StaffSchedule

```text
StaffSchedule
-------------
id
staff_id
date
start_time
end_time
status
```

---

## StaffLeave

```text
StaffLeave
----------
id
staff_id
start_datetime
end_datetime
reason
created_at
```

---

## Bookings

```text
Bookings
--------
id

customer_id
staff_id
service_id

guest_name
guest_phone

booking_source

start_time
end_time

service_price
service_duration
buffer_time

status
payment_status

note

created_at
updated_at
```

Booking Source:

```text
MOBILE
WALK_IN
```

Booking Status:

```text
PENDING
CONFIRMED
PROCESSING
COMPLETED
CANCELLED
NO_SHOW
```

Payment Status:

```text
UNPAID
DEPOSITED
PAID
```

---

## Payments

```text
Payments
--------
id
booking_id
amount
payment_method
transaction_id
status
paid_at
created_at
```

---

## Reviews

```text
Reviews
-------
id
booking_id
customer_id
staff_id
service_id
rating
comment
image_url
created_at
```

Mỗi Booking chỉ có tối đa một Review.

---

# 7. QUAN HỆ DATABASE

```text
User
 │
 ├──────── Customer
 │             │
 │             │
 │          Booking
 │             │
 │       ┌─────┴─────┐
 │       │           │
 │    Payment      Review
 │
 └──────── Staff
              │
              ├──────── StaffSchedule
              │
              ├──────── StaffLeave
              │
              └──────── StaffService
                            │
                            │
                         Service
                            │
                         Category
```

---

# 8. KIẾN TRÚC HỆ THỐNG

```text
              Mobile Application
               React Native
                     │
                     │
                  REST API
                     │
                     ↓
               Backend Server
                     │
                     ↓
                  Database
                     ↑
                     │
                  REST API
                     │
                     │
             Web Administration
                ReactJS
```

Mobile Application là thành phần chính phục vụ yêu cầu của môn Lập trình Mobile đa nền tảng.

Web Administration đóng vai trò hỗ trợ quản lý hệ thống.

---

# 9. CÁC BUSINESS RULE QUAN TRỌNG

## Rule 1

Một Staff chỉ được nhận Booking đối với Service mà Staff có khả năng thực hiện.

## Rule 2

Staff phải có lịch làm việc tại thời điểm Booking.

## Rule 3

Không được tạo Booking nếu Staff đang nghỉ.

## Rule 4

Không được tồn tại hai Booking bị overlap trên cùng một Staff.

## Rule 5

Backend phải kiểm tra Availability lại tại thời điểm tạo Booking.

## Rule 6

Duration và Price của Booking phải được snapshot tại thời điểm đặt.

## Rule 7

Customer chỉ được Review khi:

```text
Booking = COMPLETED
```

## Rule 8

Một Booking chỉ được Review một lần.

## Rule 9

Customer không được Cancel Booking khi:

```text
PROCESSING
COMPLETED
NO_SHOW
CANCELLED
```

## Rule 10

Booking Walk-in cũng phải chiếm lịch giống Booking từ Mobile App.

## Rule 11

Khi Admin đổi Staff hoặc Time của Booking, hệ thống phải kiểm tra Availability lại.

## Rule 12

Service hoặc Staff đã có dữ liệu lịch sử không nên bị xóa cứng.

Sử dụng:

```text
ACTIVE / INACTIVE
```

## Rule 13

Doanh thu được tính dựa trên các Payment thực tế đã thanh toán.

---

# 10. USE CASE CHÍNH

## Customer

```text
Register
Login
Update Profile
View Categories
View Services
View Service Detail
View Staff
View Available Schedule
Select Staff
Select Any Staff
Create Booking
View Upcoming Booking
View Booking History
Cancel Booking
Make Payment
Create Review
```

## Staff

```text
Login
View Personal Schedule
View Assigned Booking
View Customer Information
Start Service
Complete Service
```

## Admin

```text
Login
View Dashboard

Manage Categories
Manage Services

Manage Staff
Manage Staff-Service
Manage Staff Schedule
Manage Staff Leave

Manage Customers

Manage Bookings
Confirm Booking
Reschedule Booking
Change Staff
Cancel Booking
Create Walk-in Booking

Manage Payments
Manage Reviews

View Revenue Report
```

---

# 11. PHẠM VI ƯU TIÊN CHO BÀI TẬP LỚN

Do đây là đề tài môn **Lập trình Mobile đa nền tảng**, phần Mobile Application nên được ưu tiên.

Các chức năng Mobile quan trọng nhất:

```text
Authentication
      ↓
Home
      ↓
Service List
      ↓
Service Detail
      ↓
Staff Selection
      ↓
Calendar
      ↓
Available Time
      ↓
Booking
      ↓
My Bookings
      ↓
Payment
      ↓
Review
      ↓
Profile
```

Web Admin chỉ cần triển khai đủ các chức năng hỗ trợ:

```text
Dashboard
Services
Staff
Staff Schedule
Bookings
Customers
Payments
Revenue
```

Không cần phát triển Web Admin quá lớn để tránh vượt phạm vi môn học.

---

# 12. KẾT LUẬN

Hệ thống **Đặt lịch và quản lý dịch vụ Nail** giúp số hóa toàn bộ quy trình từ khách hàng tìm kiếm dịch vụ, lựa chọn nhân viên, lựa chọn thời gian, đặt lịch đến quá trình cửa hàng xác nhận lịch, nhân viên thực hiện dịch vụ, thanh toán và đánh giá.

Nghiệp vụ trung tâm của hệ thống là quản lý Booking và kiểm tra Availability của nhân viên.

Hệ thống phải đảm bảo:

- Không xảy ra trùng lịch.
- Chỉ phân công nhân viên có chuyên môn phù hợp.
- Nhân viên phải đang làm việc tại thời điểm đặt.
- Có thể xử lý cả khách đặt qua Mobile và khách Walk-in.
- Quản lý rõ Booking Status và Payment Status.
- Lưu được lịch sử giá và thời gian dịch vụ tại thời điểm khách đặt.
- Hỗ trợ đánh giá sau khi hoàn thành dịch vụ.
- Cung cấp Dashboard và báo cáo doanh thu cho Admin.

Với Mobile App dành cho Customer và Web Administration dành cho cửa hàng, hệ thống phù hợp với đề tài bài tập lớn môn **Lập trình Mobile đa nền tảng**, đồng thời có đủ nghiệp vụ thực tế để thể hiện các kiến thức về Mobile UI, REST API, Authentication, Database, Role-based Authorization và xử lý logic Booking.
