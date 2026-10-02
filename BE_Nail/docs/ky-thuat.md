# Ghi chú kỹ thuật

Tài liệu này ghi lại những quyết định kỹ thuật của dự án mà người đọc
mã nguồn khó tự suy ra. Phần nghiệp vụ nằm ở `README.md`.

---

## 1. Chạy dự án

```bash
# 1. Backend
cd BE_Nail
npm install
cp .env.example .env          # rồi sửa DB_PASSWORD và JWT_SECRET
npm run db:migrate            # nạp schema + dữ liệu mẫu
npm run dev                   # http://localhost:3000

# 2. Không gian nhân viên
cd Admin-web
npm install && npm run dev    # http://localhost:5173

# 3. Khu vực quản trị
cd AdminPanel-web
npm install && npm run dev    # http://localhost:5174

# 4. Ứng dụng khách (Expo)
cd MyApp
npm install && npm start
```

`JWT_SECRET` sinh bằng:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Mỗi máy một khoá khác nhau. File `.env` đã nằm trong `.gitignore`.

---

## 2. Tài khoản demo

| Vai trò   | Tài khoản      | Mật khẩu      | Vào ở đâu |
| --------- | -------------- | ------------- | --------- |
| Quản trị  | `0900000000`   | `Admin@2024`  | `/admin`  |
| Nhân viên | `0901000001`…`0901000005` | `123456` | `/staff`  |
| Khách     | `0910000001`, `0910000002` | `123456` | Ứng dụng Mobile |

Đổi mật khẩu trước khi triển khai thật.

---

## 3. Xác thực và phân quyền

Hệ thống có ba vai trò, mỗi tài khoản trong bảng `users` mang đúng một
vai trò.

**Nguyên tắc bất di bất dịch: mọi id người dùng đều lấy từ token, không
bao giờ lấy từ request.** Trước đây các API nhận thẳng `customerId` hoặc
`staffId` từ query và body — chỉ cần đổi con số là xem hoặc sửa được dữ
liệu của người khác. Nay:

- Khách đăng nhập → nhận token JWT → mọi lệnh gọi kèm
  `Authorization: Bearer <token>`.
- Backend tra `customer_id` / `staff_id` từ `users` theo token rồi mới xử lý.
- Tài khoản `INACTIVE` bị từ chối ngay cả khi token còn hạn.

### Các lớp bảo vệ

| Tầng | Nhiệm vụ |
| ---- | -------- |
| `src/lib/auth.js` | Mã hoá bcrypt, ký/kiểm tra JWT, `authenticate`, `authorizeRole` |
| `src/lib/booking-state.js` | Máy trạng thái lịch hẹn |
| `src/lib/payment-state.js` | Máy trạng thái thanh toán |
| `src/lib/staff-availability.js` | Khả dụng của nhân viên, khung giờ còn trống |
| `src/lib/booking-service.js` | Tạo lịch dùng chung, chống đặt trùng, chụp giá |

Router `/api/admin` gắn `authenticate` + `requireAdmin` ngay từ đầu, nên
thêm một route mới mà quên gắn middleware cũng không có đường nào lọt.

Giao diện chỉ tự ẩn màn hình khi chưa đăng nhập — đó là tiện lợi, không
phải bảo mật. Dữ liệu thì backend không chịu trả cho người sai vai trò.

---

## 4. Những lỗi đã sửa, và vì sao lỗi đó nguy hiểm

Ghi lại để không vô tình làm lại:

### So sánh thời gian lệch đơn vị

`freeSlotsForStaff` từng so một vế là timestamp Unix
(`new Date(row.startTime).getTime()`) với vế kia là `minute * 60000`. Hai
đại lượng khác nhau nên phần kiểm tra trùng lịch trả kết quả tuỳ tiện.
Nay mọi thứ quy về **phút tính từ 00:00** rồi mới so
`start < busy.to && end > busy.from`.

### Đường đi trạng thái không hợp lệ

Mỗi controller tự liệt kê trạng thái được phép, nên có những đường đi
sai mà không ai nhận ra: `PENDING → COMPLETED`, `PROCESSING → CANCELLED`,
`NO_SHOW → CONFIRMED`. Nay mọi API đổi trạng thái đều đi qua
`canTransition` ở `booking-state.js`.

### Dịch vụ phát sinh thiếu số lượng

`booking_addon` có cột `quantity` nhưng các truy vấn cộng `SUM(price)`.
Ba món cùng loại giá 40.000 ra 40.000 thay vì 120.000. Nay dùng
`SUM(price * quantity)`.

### Gỡ dịch vụ khỏi nhân viên bị đảo thành "xoá"

