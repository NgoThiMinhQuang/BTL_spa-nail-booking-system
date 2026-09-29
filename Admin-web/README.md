# NailHouse — Không gian nhân viên (Admin web)

Giao diện cho nhân viên NailHouse, viết bằng **React 19 + TypeScript + Vite**.
Backend Express phục vụ bản build tĩnh tại `/staff`, cùng cổng với API.

## Chạy

### Phát triển (Vite dev server + backend)

```bash
# 1) backend (cổng 3000) — cần MySQL và file .env đúng
cd BE_Nail && npm start

# 2) giao diện (cổng 5173, tự proxy /api và /uploads sang 3000)
cd Admin-web && npm run dev
```

Mở `http://localhost:5173`.

### Chạy thật (Express phục vụ bản build)

```bash
cd Admin-web && npm run build     # tạo Admin-web/dist
cd ../BE_Nail && npm start        # mở http://localhost:3000/staff/
```

Kiểm tra kiểu dữ liệu: `npm run typecheck`.

## Cấu trúc mã nguồn

```
src/
  main.tsx                 điểm vào, chọn trang theo state.view
  store.tsx                trạng thái toàn cục (useReducer) + toàn bộ lệnh gọi API
  types.ts                 kiểu dữ liệu khớp 1-1 với response của API
  lib/
    utils.ts               money, fmtNum, longDate, safeImage, initials, downloadCsv
    customers.ts           lọc / sắp xếp / phân khúc / thống kê khách hàng
  hooks/
    usePager.ts            phân trang dùng chung (store ngoài React)
    useNavigation.ts       chuyển trang, mở lịch hẹn, lùi/kền khoảng thời gian
  components/
    Layout.tsx             sidebar, topbar, tiêu đề trang
    BookingTable.tsx       bảng lịch hẹn dùng chung (trang chủ + trang lịch)
    PageBar.tsx            thanh phân trang
    CustomerDrawer.tsx     drawer hồ sơ khách + hộp thoại ghi chú
    MiniCalendar.tsx       lịch tháng nhỏ
    Icon / Avatar / Stars / Primitives / SearchTools
  pages/
    HomePage, SchedulePage, BookingPage, CustomersPage, SimplePages
  styles/                  10 file CSS của bản cũ, thêm react-fixes.css
```

## Nguyên tắc

- **Một nơi gọi API.** `AppProvider` giữ đúng một vòng tải dữ liệu. Các hook khác
  chỉ đọc state — tránh gọi trùk khi nhiều component cùng dùng.
- **Một khoá trang cho mỗi danh sách.** `usePager(key, rows, size)` lưu trang trong
  `useSyncExternalStore` nên giữ được vị trí khi chuyển qua lại menu. Trang tự về 1
  khi đổi ngày, bộ lọc, tìm kiếm, nhân viên hoặc chế độ xem lịch.
- **Không lạm dụng effect.** Phần lớn logic là phép tính thuần trong render; chỉ
  `useEffect` dùng cho việc tải dữ liệu, khoá cuộn nền và bắt phím trong drawer.
- **CSS giữ nguyên.** 10 file CSS của bản vanilla được chuyển sang `src/styles` và
  nạp đúng thứ tự cũ (theme.css cuối cùng). `react-fixes.css` chứa phần bổ sung
  cho React: hộp thoại dạng `div`, và ẩn các lớp đã bị bỏ.

## Dữ liệu và chức năng

- Chọn nhân viên từ `/api/staff`; dashboard lấy từ
  `/api/staff-dashboard/:id?date=YYYY-MM-DD`. Chế độ tuần/tháng gọi thêm theo lô 4
  request đồng thời rồi gộp.
- Hồ sơ khách: `GET /api/staff/customers/:id?staffId=`. Lưu ghi chú nội bộ:
  `PUT /api/staff/customers/:id/note`.
- Trang chủ, lịch làm việc (ngày/tuần/tháng), khách hàng, dịch vụ và hồ sơ cá nhân
  đều có phân trang; chế độ tháng là lịch nên không phân trang.
- Hóa đơn chỉ hiện khi lịch hẹn đã `COMPLETED`, có CSS `@media print` riêng.
- Các nút cập nhật trạng thái lịch hẹn vẫn vô hiệu hóa vì chưa có API tương ứng.

## Lưu ý bảo mật

Đây là giao diện phát triển nội bộ, kế thừa backend **chưa có đăng nhập/phân quyền**.
Bộ chọn nhân viên không phải cơ chế xác thực. Cần bổ sung xác thực và kiểm tra quyền
theo tài khoản trước khi triển khai công khai, đặc biệt với API chứa thông tin khách hàng.

Font hệ thống đồng bộ với ứng dụng khách hàng (system-ui, Apple system, Segoe UI,
Roboto); không tải font từ Google Fonts. Hình ảnh lấy từ dữ liệu và thư mục uploads.

## Bản vanilla cũ

Mã nguồn HTML/CSS/JS trước khi chuyển sang React nằm ở thư mục `legacy/`.
Không còn được phục vụ; giữ lại để đối chiếu khi cần.
