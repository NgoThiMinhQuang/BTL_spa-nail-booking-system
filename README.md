# HỆ THỐNG ĐẶT LỊCH VÀ QUẢN LÝ DỊCH VỤ NAIL

# 1. GIỚI THIỆU ĐỀ TÀI

## 1.1. Tên đề tài

**Xây dựng ứng dụng đặt lịch và quản lý dịch vụ Nail**

## 1.2. Mô tả đề tài

Hệ thống được xây dựng nhằm số hóa quy trình đặt lịch và quản lý hoạt động của cửa hàng Nail.

Khách hàng sử dụng **Mobile Application** để xem dịch vụ, xem thông tin nhân viên, lựa chọn thời gian, đặt lịch, theo dõi lịch hẹn, thanh toán và đánh giá sau khi sử dụng dịch vụ.

Nhân viên và quản lý sử dụng **Web Administration** để quản lý lịch làm việc, tiếp nhận và xử lý lịch đặt, thực hiện dịch vụ, quản lý khách hàng, dịch vụ, thanh toán và doanh thu.

Hệ thống gồm hai nền tảng chính:

### Mobile Application

Đối tượng sử dụng:

- Customer.

Chức năng chính:

- Đăng ký.
- Đăng nhập.
- Quản lý thông tin cá nhân.
- Xem danh mục dịch vụ.
- Xem danh sách dịch vụ.
- Xem chi tiết dịch vụ.
- Xem thông tin nhân viên.
- Chọn nhân viên.
- Chọn ngày và giờ.
- Xem lịch trống.
- Đặt lịch.
- Gửi ghi chú và ảnh mẫu móng.
- Theo dõi lịch hẹn.
- Hủy lịch.
- Theo dõi thanh toán.
- Xem lịch sử sử dụng dịch vụ.
- Đánh giá dịch vụ và nhân viên.

### Web Administration

Đối tượng sử dụng:

- Staff.
- Admin/Manager.

Chức năng chính:

- Quản lý dịch vụ.
- Quản lý danh mục dịch vụ.
- Quản lý nhân viên.
- Quản lý chuyên môn nhân viên.
- Quản lý lịch làm việc.
- Quản lý ngày nghỉ.
- Quản lý Booking.
- Xác nhận hoặc điều chỉnh Booking.
- Phân công nhân viên.
- Tạo Booking cho khách Walk-in.
- Theo dõi quá trình thực hiện dịch vụ.
- Thêm dịch vụ phát sinh.
- Quản lý khách hàng.
- Quản lý thanh toán.
- Quản lý đánh giá.
- Theo dõi doanh thu.
- Xem báo cáo thống kê.

---

# 2. ACTOR CỦA HỆ THỐNG

Hệ thống gồm ba Actor chính.

## 2.1. Customer

Customer là khách hàng sử dụng Mobile Application.

Customer có thể:

- Đăng ký tài khoản.
- Đăng nhập.
- Cập nhật thông tin cá nhân.
- Xem Category.
- Xem Service.
- Xem Staff.
- Chọn Service.
- Chọn Staff.
- Chọn Date/Time.
- Kiểm tra lịch trống.
- Tạo Booking.
- Gửi ghi chú.
- Gửi ảnh mẫu móng.
- Xem Booking.
- Hủy Booking.
- Theo dõi thanh toán.
- Xem lịch sử.
- Đánh giá sau khi hoàn thành dịch vụ.

## 2.2. Staff

Staff là nhân viên thực hiện dịch vụ Nail.

Staff sử dụng Web Administration và chỉ được truy cập các chức năng liên quan đến công việc của mình.

Staff có thể:

- Đăng nhập.
- Xem lịch làm việc cá nhân.
- Xem Booking được phân công.
- Xem thông tin Customer trong Booking.
- Xem Service cần thực hiện.
- Xem ghi chú của Customer.
- Xem ảnh mẫu móng Customer gửi.
- Bắt đầu thực hiện dịch vụ.
- Thêm Service/Add-on phát sinh.
- Hoàn thành dịch vụ.
- Gửi yêu cầu đăng ký/thay đổi ca làm việc.
- Gửi yêu cầu nghỉ.
- Xem trạng thái yêu cầu.
- Xem Rating cá nhân.
- Xem Feedback của Customer.
- Xem lịch sử các dịch vụ mình đã thực hiện.

Staff không được:

- Quản lý nhân viên khác.
- Quản lý tài khoản Admin.
- Thay đổi cấu hình hệ thống.
- Xem hoặc thay đổi toàn bộ doanh thu của cửa hàng.
- Tự ý thay đổi Booking không thuộc quyền xử lý của mình.
- Thêm, sửa, tạm ngưng hoặc gỡ dịch vụ — nhân viên chỉ **xem** danh sách
  dịch vụ mình phục vụ. Việc quản lý dịch vụ và định giá thuộc quyền Admin.
- Tự duyệt yêu cầu nghỉ hoặc yêu cầu lịch làm việc của chính mình.
- Xem hồ sơ khách hàng chưa từng có lịch với mình.

Lưu ý về phạm vi dữ liệu: Staff được xem khách hàng **trong những lịch mình
phục vụ**, không phải toàn bộ danh sách khách của cửa hàng. Cách này được
kiểm tra ở backend chứ không phụ thuộc giao diện có mở màn hình hay không.

## 2.3. Admin/Manager

Admin/Manager là người quản lý cửa hàng.

Admin có quyền:

- Quản lý Category.
- Quản lý Service.
- Quản lý Staff.
- Quản lý Customer.
- Quản lý Staff-Service.
- Quản lý Staff Schedule.
- Duyệt yêu cầu nghỉ.
- Quản lý Booking.
- Phân công Staff.
- Thay đổi thời gian Booking.
- Tạo Walk-in Booking.
- Quản lý Payment.
- Quản lý Review.
- Xem Dashboard.
- Xem Revenue Report.
- Quản lý toàn bộ hệ thống.

