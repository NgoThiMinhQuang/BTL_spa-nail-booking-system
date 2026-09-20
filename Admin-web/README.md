# NailHouse — Không gian nhân viên

Web dùng HTML/CSS/JavaScript và được Express phục vụ cùng API, không cần cài thêm thư viện hoặc cấu hình IP riêng.

## Chạy

Trong thư mục `BE_Nail`, chạy `npm run dev`, sau đó mở `http://localhost:3000/staff/`.
MySQL cần hoạt động và cấu hình `BE_Nail/.env` phải đúng.

## Dữ liệu và chức năng

- Chọn nhân viên đang hoạt động từ `/api/staff`.
- Dashboard lấy dữ liệu từ `/api/staff-dashboard/:id?date=YYYY-MM-DD`.
- Lịch hẹn, ca làm 7 ngày, khách hàng, dịch vụ và hồ sơ truy vấn trực tiếp MySQL.
- Thống kê tính theo ngày đang chọn; không có dữ liệu thì hiển thị trạng thái trống.
- Tìm kiếm khách hàng/dịch vụ, lọc trạng thái, đổi ngày và xem chi tiết lịch hẹn.
- Nút liên hệ khách dùng `tel:`. Không thay đổi trạng thái hoặc ghi dữ liệu giả.
- Ngày và giờ lịch hẹn giữ nguyên giờ địa phương trong MySQL.

Đây là giao diện phát triển nội bộ, kế thừa backend hiện chưa có đăng nhập/phân quyền. Bộ chọn nhân viên không phải cơ chế xác thực. Cần bổ sung xác thực và kiểm tra quyền theo tài khoản trước khi triển khai công khai, đặc biệt với API chứa thông tin khách hàng. Chưa triển khai thao tác bắt đầu/hoàn thành lịch hẹn.

Font Google Fonts có dự phòng Arial/Georgia khi offline. Hình ảnh lấy từ dữ liệu và thư mục uploads hiện có.
