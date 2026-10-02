/* Kiểm tra nhanh các đường chính của API sau khi thêm lớp đăng nhập.
   Chạy: node scripts/smoke.mjs   (cần server đang chạy ở cổng 3000) */

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000';

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

const line = (label, ok, extra = '') =>
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`);

let failures = 0;
const expect = (label, ok, extra) => {
  line(label, ok, extra);
  if (!ok) failures += 1;
};

/* ---- 1. Truy cập khu quản trị không có token ---- */
const noToken = await call('/api/admin/overview');
expect('GET /api/admin/overview không token bị chặn (401)', noToken.status === 401,
  `-> ${noToken.status}`);

const noTokenCustomers = await call('/api/admin/customers');
expect('GET /api/admin/customers không token bị chặn (401)', noTokenCustomers.status === 401,
  `-> ${noTokenCustomers.status}`);

/* ---- 2. Đăng nhập sai mật khẩu ---- */
const badLogin = await call('/api/auth/login', {
  method: 'POST', body: { identifier: '0900000000', password: 'sai-mat-khau' },
});
expect('Login sai mật khẩu bị từ chối (401)', badLogin.status === 401, `-> ${badLogin.status}`);

/* ---- 3. Đăng nhập quản trị đúng ---- */
const adminLogin = await call('/api/auth/login', {
  method: 'POST', body: { identifier: '0900000000', password: 'Admin@2024' },
});
expect('Login quản trị thành công', adminLogin.status === 200, `-> ${adminLogin.status}`);
const adminToken = adminLogin.body?.data?.token;

/* ---- 4. Token khách không mở được khu quản trị ---- */
const customerLogin = await call('/api/auth/login', {
  method: 'POST', body: { identifier: '0910000001', password: '123456' },
});
expect('Login khách thành công', customerLogin.status === 200, `-> ${customerLogin.status}`);
const customerToken = customerLogin.body?.data?.token;

const customerPeek = await call('/api/admin/overview', { token: customerToken });
expect('Token CUSTOMER bị chặn khỏi /api/admin (403)', customerPeek.status === 403,
  `-> ${customerPeek.status}`);

/* ---- 5. Khách chỉ xem được lịch của chính mình ---- */
const myBookings = await call('/api/bookings', { token: customerToken });
expect('Khách xem được lịch của chính mình', myBookings.status === 200, `-> ${myBookings.status}`);
const leak = await call('/api/bookings?customerId=999', { token: customerToken });
const allSameCustomer = Array.isArray(leak.body?.data)
  && leak.body.data.every((b) => b.customerId === customerToken
    ? true : b.customerId === leak.body.data[0]?.customerId);
expect('customerId trong query bị bỏ qua — không xem được lịch người khác', allSameCustomer);

/* ---- 6. Nhân viên không chỉnh được khu quản trị ---- */
const staffLogin = await call('/api/auth/login', {
  method: 'POST', body: { identifier: '0901000002', password: '123456' },
});
expect('Login nhân viên thành công', staffLogin.status === 200, `-> ${staffLogin.status}`);
const staffToken = staffLogin.body?.data?.token;

const staffPeek = await call('/api/admin/overview', { token: staffToken });
expect('Token STAFF bị chặn khỏi /api/admin (403)', staffPeek.status === 403, `-> ${staffPeek.status}`);

/* ---- 7. Nhân viên không tạo được dịch vụ (quyền của Admin) ---- */
const staffCreateService = await call('/api/staff/services', {
  method: 'POST', token: staffToken,
  body: { name: 'Dịch vụ test', price: 1000, duration: 30 },
});
expect('Nhân viên không POST /api/staff/services (404 - đường đã bỏ)',
  staffCreateService.status === 404, `-> ${staffCreateService.status}`);

/* ---- 8. Bảng điều khiển nhân viên tự lấy danh tính ---- */
const dash = await call('/api/staff/dashboard', { token: staffToken });
expect('GET /api/staff/dashboard bằng token', dash.status === 200, `-> ${dash.status}`);

/* ---- 9. Máy trạng thái lịch chặn bước sai ---- */
const bookings = myBookings.body?.data ?? [];
const pending = bookings.find((b) => b.status === 'pending');
const completed = bookings.find((b) => b.status === 'completed');
if (pending && completed) {
  const badStep = await call(`/api/admin/bookings/${completed.id}`, {
    method: 'PATCH', token: adminToken, body: { status: 'CONFIRMED' },
  });
  expect('COMPLETED → CONFIRMED bị chặn (409)', badStep.status === 409, `-> ${badStep.status}`);
} else {
  console.log('BỎ QUA  không có lịch PENDING/COMPLETED để kiểm tra bước chuyển');
}

if (pending) {
  const crossCancel = await call(`/api/bookings/${pending.id}/cancel`, {
    method: 'PATCH', token: adminToken, body: { reason: 'test' },
  });
  expect('Admin không hủy được bằng API của khách (403)', crossCancel.status === 403,
    `-> ${crossCancel.status}`);
}

/* ---- 10. Khoảng giờ trùng ---- */
if (pending) {
  const clash = await call('/api/bookings', {
    method: 'POST', token: customerToken,
    body: {
      serviceId: pending.serviceId,
      staffId: pending.staffId,
      date: pending.startsAt.slice(0, 10),
      time: pending.startsAt.slice(11, 16),
    },
  });
  expect('Đặt lịch trùng khung giờ bị chặn (409)', clash.status === 409, `-> ${clash.status}`);
}

/* ---- 11. Danh mục dịch vụ quản lý bằng Admin ---- */
const catalog = await call('/api/admin/catalog/categories', { token: adminToken });
expect('Admin đọc được danh mục', catalog.status === 200, `-> ${catalog.status}`);

const staffCatalog = await call('/api/admin/catalog/categories', { token: staffToken });
expect('Nhân viên không đọc được API danh mục của Admin (403)', staffCatalog.status === 403,
  `-> ${staffCatalog.status}`);

/* ---- 12. Danh sách yêu cầu nghỉ ---- */
const leaves = await call('/api/admin/leave-requests', { token: adminToken });
expect('Admin xem được yêu cầu nghỉ', leaves.status === 200, `-> ${leaves.status}`);

const myLeaves = await call('/api/staff/leave-requests', { token: staffToken });
expect('Nhân viên xem được yêu cầu nghỉ của mình', myLeaves.status === 200, `-> ${myLeaves.status}`);

const customerLeaves = await call('/api/staff/leave-requests', { token: customerToken });
expect('Khách bị chặn khỏi API của nhân viên (403)', customerLeaves.status === 403,
  `-> ${customerLeaves.status}`);

console.log(failures ? `\n${failures} kiểm tra thất bại.` : '\nTất cả kiểm tra đều đạt.');
process.exit(failures ? 1 : 0);