---

# 3. QUY TRÌNH NGHIỆP VỤ TỔNG QUAN

```text
Customer đăng nhập Mobile App
             ↓
        Xem Service
             ↓
        Chọn Service
             ↓
          Chọn ngày
             ↓
         Chọn Staff
       ↙              ↘
Specific Staff       Any Staff
       \              /
        ↓            ↓
         Chọn thời gian
                ↓
     Kiểm tra Availability
                ↓
      Nhập ghi chú / ảnh mẫu
                ↓
      Xác nhận thông tin
                ↓
 Backend kiểm tra Availability
          lần cuối
                ↓
       Tạo Booking
       Status = Pending
                ↓
         Admin xác nhận
                ↓
       Status = Confirmed
                ↓
     Staff xem Booking
                ↓
 Customer đến cửa hàng
                ↓
        Staff bắt đầu
                ↓
      Status = Processing
                ↓
 Có thể thêm Add-on Service
                ↓
        Staff hoàn thành
                ↓
      Status = Completed
                ↓
           Payment
                ↓
           Review
```

---

# 4. NGHIỆP VỤ CUSTOMER MOBILE APPLICATION

# 4.1. Đăng ký tài khoản

Customer đăng ký bằng:

- Họ tên.
- Số điện thoại.
- Email.
- Mật khẩu.

Hệ thống thực hiện:

- Kiểm tra dữ liệu hợp lệ.
- Kiểm tra email đã tồn tại hay chưa.
- Kiểm tra số điện thoại đã tồn tại hay chưa.
- Mã hóa mật khẩu.
- Tạo User.
- Gán Role = CUSTOMER.

---

# 4.2. Đăng nhập

Customer đăng nhập bằng số điện thoại hoặc email đã đăng ký.

Hệ thống kiểm tra mật khẩu, rồi trả về **token JWT** có thời hạn 12 giờ.
Ứng dụng lưu token và gửi kèm ở header `Authorization` của mọi yêu cầu
sau đó.

Tài khoản `INACTIVE` không đăng nhập được.

### Cách hệ thống biết yêu cầu của ai

Token chứa mã người dùng. Backend tra `users` để biết vai trò, `customer_id`
và `staff_id` tương ứng.

Điểm quan trọng: **id người dùng không bao giờ được nhận từ request**. Không
có `customerId` hay `staffId` trong URL hay body. Nếu nhận từ request thì chỉ
cần đổi con số là xem hoặc sửa được dữ liệu của người khác — đây chính là
lỗ hổng mà hệ thống này đã chặn.

### Ba tài khoản, ba quyền

| Tài khoản | Đăng nhập được | Không đăng nhập được |
| --------- | -------------- | ------------------- |
| CUSTOMER | Xem và đặt lịch của chính mình | Không vào được khu quản trị |
| STAFF | Lịch được phân công cho mình | Không thấy doanh thu, khách ngoài phạm vi |
| ADMIN | Toàn bộ hệ thống | — |

Giao diện chỉ tự ẩn màn hình khi chưa đăng nhập. Việc kiểm tra quyền thật
luôn nằm ở server.

---

# 4.3. Quản lý thông tin cá nhân

Customer có thể:

- Xem thông tin cá nhân.
- Thay đổi họ tên.
- Cập nhật ảnh đại diện.
- Thay đổi số điện thoại.
- Đổi mật khẩu.

---

# 4.4. Xem Category

Service được phân thành các Category.

Ví dụ:

- Manicure.
- Pedicure.
- Sơn Gel.
- Nail Art.
- Chăm sóc móng.

Customer chỉ xem được Category đang:

```text
ACTIVE
```

---

# 4.5. Xem Service

Thông tin Service gồm:

- Name.
- Image.
- Description.
- Price.
- Duration.
- Buffer Time.
- Category.

Ví dụ:

```text
Service:
Sơn Gel Cao Cấp

Price:
200.000 VNĐ

Duration:
60 phút

Buffer:
15 phút
```

Customer chỉ được xem Service có trạng thái:

```text
ACTIVE
```

---

# 4.6. Xem Staff

Customer có thể xem:

- Họ tên.
- Ảnh.
- Kinh nghiệm.
- Chuyên môn.
- Những Service có thể thực hiện.
- Rating trung bình.

Ví dụ:

```text
Nguyễn Lan

Experience:
3 năm

Services:
- Sơn Gel
- Nail Art

Rating:
4.8 / 5
```

---

# 4.7. Quan hệ Staff và Service

Một Staff có thể thực hiện nhiều Service.

Một Service có thể được nhiều Staff thực hiện.

Đây là quan hệ Many-to-Many.

```text
StaffService
------------
id
staff_id
service_id
```

Khi Customer chọn một Service, hệ thống chỉ hiển thị những Staff có khả năng thực hiện Service đó.

---

# 4.8. Đặt lịch

Quy trình:

```text
Chọn Service
      ↓
Chọn ngày
      ↓
Chọn Staff
      ↓
Chọn Time
      ↓
Kiểm tra lịch trống
      ↓
Nhập Note
      ↓
Upload Reference Images nếu có
      ↓
Xem Booking Summary
      ↓
Confirm
      ↓
Tạo Booking
```

Booking Summary cần hiển thị:

- Service.
- Staff.
- Date.
- Start Time.
- Estimated End Time.
- Service Price.
- Duration.
- Note.

---

# 4.9. Chọn Staff cụ thể

Ví dụ:

```text
Service:
Sơn Gel

Staff:
Lan

Date:
30/09/2026

Start:
09:00
```

Hệ thống kiểm tra:

