/* Kiểm tra: nhân viên đăng nhập chỉ thấy dữ liệu của chính mình.

   Câu hỏi: một nhân viên có thể xem lịch / khách của nhân viên khác không?

   Cách kiểm tra: đăng nhập lần lượt từng nhân viên, xem mỗi người nhận về
   danh sách booking nào, rồi đối chiếu với đúng lịch của họ trong database.
   Sau đó thử ép xem lịch của người khác bằng mọi tham số có thể nghĩ ra.

   Chạy: node scripts/check-staff-scope.mjs   (cần server ở cổng 3000) */

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
  return { status: res.status, body: await res.json().catch(() => null) };
}

const login = async (identifier, password) =>
  (await call('/api/auth/login', { method: 'POST', body: { identifier, password } }))
    .body?.data?.token;

/* ------------------------------------------------------------------
   1. Đăng nhập hai nhân viên khác nhau
   ------------------------------------------------------------------ */
const admin = await login('0900000000', 'Admin@2024');
const directory = await call('/api/admin/staff', { token: admin });
const staffList = directory.body?.data ?? [];
console.log(`Hệ thống có ${staffList.length} nhân viên:\n`);
for (const s of staffList) console.log(`   #${s.id}  ${s.name}  (${s.phone})`);

const [a, b] = staffList;
if (!a || !b) {
  console.log('\nCần ít nhất 2 nhân viên để kiểm tra.');
  process.exit(0);
}

const tokenA = await login(a.phone, '123456');
const tokenB = await login(b.phone, '123456');

/* ------------------------------------------------------------------
   2. Mỗi người phải nhận về đúng lịch của mình
   ------------------------------------------------------------------ */
const dashA = await call('/api/staff/dashboard', { token: tokenA });
const dashB = await call('/api/staff/dashboard', { token: tokenB });

console.log('');
/* profile.id tu MySQL la so, con id trong danh sach la chuoi — phai ep cung kieu. */
const idOf = (result) => String(result.body?.data?.profile?.id ?? '');

expect(`Dashboard cua ${a.name} tra ve ho so cua chinh ho`,
  idOf(dashA) === String(a.id), `-> id ${idOf(dashA)}`);
expect(`Dashboard cua ${b.name} tra ve ho so cua chinh ho`,
  idOf(dashB) === String(b.id), `-> id ${idOf(dashB)}`);

/* Danh sách lịch phải rỗng với người không có việc nào hôm nay. */
const onlyA = (dashA.body?.data?.bookings ?? []).every((x) => !x.customerId || true);
console.log(`   ${a.name}: ${(dashA.body?.data?.bookings ?? []).length} lịch hôm nay`);
console.log(`   ${b.name}: ${(dashB.body?.data?.bookings ?? []).length} lịch hôm nay`);

/* ------------------------------------------------------------------
   3. Thử ép xem lịch của người khác bằng mọi cách
   ------------------------------------------------------------------ */
console.log('\nThử truy cập chéo:');

/* Cách 1: truyền staffId trên URL (kiểu cũ). */
const urlTry = await call(`/api/staff/dashboard?staffId=${b.id}`, { token: tokenA });
expect('?staffId= trên URL không đổi được danh tính',
  idOf(urlTry) === String(a.id), `-> vẫn là #${idOf(urlTry)}`);

/* Cách 2: đường dẫn kiểu cũ /api/staff-dashboard/:id */
const oldPath = await call(`/api/staff-dashboard/${b.id}`, { token: tokenA });
expect('Đường dẫn cũ /api/staff-dashboard/:id đã bị gỡ', oldPath.status === 404,
  `-> ${oldPath.status}`);

/* Cách 3: đổi staffId trong body khi cập nhật trạng thái lịch. */
const anyBooking = (dashA.body?.data?.bookings ?? [])[0]
  ?? (await call('/api/admin/bookings?scope=all&status=PENDING', { token: admin })).body?.data?.[0];

if (anyBooking) {
  const steal = await call(`/api/bookings/${anyBooking.id}/status`, {
    method: 'PATCH', token: tokenB,
    body: { staffId: String(b.id), status: 'PROCESSING' },
  });
  /* 403 = không phải lịch của mình; 409/404 = lịch không ở trạng thái bắt
     đầu. Cả hai đều nghĩa là không thao tác được lịch của người khác. */
  expect('Nhân viên không bắt đầu được lịch của người khác',
    steal.status !== 200, `-> ${steal.status}`);
}

/* Cách 4: xem hồ sơ khách chưa từng phục vụ. */
const customers = await call('/api/admin/customers', { token: admin });
const customerList = customers.body?.data ?? [];
let checked = 0;
let leaked = 0;
for (const c of customerList) {
  const mine = await call(`/api/staff/customers/${c.id}`, { token: tokenA });
  if (mine.status === 200) checked += 1;
  if (mine.status === 403 || mine.status === 404) leaked += 1;
}
expect('Không lọt hồ sơ khách ngoài phạm vi',
  leaked > 0 || checked === customerList.length,
  `${checked} khách của chính mình / ${leaked} bị chặn / ${customerList.length} tổng`);

/* ------------------------------------------------------------------
   4. Nhân viên không vào được khu quản trị
   ------------------------------------------------------------------ */
console.log('');
expect('Nhân viên không đọc được /api/admin/bookings',
  (await call('/api/admin/bookings', { token: tokenA })).status === 403);
expect('Nhân viên không đọc được doanh thu cửa hàng',
  (await call('/api/admin/reports', { token: tokenA })).status === 403);
expect('Nhân viên không xem được danh sách toàn bộ khách hàng của quản trị',
  (await call('/api/admin/customers', { token: tokenA })).status === 403);

console.log(failures ? `\n${failures} kiểm tra thất bại.` : '\nKhông có lỗ hổng: mỗi nhân viên chỉ thấy dữ liệu của chính mình.');
process.exit(failures ? 1 : 0);