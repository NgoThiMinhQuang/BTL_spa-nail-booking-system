# 💅 Hệ thống đặt lịch và quản lý dịch vụ Nail

## 1. Giới thiệu đề tài

## Tên đề tài

**Xây dựng ứng dụng đặt lịch và quản lý dịch vụ Nail**

---

## Mô tả

Hệ thống được xây dựng nhằm số hóa quy trình đặt lịch và quản lý hoạt động kinh doanh của cửa hàng Nail.

Ứng dụng cho phép khách hàng đặt lịch sử dụng dịch vụ thông qua Mobile Application, đồng thời hỗ trợ cửa hàng quản lý dịch vụ, nhân viên, lịch làm việc, khách hàng và doanh thu thông qua Web Administration.

Hệ thống gồm hai nền tảng:

### 1. Mobile Application (Customer App)

Dành cho khách hàng:

- Đăng ký, đăng nhập tài khoản.
- Xem danh sách dịch vụ Nail.
- Xem thông tin nhân viên.
- Chọn thời gian đặt lịch.
- Theo dõi lịch hẹn.
- Thanh toán.
- Đánh giá dịch vụ.

---

### 2. Web Administration

Dành cho quản lý và nhân viên:

- Quản lý dịch vụ.
- Quản lý nhân viên.
- Quản lý lịch đặt.
- Phân công nhân viên.
- Quản lý khách hàng.
- Quản lý doanh thu.
- Theo dõi lịch làm việc.


---

# 2. Đối tượng sử dụng hệ thống

Hệ thống gồm 3 nhóm người dùng:

| Vai trò | Mô tả |
|---|---|
| Customer | Khách hàng đặt lịch và sử dụng dịch vụ |
| Staff | Nhân viên thực hiện dịch vụ Nail |
| Admin/Manager | Chủ cửa hàng quản lý toàn bộ hệ thống |


---

# 3. Quy trình nghiệp vụ tổng quan


```
Customer Mobile App

        |

Chọn dịch vụ + thời gian + nhân viên

        |

Hệ thống kiểm tra lịch trống

        |

Tạo Booking Pending

        |

Admin xác nhận / điều chỉnh

        |

Staff thực hiện dịch vụ

        |

Thanh toán

        |

Customer đánh giá
```


---

# 4. Nghiệp vụ Mobile Application (Khách hàng)


# 4.1. Quản lý tài khoản


## Đăng ký

Khách hàng tạo tài khoản bằng:

- Họ tên.
- Số điện thoại.
- Email.
- Mật khẩu.


Hệ thống:

- Kiểm tra dữ liệu hợp lệ.
- Kiểm tra tài khoản tồn tại.
- Tạo tài khoản mới.


---

## Đăng nhập

Khách hàng đăng nhập để sử dụng các chức năng:

- Xem dịch vụ.
- Đặt lịch.
- Theo dõi lịch sử.
- Đánh giá.


---

## Cập nhật thông tin cá nhân

Khách hàng có thể:

- Thay đổi họ tên.
- Cập nhật ảnh.
- Thay đổi số điện thoại.
- Đổi mật khẩu.


---

# 4.2. Xem danh sách dịch vụ Nail


Khách hàng có thể xem các dịch vụ cửa hàng cung cấp.


Thông tin dịch vụ:


| Thuộc tính | Mô tả |
|-|-|
| Service Name | Tên dịch vụ |
| Image | Hình ảnh |
| Description | Mô tả |
| Price | Giá tiền |
| Duration | Thời gian thực hiện |
| Category | Loại dịch vụ |


Ví dụ:


```
Dịch vụ:
Sơn Gel Cao Cấp

Giá:
200.000 VNĐ

Thời gian:
60 phút
```


---

# 4.3. Xem thông tin nhân viên


Khách hàng có thể xem danh sách nhân viên.


Thông tin:


- Họ tên.
- Ảnh đại diện.
- Kinh nghiệm.
- Chuyên môn.
- Đánh giá.


Ví dụ:


```
Nhân viên:

Nguyễn Lan

Chuyên môn:
Sơn gel, Nail Art

Kinh nghiệm:
3 năm

Rating:
4.8/5
```