1. Lan có thực hiện được Service này hay không.
2. Lan có lịch làm việc ngày đó hay không.
3. Thời gian Customer chọn có nằm trong ca làm việc không.
4. Lan có nghỉ trong khoảng thời gian đó hay không.
5. Lan có Booking khác trùng thời gian không.

Nếu tất cả điều kiện hợp lệ thì Customer có thể tiếp tục đặt lịch.

---

# 4.10. Chọn Any Staff

Nếu Customer không quan tâm Staff cụ thể, Customer chọn:

```text
Any Staff
```

Hệ thống:

```text
Service
  ↓
Tìm Staff thực hiện được Service
  ↓
Kiểm tra Staff đang làm việc
  ↓
Loại Staff đang nghỉ
  ↓
Loại Staff đang bận Booking khác
  ↓
Danh sách Staff Available
```

Nếu nhiều Staff cùng Available, hệ thống có thể ưu tiên Staff có số lượng Booking trong ngày ít hơn.

Nếu không còn Staff:

```text
Selected time is unavailable.
```

Customer phải lựa chọn thời gian khác.

---

# 4.11. Availability

Availability là nghiệp vụ quan trọng nhất của Booking.

Hệ thống kiểm tra:

- Staff có đúng chuyên môn.
- Staff đang ACTIVE.
- Staff có lịch làm việc.
- Staff không nghỉ.
- Staff không có Booking trùng.
- Service có thời gian phù hợp với thời gian còn lại của ca làm.

---

# 4.12. Tính thời gian Booking

```text
End Time = Start Time + Service Duration
```

Ví dụ:

```text
Start:
09:00

Duration:
60 phút

End:
10:00
```

Nếu:

```text
Buffer Time = 15 phút
```

thì Staff thực tế bị chiếm lịch:

```text
09:00 → 10:15
```

Buffer dùng cho:

- Nghỉ.
- Dọn bàn.
- Chuẩn bị dụng cụ.
- Chuẩn bị cho Customer tiếp theo.

---

# 4.13. Kiểm tra trùng Booking

Hai Booking bị overlap khi:

```text
NewStart < ExistingEnd
AND
NewEnd > ExistingStart
```

Nếu đúng:

```text
Booking Conflict
```

Không cho tạo Booking.

Không bị trùng nếu:

```text
NewStart >= ExistingEnd
```

hoặc:

```text
NewEnd <= ExistingStart
```

---

# 4.14. Chống Double Booking

Mobile App chỉ hiển thị Availability tại thời điểm truy vấn.

Ví dụ:

```text
Customer A:
09:00 Available

Customer B:
09:00 Available
```

Nếu cả hai cùng bấm Booking, Backend phải kiểm tra Availability lại trước khi lưu.

Chỉ Request đầu tiên hợp lệ được tạo Booking.

Request còn lại nhận:

```text
This time slot is no longer available.
```

---

# 4.15. Ghi chú và ảnh mẫu móng

Customer có thể gửi:

- Ghi chú.
- Một hoặc nhiều hình ảnh tham khảo.

Ví dụ:

```text
Note:
"Em muốn mẫu giống ảnh nhưng đổi màu xanh thành màu đỏ."
```

Staff có thể xem thông tin này trên Web trước khi Customer đến.

Mục đích:

- Chuẩn bị màu.
- Chuẩn bị đá.
- Chuẩn bị charm.
- Chuẩn bị dụng cụ cần thiết.

---

# 4.16. Trạng thái Booking

Booking gồm các trạng thái:

```text
PENDING
CONFIRMED
PROCESSING
COMPLETED
CANCELLED
NO_SHOW
```

## PENDING

Customer vừa tạo Booking và chờ cửa hàng xác nhận.

## CONFIRMED

Booking đã được cửa hàng xác nhận.

## PROCESSING

Customer đã đến và Staff đang thực hiện dịch vụ.

## COMPLETED

Dịch vụ đã hoàn thành.

## CANCELLED

Booking đã bị hủy.

## NO_SHOW

Customer không đến theo lịch.

---

# 4.17. Luồng trạng thái Booking

Luồng thông thường:

```text
PENDING
   ↓
CONFIRMED
   ↓
PROCESSING
   ↓
COMPLETED
```

Hủy:

```text
PENDING
   ↓
CANCELLED
```

hoặc:

```text
CONFIRMED
   ↓
CANCELLED
```

Không đến:

```text
CONFIRMED
   ↓
NO_SHOW
```

---

# 4.18. Hủy Booking

Customer được phép hủy theo quy định.

Ví dụ:

```text
Chỉ được hủy trước giờ hẹn tối thiểu 2 giờ.
```

Quy tắc:

```text
PENDING
→ Có thể Cancel

CONFIRMED
→ Có thể Cancel nếu còn trên 2 giờ

PROCESSING
→ Không được Cancel

COMPLETED
→ Không được Cancel

CANCELLED
→ Không thay đổi

NO_SHOW
→ Không thay đổi
```

---

# 4.19. Xem Booking

Customer có hai khu vực:

## Upcoming Appointments

Hiển thị:

- Service.
- Staff.
- Date.
- Time.
- Price.
- Booking Status.
- Payment Status.

## History

Hiển thị:

- Completed.
- Cancelled.
- No-show.

---

# 5. NGHIỆP VỤ STAFF TRÊN WEB ADMINISTRATION

# 5.1. Staff đăng nhập

Staff sử dụng Web Administration.

Sau khi đăng nhập, hệ thống kiểm tra:

```text
Role = STAFF
```

và chỉ hiển thị những chức năng Staff được phép sử dụng.

---

# 5.2. Staff Dashboard

Staff có thể xem:

- Số Booking hôm nay.
- Booking tiếp theo.
- Booking đang Processing.
- Booking đã Completed.
- Lịch làm việc hôm nay.

---

# 5.3. Xem lịch làm việc

Staff có thể xem:

