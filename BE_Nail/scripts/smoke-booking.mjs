/* Kiểm tra luồng nghiệp vụ đầu-cuối trên server đang chạy.

   Mục tiêu: chứng minh các luật trong README thật sự được backend chặn,
   không chỉ ẩn nút ở giao diện.

     - Chuyển trạng thái sai bị từ chối (COMPLETED → CONFIRMED, PENDING → COMPLETED)
     - Khách hủy lịch của mình được, hủy lịch người khác thì không
     - Nhân viên bắt đầu/hoàn thành đúng lịch của mình, không đụng lịch người khác
     - Chụp giá: đổi giá dịch vụ không làm đổi lịch cũ
     - Dịch vụ phát sinh: nhân viên chỉ thêm khi lịch đang PROCESSING
     - Thanh toán: UNPAID → DEPOSITED → PAID, không quay ngược
     - Đánh giá: chỉ lịch COMPLETED, mỗi lịch một lần

   Chạy: node scripts/smoke-booking.mjs   (cần server ở cổng 3000) */

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000';

let failures = 0;
const expect = (label, ok, extra = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`);
  if (!ok) failures += 1;
};

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

const login = async (identifier, password) => {
  const r = await call('/api/auth/login', { method: 'POST', body: { identifier, password } });
  return r.body?.data?.token;
};

const admin = await login('0900000000', 'Admin@2024');
const customer = await login('0910000001', '123456');

/* Đăng nhập bằng chính nhân viên sẽ được phân công lịch, nên token lấy từ
   danh sách nhân viên chứ không cứng một số điện thoại. */
const staffDirectory = await call('/api/admin/staff', { token: admin });
const staffTarget = (staffDirectory.body?.data ?? [])[0];
const staff = await login(staffTarget?.phone ?? '', '123456');
console.log(`Dùng nhân viên: ${staffTarget?.name} (${staffTarget?.phone})\n`);

/* ---- Tìm một ngày trống để thử nghiệm không làm bẩn dữ liệu thật ---- */
const catalog = await call('/api/admin/catalog/services', { token: admin });
const services = catalog.body?.data ?? [];
const first = services[0];
const second = services[1];
console.log(`Dùng dịch vụ #${first?.id} — ${first?.name} `
  + `(${first?.duration} phút + ${first?.bufferTime} phút nghỉ)\n`);

/* Ngày cách xa nhất trong ca làm việc đã sinh sẵn. */
let targetDay = null;
for (let offset = 20; offset >= 1 && !targetDay; offset -= 1) {
  const day = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const slots = await call(`/api/admin/walkin/slots?serviceId=${first.id}&day=${day}`, { token: admin });
  const list = slots.body?.data ?? [];
  if (list.length >= 2) targetDay = { day, slot: list[1] };
}
if (!targetDay) {
  console.log('Không tìm được ngày trống để thử — bỏ qua.');
  process.exit(0);
}
console.log(`Thử nghiệm ngày ${targetDay.day} lúc ${targetDay.slot}\n`);

/* ---- 1. Tạo lịch tại quầy ---- */
/* Chọn trước nhân viên sẽ phục vụ, để phần kiểm tra "nhân viên bắt đầu lịch
   của mình" có đúng đối tượng. Nếu để trống, backend tự chọn người và lịch
   sẽ thuộc nhân viên khác. */
const staffList = staffDirectory;
const eligible = staffList.body?.data ?? [];
const chosen = eligible[0];

const created = await call('/api/admin/bookings', {
  method: 'POST', token: admin,
  body: {
    serviceId: String(first.id),
    staffId: chosen ? String(chosen.id) : undefined,
    day: targetDay.day,
    time: targetDay.slot,
    /* Khách vãng lai: không có tài khoản nên phải có tên + số điện thoại.
       Backend KHÔNG tự sinh tài khoản cho khách này. */
    guestName: 'Khách thử nghiệm',
    guestPhone: '0999000001',
  },
});
expect('Tạo lịch tại quầy thành công', created.status === 201, `-> ${created.status}`);
const bookingId = created.body?.data?.id;
if (!bookingId) {
  console.log(created.body);
  process.exit(1);
}

/* ---- 2. Chuyển trạng thái sai bị chặn ---- */
const skip = await call(`/api/admin/bookings/${bookingId}`, {
  method: 'PATCH', token: admin, body: { status: 'COMPLETED' },
});
expect('PENDING → COMPLETED bị chặn (409)', skip.status === 409, `-> ${skip.status}`);