Logic cũ là `const removed = !(others && used)`. Khi còn nhân viên khác
dùng và đã có lịch tham chiếu thì ra `true` và hệ thống xoá hẳn dịch vụ
khỏi danh mục. Luật đúng: chỉ xoá khi **không còn ai dùng VÀ chưa từng có
lịch**.

### Doanh thu tính cả lịch chưa thu tiền

Báo cáo lấy `SUM(s.price)` của mọi lịch `COMPLETED`, nên lịch đã làm
xong mà khách chưa trả vẫn ra doanh thu. Nay chỉ tính lịch có
`payment.payment_status = 'PAID'`, và lấy giá chụp trên lịch chứ không lấy
giá hiện tại của dịch vụ.

### Migration tự đổi database

`001_home_content.sql` bắt đầu bằng `USE nail_management;`. Khi chạy test
trên database riêng, câu đó làm mọi câu lệnh sau đó ghi vào database
thật — không báo lỗi, chỉ thấy dữ liệu test "biến mất". Câu `USE` đã bị
xoá, và `scripts/migrate.js` giờ kiểm tra lại database sau mỗi file.

---

## 5. Vì sao có hai cột để lưu điểm và số tiền

`staff.rating`, `customer.total_spending`, `customer.no_show_count` từng là
cột cache nhưng không được cập nhật đúng lúc, nên chúng có thể cho số
khác với dữ liệu thật: `staff.rating = 4.2` trong khi trung bình đánh giá
là 4.8.

Quyết định: **không lưu**, mọi báo cáo tính trực tiếp từ `review` và
`payment`. Cột `staff.rating` đã bị bỏ khỏi schema.

---

## 6. Quy ước về `end_time`

```
end_time = start_time + service_duration + buffer_time
```

Tức là nhân viên bị chiếm lịch tới cả khoảng nghỉ giữa hai lịch. Khi hiển
thị, API trả thêm `serviceEndsAt` (trừ buffer) để phân biệt hai mốc:

| Mốc | Ý nghĩa |
| --- | --- |
| `serviceEndsAt` | Dịch vụ kết thúc, khách rải tay |
| `endsAt` | Nhân viên rảnh lại, nhận việc kế tiếp |

Lịch hẹn **chụp lại** `service_price`, `service_duration`, `buffer_time` tại
thời điểm đặt. Nhờ vậy sau này Admin đổi giá hoặc thời lượng dịch vụ, các
lịch cũ vẫn hiện đúng số tiền khách đã trả. Đổi giờ một lịch cũ cũng phải
dùng ba số trên, không đọc `services.duration` hiện tại.

---

## 7. Quy ước về xoá

Dữ liệu đã được lịch hẹn tham chiếu thì **không xoá cứng**:

| Đối tượng | Khi đã có lịch |
| ---------- | -------------- |
| Dịch vụ | Chuyển sang `INACTIVE` |
| Danh mục | Chuyển sang `INACTIVE` |
| Nhân viên | Khoá tài khoản (`users.status = 'INACTIVE'`) |
| Lịch hẹn, thanh toán, đánh giá | Giữ nguyên — dữ liệu lịch sử |

Bộ trạng thái dùng chung là `ACTIVE` / `INACTIVE`. Không dùng `HIDDEN`.

---

## 8. Kiểm thử

```bash
cd BE_Nail
npm test              # 39 test luật nghiệp vụ, dựng database riêng
npm start &           # rồi:
npm run smoke         # kiểm tra phân quyền qua HTTP
npm run smoke:booking # kiểm tra máy trạng thái, chụp giá, thanh toán
npm run db:demo-reset # xoá dữ liệu do script kiểm thử tạo
```

`npm test` dựng database `nail_management_test` riêng, không đụng dữ liệu
thật. Nếu muốn dựng lại từ đầu: `npm run db:rebuild` rồi
`npm run db:migrate`.

---

## 9. Nợ kỹ thuật

Những phần README mô tả nhưng chưa làm, ghi lại để không tính nhầm là đã
xong:

- Nút "Quên mật khẩu" chưa có gửi mail; hiện chỉ đổi mật khẩu được khi
  đã đăng nhập, hoặc quản trị đặt lại qua API nhân viên.
- Đăng nhập bằng Google/Apple trên ứng dụng chỉ là nút giao diện, chưa nối
  dịch vụ ngoài.
- Ảnh review trên ứng dụng nhận đường dẫn, chưa có bước chọn ảnh từ máy.
- Đổi mật khẩu chưa bắt buộc sau lần đăng nhập đầu tiên dù cột
  `users.password_changed_at` đã có sẵn để dùng.