- Lịch hôm nay.
- Lịch theo ngày.
- Lịch theo tuần.

Thông tin:

- Date.
- Start Time.
- End Time.
- Booking.
- Customer.
- Service.

---

# 5.4. Xem Booking được phân công

Staff chỉ được xem những Booking được phân công cho mình.

Thông tin gồm:

- Customer Name.
- Phone.
- Service.
- Start Time.
- End Time.
- Note.
- Reference Images.
- Booking Status.

---

# 5.5. Xem ảnh mẫu móng

Staff có thể mở các Reference Images mà Customer đã gửi khi Booking.

Staff có thể dùng chúng để chuẩn bị:

- Sơn.
- Đá.
- Charm.
- Mẫu vẽ.
- Dụng cụ.

---

# 5.6. Bắt đầu thực hiện dịch vụ

Khi Customer đến và Staff bắt đầu làm:

```text
CONFIRMED
     ↓
PROCESSING
```

Staff không được Start một Booking:

- Cancelled.
- Completed.
- No-show.

---

# 5.7. Add-on Service

Trong quá trình làm, Customer có thể yêu cầu thêm dịch vụ.

Ví dụ:

```text
Sơn Gel                 200.000
Vẽ Nail Art 2 ngón       40.000
Đính đá                  30.000
Sửa móng gãy             20.000
```

Staff có thể thêm Add-on vào Booking.

Thông tin:

```text
BookingAddOn
------------
id
booking_id
service_id
name
quantity
unit_price
total_price
added_by
created_at
```

Tổng tiền:

```text
Final Amount
=
Original Booking Amount
+
Total Add-ons
```

Ví dụ:

```text
Original Service:
200.000

Add-on:
90.000

Final:
290.000 VNĐ
```

---

# 5.8. Hoàn thành dịch vụ

Sau khi hoàn thành:

```text
PROCESSING
     ↓
COMPLETED
```

Khi Booking đã Completed:

- Không được quay lại Pending.
- Không được Customer Cancel.
- Customer được phép Review.

---

# 5.9. Đăng ký lịch làm việc

Staff có thể gửi yêu cầu về lịch làm việc.

Ví dụ:

```text
Date:
01/10/2026

Start:
08:00

End:
17:00
```

Yêu cầu được gửi tới Admin.

Admin:

```text
APPROVE
hoặc
REJECT
```

Sau khi được APPROVED, Staff Schedule mới chính thức có hiệu lực.

---

# 5.10. Xin nghỉ

Staff có thể gửi Leave Request.

Thông tin:

```text
StaffLeaveRequest
-----------------
id
staff_id
start_datetime
end_datetime
reason
status
created_at
reviewed_by
reviewed_at
```

Status:

```text
PENDING
APPROVED
REJECTED
```

Luồng:

```text
Staff gửi Leave Request
          ↓
       PENDING
          ↓
      Admin kiểm tra
       ↙         ↘
 APPROVED      REJECTED
```

Nếu APPROVED:

Hệ thống block khoảng thời gian đó để Customer không thể tạo Booking mới cho Staff.

---

# 5.11. Xử lý xin nghỉ khi đã có Booking

Nếu Staff xin nghỉ trong khoảng thời gian đang có Booking:

Hệ thống phải cảnh báo Admin.

Ví dụ:

```text
This staff currently has 3 bookings
during the requested leave period.
```

Admin cần:

- Đổi Staff.
- Đổi giờ.
- Hoặc xử lý/hủy Booking.

Sau đó mới xác nhận Leave Request.

---

# 5.12. Xem Rating và Feedback

Staff có thể xem:

```text
Average Rating
Total Reviews
Review History
```

Ví dụ:

```text
Average:
4.8 / 5

★★★★★
"Làm rất đẹp và nhiệt tình."

★★★★☆
"Mẫu đẹp nhưng hơi lâu."
```

Staff chỉ được xem Review liên quan đến chính mình.

---

# 6. NGHIỆP VỤ ADMIN/MANAGER

# 6.1. Admin Dashboard

Dashboard có:

- Tổng Customer.
- Tổng Staff.
- Booking hôm nay.
- Pending Booking.
- Confirmed Booking.
- Processing Booking.
- Completed Booking.
- Cancelled Booking.
- No-show.
- Revenue hôm nay.
- Revenue tháng.
- Popular Services.

---

# 6.2. Quản lý Category

Admin có thể:

- Add Category.
- Edit Category.
- Activate.
- Deactivate.

Không nên xóa cứng Category nếu đã có Service sử dụng.

---

# 6.3. Quản lý Service

Admin có thể:

- Add Service.
- Edit Service.
- Upload Image.
- Edit Description.
- Edit Price.
- Edit Duration.
- Edit Buffer Time.
- Change Category.
- Activate/Deactivate.

Service đã từng xuất hiện trong Booking không nên bị xóa cứng.

Sử dụng:

```text
ACTIVE
INACTIVE
```

---

# 6.4. Quản lý Staff

Admin có thể:

- Thêm Staff.
- Sửa thông tin.
- Upload Avatar.
- Quản lý Experience.
- Activate/Deactivate Staff.
- Gán Service.
- Quản lý Schedule.
- Quản lý Leave Request.

Staff đã từng có Booking không nên bị xóa khỏi Database.

---

# 6.5. Quản lý Staff-Service

Admin xác định Staff nào có thể thực hiện Service nào.

Ví dụ:

```text
Lan
├── Sơn Gel
└── Nail Art

Hoa
├── Sơn Gel
└── Manicure
```

---

# 6.6. Quản lý Staff Schedule

Admin có thể:

- Tạo Schedule.
- Sửa Schedule.
- Duyệt Schedule Request.
- Theo dõi Schedule.
- Block khoảng thời gian nghỉ.

---

# 6.7. Duyệt Leave Request