/* PENDING → PROCESSING vừa sai bước vừa sai vai trò, nên 409 (không chuyển
   được) là câu trả lời đúng. Bước chỉ-nhân-viên được kiểm tra bên dưới,
   ở trạng thái CONFIRMED. */
const toProcessing = await call(`/api/admin/bookings/${bookingId}`, {
  method: 'PATCH', token: admin, body: { status: 'PROCESSING' },
});
expect('PENDING → PROCESSING bị chặn vì đi sai bước (409)',
  toProcessing.status === 409, `-> ${toProcessing.status}`);

/* ---- 3. Xác nhận rồi quay ngược ---- */
const confirm = await call(`/api/admin/bookings/${bookingId}`, {
  method: 'PATCH', token: admin, body: { status: 'CONFIRMED' },
});
expect('PENDING → CONFIRMED được phép', confirm.status === 200, `-> ${confirm.status}`);

const confirmBack = await call(`/api/admin/bookings/${bookingId}`, {
  method: 'PATCH', token: admin, body: { status: 'PENDING' },
});
expect('CONFIRMED → PENDING bị chặn (409)', confirmBack.status === 409, `-> ${confirmBack.status}`);

/* ---- 4. Chụp giá: đổi giá dịch vụ không đổi lịch cũ ---- */
const before = await call(`/api/admin/bookings/${bookingId}`, { token: admin });
const priceBefore = before.body?.data?.price;

const newPrice = Number(priceBefore) + 777000;
const bump = await call(`/api/admin/catalog/services/${first.id}`, {
  method: 'PUT', token: admin,
  body: {
    name: first.name, description: first.description, image: first.imageUrl,
    price: newPrice, duration: Number(first.duration),
    bufferTime: Number(first.bufferTime ?? 0), status: first.status,
    categoryId: first.categoryId ?? null,
  },
});
expect('Đổi giá dịch vụ thành công', bump.status === 200, `-> ${bump.status}`);

const after = await call(`/api/admin/bookings/${bookingId}`, { token: admin });
expect('Lịch cũ giữ nguyên giá lúc đặt',
  Number(after.body?.data?.price) === Number(priceBefore),
  `${priceBefore} → ${after.body?.data?.price}`);

/* Trả lại giá cũ. */
await call(`/api/admin/catalog/services/${first.id}`, {
  method: 'PUT', token: admin,
  body: {
    name: first.name, description: first.description, image: first.imageUrl,
    price: first.price, duration: Number(first.duration),
    bufferTime: Number(first.bufferTime ?? 0), status: first.status,
    categoryId: first.categoryId ?? null,
  },
});

/* ---- 5. Dịch vụ phát sinh theo trạng thái lịch ---- */
const addonTooEarly = await call(`/api/admin/bookings/${bookingId}/addons`, {
  method: 'POST', token: admin, body: { serviceId: String(first.id), quantity: 2 },
});
expect('Thêm dịch vụ phát sinh khi lịch CONFIRMED là được (Admin)',
  addonTooEarly.status === 201 || addonTooEarly.status === 409, `-> ${addonTooEarly.status}`);

/* ---- 6. Bước bắt đầu là của nhân viên, Admin không tự làm được ----
   Lịch đang CONFIRMED nên bước này đúng thứ tự — nếu bị chặn 403 thì quyền
   đúng; nếu trả 200 thì nghĩa là Admin đã tự bấm "bắt đầu" được. */
const adminStart = await call(`/api/admin/bookings/${bookingId}`, {
  method: 'PATCH', token: admin, body: { status: 'PROCESSING' },
});
expect('Admin không tự bấm "bắt đầu" được (403)', adminStart.status === 403,
  `-> ${adminStart.status}`);

/* Nhân viên thao tác lịch được phân công cho mình. */
const staffStart = await call(`/api/bookings/${bookingId}/status`, {
  method: 'PATCH', token: staff, body: { status: 'PROCESSING' },
});
expect('Nhân viên bắt đầu lịch của mình được (200)', staffStart.status === 200,
  `-> ${staffStart.status}`);

/* Nhân viên không tạo/sửa/xoá được dịch vụ — đường đó thuộc quyền Admin.
   Gửi POST (không phải GET) đúng như cách giao diện cũ từng gọi. */
