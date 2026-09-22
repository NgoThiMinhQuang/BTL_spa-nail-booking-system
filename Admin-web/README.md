# NailHouse — Không gian nhân viên

Web dùng HTML/CSS/JavaScript và được Express phục vụ cùng API, không cần cài thêm thư viện hoặc cấu hình IP riêng.

## Chạy

Trong thư mục `Admin-web` hoặc `BE_Nail`, chạy `npm run dev`. Sau khi backend kết nối MySQL và sẵn sàng, trình duyệt tự mở giao diện nhân viên tại `http://localhost:3000/staff/` (hoặc cổng `PORT` trong `.env`). Trình duyệt chỉ tự mở một lần, không mở lại khi backend tự khởi động lại do sửa mã.
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

Font hệ thống đồng bộ với ứng dụng khách hàng (system-ui, Apple system, Segoe UI, Roboto); không tải font từ Google Fonts. Hình ảnh lấy từ dữ liệu và thư mục uploads hiện có.

## Trang lịch làm việc

## Chi tiết lịch hẹn

Nhấn nút xem lịch hẹn ở trang chủ hoặc lịch làm việc để mở trang chi tiết ba cột: khách hàng và dịch vụ, thông tin và tiến trình lịch hẹn, thao tác và lịch tiếp theo trong ngày. Dữ liệu lấy từ API dashboard, không tạo số liệu đánh giá hoặc mốc thời gian giả. Liên hệ khách hàng dùng `tel:`; các nút cập nhật lịch hẹn đang vô hiệu hóa vì chưa có API tương ứng. Bố cục chuyển xuống hai hoặc một cột trên màn hình nhỏ.

## Chế độ xem lịch

Mở `/staff/#schedule`. Có chế độ ngày, tuần (thứ Hai đến Chủ Nhật), tháng; tìm kiếm, lọc trạng thái và xem chi tiết. Các chế độ tuần/tháng tổng hợp dữ liệu từ API hiện có, tối đa 4 yêu cầu đồng thời. Thống kê theo khoảng thời gian được chọn. Khách sắp tới là lịch chưa thực hiện và chưa qua giờ hẹn trong khoảng đó. Trang hiện chỉ đọc trạng thái từ CSDL, không có thao tác thay đổi trạng thái.