Admin có thể:

```text
APPROVE
REJECT
```

Nếu Approve:

- Block Staff Availability.
- Không cho Booking mới.
- Kiểm tra Booking đang tồn tại.

---

# 6.8. Quản lý Booking

Admin xem toàn bộ Booking.

Thông tin:

```text
Booking ID
Customer
Service
Staff
Date
Start Time
End Time
Booking Status
Payment Status
Source
Total Amount
```

Admin có thể:

- Search.
- Filter.
- Confirm.
- Change Staff.
- Change Time.
- Cancel.
- Mark No-show.

---

# 6.9. Confirm Booking

Booking mới:

```text
PENDING
```

Admin xác nhận:

```text
CONFIRMED
```

Trước khi Confirm, hệ thống phải kiểm tra Availability.

---

# 6.10. Điều chỉnh Booking

Admin có thể:

- Change Staff.
- Change Date.
- Change Time.

Mỗi lần thay đổi Staff/Time:

```text
Check Availability Again
```

Nếu trùng:

Không cho phép Save.

---

# 6.11. Walk-in Customer

Khách có thể đến trực tiếp cửa hàng mà không Booking qua App.

Admin tạo Walk-in Booking.

Thông tin:

- Guest Name.
- Guest Phone.
- Service.
- Staff.
- Date.
- Time.
- Note.

Booking Source:

```text
WALK_IN
```

Mobile Booking:

```text
MOBILE
```

Nếu Walk-in Customer chưa có Account:

```text
customer_id = NULL
```

và lưu:

```text
guest_name
guest_phone
```

Walk-in Booking phải chiếm Staff Slot giống Booking Mobile.

---

# 6.12. Quản lý Customer

Admin xem:

- Customer List.
- Contact Information.
- Booking History.
- Completed Booking.
- Cancelled Booking.
- No-show Count.
- Total Spending.

---

# 6.13. Payment

Booking Status và Payment Status phải tách riêng.

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

Ví dụ hợp lệ:

```text
Booking Status:
COMPLETED

Payment Status:
UNPAID
```

---

# 6.14. Payment Method

Có thể hỗ trợ:

```text
CASH
BANK_TRANSFER
ONLINE
```

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

---

# 6.15. Review Management

Admin có thể xem:

- Customer.
- Staff.
- Service.
- Rating.
- Comment.
- Images.
- Created Date.

Review chỉ có thể được tạo khi:

```text
Booking Status = COMPLETED
```

Mỗi Booking chỉ có tối đa một Review.

---

# 6.16. Revenue Report

Admin xem:

- Daily Revenue.
- Weekly Revenue.
- Monthly Revenue.
- Yearly Revenue.
- Revenue by Service.
- Popular Service.

Revenue chỉ tính các Payment thực tế:

```text
Payment Status = PAID
```

---

# 7. SNAPSHOT DỮ LIỆU BOOKING

Booking không được phụ thuộc hoàn toàn vào dữ liệu hiện tại của Service.

Ví dụ:

Ngày Customer Booking:

```text
Sơn Gel
200.000 VNĐ
60 phút
```

Sau đó Admin thay đổi Service:

```text
250.000 VNĐ
75 phút
```

Booking cũ vẫn phải giữ:

```text
Price:
200.000

Duration:
60 phút
```

Do đó Booking phải lưu Snapshot:

```text
service_price
service_duration
buffer_time
```

---

# 8. DATABASE SCHEMA

Tên cột dưới đây là tên thật trong database. File
`BE_Nail/DB/Database.sql` là schema hoàn chỉnh — dựng một lần là đủ.

Bộ trạng thái dùng chung cho mọi đối tượng là `ACTIVE` / `INACTIVE`.

---

## 8.1. Users

```text
users
-----
user_id
full_name
phone             -- UNIQUE, kiêm luôn vai trò đăng nhập của khách
email             -- UNIQUE
password          -- bcrypt hash, KHÔNG bao giờ lưu dạng thô
avatar
role              -- CUSTOMER | STAFF | ADMIN
status            -- ACTIVE | INACTIVE
password_changed_at
created_at
updated_at
```

`status = 'INACTIVE'` nghĩa là khoá tài khoản: vẫn còn tên để các lịch hẹn
cũ đọc được, nhưng không đăng nhập được nữa.

---

## 8.2. Categories

```text
service_category
----------------
category_id
category_name
description
status            -- ACTIVE | INACTIVE
service_count     -- cache số dịch vụ thuộc danh mục
```

Khách chỉ thấy danh mục `ACTIVE`. Tắt một danh mục là ẩn luôn cả nhóm dịch
vụ của nó mà không cần sửa từng dịch vụ con.

Danh mục còn dịch vụ thì không xoá được — phải chuyển sang `INACTIVE`.

---

## 8.3. Services

```text
services
--------
service_id
category_id
service_name
description
image
price
duration          -- thời lượng thực hiện (phút)
buffer_time       -- khoảng nghỉ sau dịch vụ (phút)
status            -- ACTIVE | INACTIVE
```

Dịch vụ đã từng xuất hiện trong một lịch hẹn thì không xoá được — phải
chuyển sang `INACTIVE`, vì các lịch cũ vẫn cần đọc tên và giá.

Giá và thời lượng ở đây là giá **hiện tại** của danh mục. Lịch hẹn chụp lại
ba số này tại thời điểm khách đặt, nên đổi giá ở đây không làm thay đổi các
lịch cũ.

---

## 8.4. Staff

```text
staff
-----
staff_id
user_id          -- UNIQUE
experience_year
specialty
```

Bảng này **không có** cột `rating`. Điểm đánh giá nhân viên được tính trực
tiếp bằng `AVG(review.rating)`; lưu sẵn một cột cache dễ lệch khỏi thực tế
(và trước đây đã lệch thật: 4.2 trong bảng so với 4.8 tính từ đánh giá).