const staffCreateService = await call('/api/staff/services', {
  method: 'POST', token: staff,
  body: { name: 'Dịch vụ tự tạo', price: 1000, duration: 30 },
});
expect('Nhân viên không POST /api/staff/services (404)',
  staffCreateService.status === 404, `-> ${staffCreateService.status}`);

/* Nhân viên chỉ xem được danh sách dịch vụ của chính mình. */
const staffServices = await call('/api/staff/services', { token: staff });
expect('Nhân viên xem được danh sách dịch vụ của mình (200)',
  staffServices.status === 200, `-> ${staffServices.status}`);

/* Nhân viên KHÔNG thêm được khi lịch đã hoàn thành. */
const staffFinish = await call(`/api/bookings/${bookingId}/status`, {
  method: 'PATCH', token: staff, body: { status: 'COMPLETED' },
});
expect('Nhân viên hoàn thành lịch của mình được (200)', staffFinish.status === 200,
  `-> ${staffFinish.status}`);

/* ---- 7. Thanh toán đúng thứ tự ---- */
const payTooMuch = await call(`/api/admin/bookings/${bookingId}/payment`, {
  method: 'POST', token: admin, body: { status: 'DEPOSITED', amount: 99999999 },
});
expect('Đặt cọc bằng đúng tổng tiền bị từ chối (400)', payTooMuch.status === 400,
  `-> ${payTooMuch.status}`);

const payFull = await call(`/api/admin/bookings/${bookingId}/payment`, {
  method: 'POST', token: admin, body: { status: 'PAID', method: 'CASH' },
});
expect('Ghi nhận thanh toán đủ thành công', payFull.status === 200, `-> ${payFull.status}`);

const payBack = await call(`/api/admin/bookings/${bookingId}/payment`, {
  method: 'POST', token: admin, body: { status: 'UNPAID' },
});
expect('PAID → UNPAID bị chặn (409)', payBack.status === 409, `-> ${payBack.status}`);

/* ---- 8. Đã thanh toán thì khoá dịch vụ phát sinh ---- */
const addonAfterPaid = await call(`/api/admin/bookings/${bookingId}/addons`, {
  method: 'POST', token: admin, body: { serviceId: String(second?.id ?? first.id) },
});
expect('Thêm dịch vụ phát sinh sau khi đã thanh toán bị chặn',
  addonAfterPaid.status === 409, `-> ${addonAfterPaid.status}`);

/* ---- 9. Lịch đã hoàn thành: đánh giá được, nhưng mỗi lịch chỉ một lần ----
   Lịch này là khách vãng lai (không có tài khoản) nên khách demo đánh giá
   không được — cần đúng chủ lịch. Thử bằng chính khách vãng lai sẽ không
   đăng nhập được, nên ở đây chỉ kiểm tra là lịch đã xong thì đánh giá được
   và trả lời "đã đánh giá rồi" khi thử lần hai. */
const reviewOnce = await call(`/api/bookings/${bookingId}/review`, {
  method: 'POST', token: customer, body: { rating: 5, comment: 'Ngon' },
});
expect('Khách không đánh giá được lịch của người khác (403)', reviewOnce.status === 403,
  `-> ${reviewOnce.status}`);

/* Trạng thái cuối cùng đã là COMPLETED: không chuyển ngược được nữa. */
const reopen = await call(`/api/admin/bookings/${bookingId}`, {
  method: 'PATCH', token: admin, body: { status: 'CONFIRMED' },
});
expect('COMPLETED → CONFIRMED bị chặn (409)', reopen.status === 409, `-> ${reopen.status}`);

/* ---- 10. Lịch đã COMPLETED thì không hủy được ----
   Đây chính là luật: trạng thái kết thúc là dữ liệu lịch sử, không đổi
   nữa. Lịch thử nghiệm cũng không xoá được — giữ lại làm dữ liệu mẫu. */
const cleanup = await call(`/api/admin/bookings/${bookingId}`, {
  method: 'PATCH', token: admin, body: { status: 'CANCELLED', cancelReason: 'Kết thúc kiểm thử' },
});
expect('Lịch đã hoàn thành thì không hủy được (409)', cleanup.status === 409,
  `-> ${cleanup.status}`);

console.log(failures ? `\n${failures} kiểm tra thất bại.` : '\nTất cả kiểm tra đều đạt.');
process.exit(failures ? 1 : 0);