---

# 4.4. Đặt lịch dịch vụ


## Mô tả

Khách hàng thực hiện đặt lịch thông qua Mobile App.


Quy trình:


```
Chọn dịch vụ

        ↓

Chọn nhân viên

        ↓

Chọn ngày giờ

        ↓

Kiểm tra lịch trống

        ↓

Xác nhận đặt lịch

        ↓

Tạo Booking
```


---

# 4.5. Lựa chọn nhân viên


Khách hàng có hai lựa chọn:


## Trường hợp 1: Chọn nhân viên cụ thể


Ví dụ:


```
Dịch vụ:
Sơn Gel

Nhân viên:
Lan

Thời gian:
09:00 20/09/2026
```


Hệ thống kiểm tra:

- Nhân viên có làm việc trong thời gian đó không.
- Có lịch đặt bị trùng không.


Nếu hợp lệ:

```
Booking Status = Pending
```


---

## Trường hợp 2: Chọn "Nhân viên bất kỳ"


Khách hàng không chọn nhân viên.


Hệ thống tự động:

- Tìm nhân viên phù hợp.
- Kiểm tra lịch trống.
- Ưu tiên nhân viên rảnh sớm nhất.


Sau đó tạo booking.


---

# 4.6. Kiểm tra lịch trống


Đây là nghiệp vụ quan trọng nhất của hệ thống.


## Công thức tính thời gian


```
End Time = Start Time + Service Duration
```


Ví dụ:


```
Dịch vụ:

Sơn gel

Duration:
60 phút


Khách đặt:

09:00


=> Chiếm slot:

09:00 - 10:00
```


---

## Quy tắc kiểm tra trùng lịch


Một nhân viên được phép nhận lịch mới khi:


```
Start_Time_Mới >= End_Time_Cũ

HOẶC

End_Time_Mới <= Start_Time_Cũ
```


Ngược lại:

```
Không cho phép đặt lịch
```


---

## Buffer Time


Để phù hợp thực tế, hệ thống hỗ trợ thời gian nghỉ/dọn dẹp.


Ví dụ:


```
Service Duration:
60 phút


Buffer:
15 phút


Tổng thời gian chiếm lịch:

75 phút
```


---

# 4.7. Quản lý lịch hẹn


Khách hàng có thể xem:


## Lịch sắp tới

Bao gồm:

- Dịch vụ.
- Nhân viên.
- Thời gian.
- Trạng thái.


## Lịch sử

Bao gồm:

- Hoàn thành.
- Đã hủy.
- Không đến.


---

# 4.8. Hủy lịch


Khách hàng có thể hủy lịch trước thời gian quy định.


Ví dụ:


```
Chỉ được hủy trước 2 giờ.
```


Nếu khách không đến:

```
Booking Status = No-show
```


---

# 4.9. Thanh toán


Hệ thống tách riêng:


## Booking Status


```
Pending

Confirmed

Processing

Completed

Cancelled

No-show
```


## Payment Status


```
Unpaid

Deposited

Paid
```


Ví dụ:


```
Booking:

Completed


Payment:

Unpaid
```


---

# 4.10. Đánh giá dịch vụ


Chỉ được đánh giá khi:


```
Booking Status = Completed
```


Khách hàng có thể:

- Chấm sao.
- Viết nhận xét.
- Upload hình ảnh.


---

# 5. Nghiệp vụ Web Administration


# 5.1. Phân quyền người dùng


## Admin


Có toàn quyền:


- Quản lý hệ thống.
- Xem doanh thu.
- Quản lý nhân viên.
- Quản lý dịch vụ.


---

## Staff


Nhân viên có quyền:


- Xem lịch làm việc cá nhân.
- Xem khách hàng của mình.
- Cập nhật trạng thái dịch vụ.


Không được:

- Xem doanh thu.
- Quản lý nhân viên khác.


---

# 5.2. Dashboard


Admin xem:


- Tổng số khách hàng.
- Lịch hôm nay.
- Doanh thu.
- Dịch vụ phổ biến.