Trạng thái làm việc của nhân viên nằm ở `users.status`, không phải ở đây.

Nhân viên từng có lịch hẹn thì không xoá được — phải khoá tài khoản.

---
## 8.5. StaffService

```text
StaffService
------------
staff_id
service_id
```

Quan hệ nhiều-nhiều. Quyết định nhân viên nào nhận được lịch dịch vụ nào.

---

## 8.6. StaffSchedule

```text
StaffSchedule
-------------
id
staff_id
work_date
start_time
end_time
status      -- AVAILABLE | OFF
```

Ca làm việc **đã được duyệt**. Một ngày có tối đa một ca.

Ngày nghỉ không ghi ở đây mà ghi ở `StaffLeaveRequest` — ca OFF không cho
biết ai xin nghỉ, Admin duyệt lúc nào.

---

## 8.7. StaffLeaveRequest

```text
StaffLeaveRequest
-----------------
leave_request_id
staff_id
start_datetime
end_datetime
reason
status           -- PENDING | APPROVED | REJECTED
reviewed_by      -- users.user_id (quản trị duyệt)
reviewed_at
review_note
created_at
```

Nhân viên xin nghỉ → Admin duyệt hoặc từ chối. Chỉ khi `APPROVED` thì nhân
viên mới thật sự không nhận được lịch trong khoảng đó.

Ràng buộc: Admin chỉ duyệt được khi trong khoảng nghỉ không còn lịch nào
đang chạy. Nếu còn thì phải đổi nhân viên / đổi giờ / hủy lịch trước.

---

## 8.7b. StaffScheduleRequest

```text
StaffScheduleRequest
--------------------
schedule_request_id
staff_id
work_date
start_time
end_time
action           -- ADD | UPDATE | REMOVE
status           -- PENDING | APPROVED | REJECTED
reviewed_by
reviewed_at
review_note
created_at
```

Nhân viên xin thêm hoặc bỏ ca. **Chỉ khi Admin duyệt** thì bảng
`StaffSchedule` mới thay đổi.

---

## 8.8. Bookings

```text
Bookings
--------
booking_id

customer_id          -- NULL với khách chưa có tài khoản
guest_name           -- tên khách ngay trên lịch khi không có hồ sơ
guest_phone

staff_id
service_id

-- Chụp lại tại thời điểm đặt --
service_price
service_duration
buffer_time
actual_duration      -- thời lượng thực tế khi hoàn thành

start_time
end_time             -- = start_time + service_duration + buffer_time

status               -- xem máy trạng thái ở BR16
note                 -- ghi chú của khách

source               -- MOBILE | WALK_IN

cancel_reason
cancelled_at
cancelled_by         -- CUSTOMER | STAFF | ADMIN

created_at
```

### Về `payment_status`

Bảng `Booking` **không có** cột `payment_status`. Trạng thái thanh toán
nằm ở bảng `Payment`.

Lý do: một lịch có thể đã hoàn thành nhưng chưa thu tiền, hoặc đã đặt cọc
nhưng còn phần chưa trả. Gộp hai thứ đó vào một cột sẽ không diễn tả
được. Tách ra còn giúp luật "doanh thu chỉ tính lịch đã thu tiền" viết
được rõ ràng.

### Về ba cột chụp giá

`service_price`, `service_duration`, `buffer_time` chép lại lúc khách đặt.
Sau này Admin đổi giá hoặc thời lượng dịch vụ, các lịch cũ vẫn hiện đúng
số tiền và độ dài khách đã đặt.

Đổi giờ một lịch cũ cũng phải dùng ba số này, **không** đọc
`services.duration` hiện tại.

### Về `end_time`

```
end_time = start_time + service_duration + buffer_time
```

Nhân viên bị chiếm lịch tới cả khoảng nghỉ giữa hai lịch. Vì vậy hai lịch
liền nhau phải cách nhau ít nhất tổng buffer của lịch trước.

Khi hiển thị, hệ thống trả thêm `serviceEndsAt` (giờ dịch vụ kết thúc) bên
cạnh `endsAt` (giờ nhân viên rảnh lại) để phân biệt hai mốc này.

### Ràng buộc khách vãng lai

```text
customer_id IS NULL  →  guest_name và guest_phone bắt buộc có
customer_id IS NOT NULL → guest_name và guest_phone phải NULL
```

Khách chưa có tài khoản thì **không** tạo tài khoản, **không** tạo mật
khẩu. Tên và số điện thoại nằm ngay trên lịch.

---

## 8.9. BookingReferenceImages

Tên bảng thật trong database là `booking_image`.

```text
booking_image
-------------
image_id
booking_id
image_url
created_at
```

Ảnh mẫu móng khách gửi kèm lịch hẹn, để nhân viên xem trước khi khách tới.

---

## 8.10. BookingAddOns

Tên bảng thật trong database là `booking_addon`.

```text
booking_addon
-------------
addon_id
booking_id
service_id
service_name     -- chụp tên tại lúc thêm
quantity
price            -- đơn giá của MỘT món, chụp tại lúc thêm
added_by_role    -- CUSTOMER | STAFF | ADMIN | SYSTEM
created_at
```

**Thành tiền = `SUM(price * quantity)`, không phải `SUM(price)`.** Ba món
cùng loại giá 40.000 là 120.000.

Tên và đơn giá được chụp lại lúc thêm, nên sau này đổi tên hoặc đổi giá
dịch vụ thì hoá đơn của các lịch cũ không đổi theo.

Một lịch không có hai dòng cho cùng một dịch vụ — muốn thêm ba món thì
tăng `quantity`.

---

## 8.11. Payments

```text
payment
-------
payment_id
booking_id     -- UNIQUE: mỗi lịch chỉ có một dòng thanh toán
amount         -- số tiền đã thu; với DEPOSITED là số tiền cọc
payment_method -- CASH | BANK_TRANSFER | ONLINE
payment_status -- UNPAID | DEPOSITED | PAID
payment_date
```

### Máy trạng thái thanh toán

```text
UNPAID ──► DEPOSITED ──► PAID
   └────────────────────►
```

`PAID` không quay lại được. Dự án chưa có nghiệp vụ hoàn tiền; mở đường
đi ngược thì báo cáo doanh thu không bao giờ khớp thực tế.

---

## 8.12. Reviews

```text
review
------
review_id
booking_id     -- UNIQUE: mỗi lịch chỉ đánh giá một lần
customer_id
rating         -- 1..5
comment
image          -- ảnh cũ một ô
created_at
```

Bảng `review` **không** lưu `staff_id` và `service_id`. Lấy từ `booking`
là ra, tránh hai nơi ghi khác nhau.

Chỉ đánh giá được lịch đã `COMPLETED`.

---

## 8.13. ReviewImages

```text
review_images
-------------
review_image_id
review_id
image_url
created_at
```

Một đánh giá có nhiều ảnh.
# 9. QUAN HỆ DỮ LIỆU

```text
                    USER
             ┌────────┼────────┐
             │        │        │
         CUSTOMER    STAFF    ADMIN
             │        │
             │        ├── StaffService
             │        │       │
             │        │     Service
             │        │       │
             │        │    Category
             │        │
             │        ├── StaffSchedule
             │        │
             │        └── StaffLeaveRequest
             │
          BOOKING
             │
      ┌──────┼──────────┐
      │      │          │
    AddOn  Payment    Review
      │                 │
      │             ReviewImages
      │
ReferenceImages
```

---

# 10. BUSINESS RULES

## BR01

Customer phải đăng nhập mới được tạo Booking.

## BR02

Customer chỉ được Booking những Service đang ACTIVE.

## BR03

Staff phải ACTIVE.

## BR04

Staff phải được gán Service tương ứng mới được thực hiện Service đó.

## BR05

Staff phải có Schedule tại thời điểm Booking.

## BR06

Không cho Booking nếu Staff đang nghỉ.

## BR07

Một Staff không được có hai Booking trùng thời gian.

## BR08

Backend phải kiểm tra Availability lại khi Create Booking.

## BR09

Buffer Time phải được tính vào khoảng thời gian Staff bị chiếm lịch.

## BR10

Nếu Any Staff được lựa chọn, chỉ chọn Staff có đủ điều kiện thực hiện Service.

## BR11

Admin thay đổi Staff hoặc Time phải kiểm tra Availability lại.

## BR12

Walk-in Booking và Mobile Booking sử dụng cùng cơ chế kiểm tra lịch.

## BR13

Booking phải Snapshot Price, Duration và Buffer Time.

## BR14

Service đã có Booking không được xóa cứng.

## BR15

Staff đã có Booking không được xóa cứng.

## BR16

Customer chỉ được Review Booking COMPLETED.

## BR17

Một Booking chỉ có một Review.

## BR18

Customer không được Cancel Booking đang PROCESSING hoặc COMPLETED.

## BR19

Staff chỉ được thay đổi trạng thái Booking được phân công cho mình.

## BR20

Staff chỉ được:

```text
CONFIRMED → PROCESSING
```

và:

```text
PROCESSING → COMPLETED
```

## BR21

Add-on phải thuộc Booking đang PROCESSING hoặc được Admin cho phép chỉnh sửa trước khi thanh toán hoàn tất.

## BR22

Add-on phải được cộng vào Final Amount.

## BR23

Leave Request phải được Admin Approve mới ảnh hưởng Availability.

## BR24

Nếu Staff xin nghỉ trong thời gian đã có Booking, Admin phải xử lý các Booking đó trước.

## BR25

Revenue chỉ tính Payment đã PAID.

---

## BR26

Mọi thao tác trên Booking đều kiểm tra ở backend, không dựa vào việc
ẩn nút ở giao diện. Giao diện chỉ là tiện lợi cho người dùng, không phải
bảo mật.

## BR27

Customer chỉ được xem, hủy, đánh giá Booking của chính mình.

## BR28

Staff chỉ được xem Booking được phân công cho mình, và chỉ xem được hồ sơ
khách hàng đã từng có lịch với mình.

## BR29

Chỉ Admin được truy cập `/api/admin/*`. Token của Customer hoặc Staff bị từ
chối với HTTP 403.

## BR30

Tài khoản `INACTIVE` không được đăng nhập, kể cả khi token còn hạn.

## BR31

Mọi id người dùng đều lấy từ token đăng nhập, không lấy từ request. Không
thể giả danh người khác bằng cách đổi tham số trên URL hay trong body.

## BR32

Booking ở trạng thái kết thúc (COMPLETED, CANCELLED, NO_SHOW) là dữ liệu
lịch sử: không đổi trạng thái, không đổi nhân viên, không đổi giờ được nữa.

## BR33

Khi Admin xác nhận lịch (PENDING → CONFIRMED) phải kiểm tra lại khả dụng
ngay thời điểm xác nhận, vì giữa lúc khách đặt và lúc xác nhận nhân viên có
thể đã nhận việc khác.

## BR34

Đổi giờ một Booking cũ phải dùng thời lượng chụp trên chính Booking đó, không
đọc thời lượng hiện tại của dịch vụ.

## BR35

Thanh toán chỉ đi theo một chiều: UNPAID → DEPOSITED → PAID. Đã PAID thì
khoá, không cho thêm dịch vụ phát sinh nữa vì số tiền khách đã trả sẽ
không còn khớp.

## BR36

Số tiền phải thu = `service_price` chụp lúc đặt + `SUM(price × quantity)`
của dịch vụ phát sinh. Không lấy giá hiện tại của dịch vụ trong danh mục.