---

# 5.3. Quản lý dịch vụ


Admin có thể:


## Thêm dịch vụ

Thông tin:

- Tên.
- Hình ảnh.
- Giá.
- Thời gian.
- Loại.


## Cập nhật dịch vụ


- Đổi giá.
- Đổi mô tả.
- Ẩn/hiện dịch vụ.


---

# 5.4. Quản lý nhân viên


Admin:


- Thêm nhân viên.
- Sửa thông tin.
- Xóa nhân viên.
- Gán chuyên môn.


Ví dụ:


```
Lan

Chuyên môn:

- Sơn gel
- Nail Art
```


---

# 5.5. Quản lý lịch đặt


Admin xem toàn bộ booking.


Thông tin:


| Field | Ý nghĩa |
|-|-|
| Customer | Khách hàng |
| Service | Dịch vụ |
| Staff | Nhân viên |
| Start Time | Thời gian bắt đầu |
| End Time | Thời gian kết thúc |
| Status | Trạng thái |


---

# 5.6. Duyệt và điều chỉnh lịch


Sau khi khách đặt:


Booking:


```
Pending
```


Admin có thể:


- Xác nhận.
- Đổi nhân viên.
- Đổi thời gian.
- Hủy lịch.


Ví dụ:


Khách chọn:

```
Lan
```


Nhưng Lan nghỉ.


Admin đổi:

```
Hoa
```


---

# 5.7. Tạo lịch thủ công (Walk-in Customer)


Hỗ trợ khách đến trực tiếp cửa hàng.


Admin có thể tạo booking:


Thông tin:


- Tên khách.
- Số điện thoại.
- Dịch vụ.
- Nhân viên.
- Thời gian.


Mục đích:


- Chiếm slot thời gian.
- Tránh khách App đặt trùng.


---

# 5.8. Staff quản lý lịch làm việc


Staff có thể:


- Xem lịch hôm nay.
- Xem khách hàng.
- Xem dịch vụ.


Cập nhật trạng thái:


```
Confirmed

      ↓

Processing

      ↓

Completed
```


---

# 5.9. Quản lý khách hàng


Admin xem:


- Danh sách khách hàng.
- Lịch sử sử dụng.
- Tổng chi tiêu.
- Số lần No-show.


---

# 5.10. Báo cáo doanh thu


Thống kê:


- Doanh thu ngày.
- Doanh thu tháng.
- Doanh thu năm.
- Dịch vụ phổ biến.


---

# 6. Database Schema


## Users


| Field | Description |
|-|-|
| id | User ID |
| name | Họ tên |
| phone | Số điện thoại |
| email | Email |
| password | Mật khẩu |
| role | Customer/Staff/Admin |


---

## Services


| Field | Description |
|-|-|
| id | Service ID |
| name | Tên dịch vụ |
| price | Giá |
| duration | Thời gian |
| buffer_time | Thời gian nghỉ |


---

## Staff


| Field | Description |
|-|-|
| id | Staff ID |
| user_id | User |
| specialty | Chuyên môn |


---

## Bookings


| Field | Description |
|-|-|
| id | Booking ID |
| customer_id | Khách hàng |
| staff_id | Nhân viên |
| service_id | Dịch vụ |
| start_time | Bắt đầu |
| end_time | Kết thúc |
| status | Booking Status |
| payment_status | Payment Status |
| note | Ghi chú |


---

# 7. Kiến trúc hệ thống


```
              Mobile App

             React Native

                  |

                API

                  |

             Backend Server

                  |

               Database

                  |

              Web Admin

             ReactJS/NextJS
```


---

# 8. Kết luận


Hệ thống "Ứng dụng đặt lịch và quản lý dịch vụ Nail" giúp cửa hàng Nail quản lý toàn bộ quy trình từ đặt lịch, phân công nhân viên, thực hiện dịch vụ đến thanh toán và đánh giá.

Ứng dụng đảm bảo phù hợp với mô hình vận hành thực tế của các tiệm Nail hiện nay, đồng thời phù hợp để triển khai trong môn học Lập trình Mobile đa nền tảng.