## BR37

Customer chỉ được hủy lịch `PENDING` bất cứ lúc nào. Lịch đã `CONFIRMED`
chỉ hủy được khi còn trên 2 giờ. Các trạng thái còn lại không hủy được.

---

# 11. USE CASE CUSTOMER

```text
Register
Login
Logout

View Profile
Update Profile
Change Password

View Categories
View Services
View Service Detail

View Staff
View Staff Rating

View Available Dates
View Available Time
Select Specific Staff
Select Any Staff

Create Booking
Upload Reference Images
Add Booking Note

View Upcoming Bookings
View Booking Detail
Cancel Booking
View Booking History

View Payment
Make Payment

Create Review
Upload Review Images
```

---

# 12. USE CASE STAFF

```text
Login
Logout

View Staff Dashboard
View Personal Schedule

View Assigned Bookings
View Booking Detail
View Customer Information
View Customer Note
View Reference Images

Start Service
Add Booking Add-on
Complete Service

Create Schedule Request
Create Leave Request
View Request Status

View Personal Rating
View Customer Feedback
View Service History
```

---

# 13. USE CASE ADMIN

```text
Login
Logout

View Dashboard

Manage Categories
Manage Services

Manage Staff
Manage Staff-Service

Manage Staff Schedule
Approve Schedule Request
Approve Leave Request

Manage Customers

Manage Bookings
Confirm Booking
Change Staff
Change Booking Time
Cancel Booking
Mark No-show

Create Walk-in Booking

Manage Payments
Manage Reviews

View Revenue Report
View Service Statistics
```

---

# 14. KIẾN TRÚC HỆ THỐNG

```text
            MOBILE APPLICATION
                Customer
                   │
                   │
                REST API
                   │
                   ↓
              BACKEND SERVER
                   │
                   ↓
                DATABASE
                   ↑
                   │
                REST API
                   │
                   │
          WEB ADMINISTRATION
             ┌─────┴─────┐
             │           │
           Staff       Admin
```

---

# 15. PHẠM VI MOBILE APPLICATION

Do đề tài thuộc môn:

**Lập trình Mobile đa nền tảng**

Mobile Application của Customer là thành phần trọng tâm.

Các màn hình chính:

```text
Splash
   ↓
Login / Register
   ↓
Home
   ↓
Category
   ↓
Service List
   ↓
Service Detail
   ↓
Staff Selection
   ↓
Date / Time Selection
   ↓
Booking Confirmation
   ↓
My Appointments
   ↓
Booking Detail
   ↓
Payment
   ↓
Review
   ↓
Profile
```

Web Administration đóng vai trò hỗ trợ vận hành cửa hàng.

---

# 16. PHẠM VI WEB ADMINISTRATION

Web có hai Role:

```text
STAFF
ADMIN
```

## Staff

Tập trung vào:

```text
My Schedule
My Bookings
Booking Detail
Customer Note
Reference Images
Processing Service
Add-on Service
Complete Service
Leave Request
Rating / Feedback
```

## Admin

Tập trung vào:

```text
Dashboard
Service
Category
Staff
Schedule
Bookings
Customers
Payments
Reviews
Revenue
```

---

# 17. NGHIỆP VỤ TRỌNG TÂM CỦA ĐỀ TÀI

Nghiệp vụ quan trọng nhất không phải CRUD Service hay Customer mà là:

## Booking & Staff Availability

Hệ thống cần giải quyết:

```text
Customer muốn đặt Service
          ↓
Staff nào làm được?
          ↓
Staff có đi làm không?
          ↓
Staff có nghỉ không?
          ↓
Staff có Booking khác không?
          ↓
Service mất bao lâu?
          ↓
Có Buffer bao nhiêu?
          ↓
Slot có đủ thời gian không?
          ↓
Available / Unavailable
```

Đây là nghiệp vụ trung tâm liên kết:

- Customer.
- Service.
- Staff.
- Schedule.
- Booking.
- Payment.
- Review.

---

# 18. KẾT LUẬN

Hệ thống **Đặt lịch và quản lý dịch vụ Nail** gồm Mobile Application dành cho Customer và Web Administration dành cho Staff và Admin/Manager.

Customer sử dụng Mobile App để tìm kiếm dịch vụ, lựa chọn Staff, kiểm tra lịch trống, đặt lịch, gửi mẫu móng, theo dõi Booking, thanh toán và Review.

Staff sử dụng Web Administration để theo dõi lịch làm việc, xem Booking được phân công, xem yêu cầu và mẫu móng của Customer, cập nhật trạng thái thực hiện, thêm dịch vụ phát sinh, gửi yêu cầu nghỉ và xem Feedback cá nhân.

Admin/Manager sử dụng Web Administration để quản lý toàn bộ Service, Staff, Customer, Schedule, Booking, Payment, Review và Revenue.

Nghiệp vụ trung tâm của hệ thống là **Booking và Staff Availability**, trong đó hệ thống phải đảm bảo:

- Staff có chuyên môn phù hợp.
- Staff đang làm việc.
- Staff không nghỉ.
- Không xảy ra trùng Booking.
- Buffer Time được tính chính xác.
- Không xảy ra Double Booking.
- Price và Duration được Snapshot.
- Walk-in và Mobile Booking sử dụng chung lịch.
- Add-on được cộng chính xác vào hóa đơn.
- Customer chỉ được Review sau khi hoàn thành dịch vụ.
- Revenue chỉ tính từ các khoản Payment thực tế đã thanh toán.

Thiết kế này giúp hệ thống có quy trình nghiệp vụ rõ ràng, đủ tính thực tế nhưng vẫn phù hợp với phạm vi một bài tập lớn môn **Lập trình Mobile đa nền tảng**.
