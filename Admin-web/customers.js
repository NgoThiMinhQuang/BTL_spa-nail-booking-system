/* Trang Khách hàng của tôi: chỉ dùng dữ liệu thật từ API dashboard
   (tên, SĐT, avatar, số lượt đặt, lần gần nhất + lịch sử bookings).
   Bảng quản trị: STT thay mã KH, chữ trái - số phải, số động vi-VN. */
const CUSTOMER_PAGE_SIZE = 8;
const LOYAL_VISITS = 5;

function parseVnDate(value) {
  const parts = String(value || '').split('/');
  return parts.length === 3 ? `${parts[2]}${parts[1]}${parts[0]}` : '';
}

function customersFiltered() {
  const q = state.query.toLocaleLowerCase('vi');
  let rows = state.data.customers.filter((c) => `${c.name} ${c.phone}`.toLocaleLowerCase('vi').includes(q));
  if (state.customerFilter === 'loyal') rows = rows.filter((c) => Number(c.visits) >= LOYAL_VISITS);
  if (state.customerFilter === 'new') rows = rows.filter((c) => Number(c.visits) <= 1);
  const sort = state.customerSort || 'recent';
  return [...rows].sort((a, b) => {
    if (sort === 'visits') return Number(b.visits) - Number(a.visits);
    if (sort === 'name') return String(a.name).localeCompare(String(b.name), 'vi');
    return parseVnDate(b.lastVisit).localeCompare(parseVnDate(a.lastVisit));
  });
}

function customerBookings(customerId) {
  return state.data.bookings
    .filter((b) => String(b.customerId) === String(customerId))
    .sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)));
}

function exportCustomers() {
  const rows = customersFiltered();
  const lines = ['STT,Ten khach hang,So dien thoai,So lan dat,Lan gan nhat'];
  rows.forEach((c, i) => lines.push([i + 1, `"${String(c.name).replace(/"/g, '""')}"`, `'${c.phone}`, c.visits, c.lastVisit].join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `khach-hang-${state.date}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function customersPage() {
  const all = state.data.customers;
  const loyal = all.filter((c) => Number(c.visits) >= LOYAL_VISITS).length;
  const returning = all.filter((c) => Number(c.visits) > 1).length;
  const totalVisits = all.reduce((sum, c) => sum + Number(c.visits || 0), 0);
  const stats = [
    ['customers', 'Tổng khách hàng', all.length, 'trong danh sách của bạn'],
    ['done', 'Khách hàng thân thiết', loyal, `từ ${LOYAL_VISITS} lượt đặt trở lên`],
    ['schedule', 'Khách hàng quay lại', returning, 'đặt từ lần thứ 2'],
    ['play', 'Tổng lượt đặt', totalVisits, 'mọi lịch hẹn đã tạo'],
  ];
  const rows = customersFiltered();
  const pages = Math.max(1, Math.ceil(rows.length / CUSTOMER_PAGE_SIZE));
  if (!state.customerPage || state.customerPage > pages) state.customerPage = 1;
  const page = state.customerPage;
  const start = (page - 1) * CUSTOMER_PAGE_SIZE;
  const items = rows.slice(start, start + CUSTOMER_PAGE_SIZE);
  let selected = all.find((c) => String(c.id) === String(state.customerId));
  if (!selected) { selected = rows[0] || all[0] || null; state.customerId = selected ? selected.id : null; }
  const history = selected ? customerBookings(selected.id) : [];
  const email = history.find((b) => b.email)?.email || '';
  const isLoyal = selected && Number(selected.visits) >= LOYAL_VISITS;
  return `
  <div class="cust-stats">
    ${stats.map(([symbol, label, value, note]) => `<article class="cust-stat"><span class="cust-stat-icon">${icon(symbol)}</span><div><p>${label}</p><strong>${fmtNum(value)}</strong><small>${note}</small></div></article>`).join('')}
  </div>
  <div class="cust-layout">
    <section class="panel cust-list">
      <div class="section-heading"><div><h2>Danh sách khách hàng (${fmtNum(rows.length)})</h2></div><button class="button secondary cust-export" id="export-customers">⤓ &nbsp; Xuất danh sách</button></div>
      <div class="cust-tools">
        <label class="search"><span aria-hidden="true">⌕</span><input id="search" aria-label="Tìm khách hàng" placeholder="Tìm theo tên, số điện thoại…" value="${esc(state.query)}"></label>
        <select id="customer-filter" aria-label="Lọc khách hàng"><option value="">Tất cả</option><option value="loyal" ${state.customerFilter === 'loyal' ? 'selected' : ''}>Thân thiết</option><option value="new" ${state.customerFilter === 'new' ? 'selected' : ''}>Khách mới</option></select>
        <select id="customer-sort" aria-label="Sắp xếp khách hàng"><option value="recent" ${!state.customerSort || state.customerSort === 'recent' ? 'selected' : ''}>Sắp xếp: Mới nhất</option><option value="visits" ${state.customerSort === 'visits' ? 'selected' : ''}>Nhiều lượt nhất</option><option value="name" ${state.customerSort === 'name' ? 'selected' : ''}>Tên A–Z</option></select>
      </div>
      ${items.length ? `<div class="table-scroll"><table class="admin-table cust-table"><thead><tr><th class="col-stt">STT</th><th class="txt">Khách hàng</th><th class="txt">Số điện thoại</th><th class="num">Số lần đặt</th><th class="txt">Lần gần nhất</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>
        ${items.map((c, i) => `<tr class="${selected && String(c.id) === String(selected.id) ? 'is-selected' : ''}"><td class="col-stt num">${start + i + 1}</td><td class="txt"><div class="cust-person">${avatar(c.name, c.avatar)}<div><strong>${esc(c.name)}</strong>${Number(c.visits) >= LOYAL_VISITS ? '<small class="cust-loyal">Khách hàng thân thiết</small>' : ''}</div></div></td><td class="txt"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td><td class="num">${fmtNum(c.visits)} <small>lần</small></td><td class="txt">${esc(c.lastVisit)}</td><td><button class="view-button" data-customer="${esc(c.id)}" aria-label="Xem chi tiết ${esc(c.name)}">Xem</button></td></tr>`).join('')}
      </tbody></table></div>` : empty('Chưa có khách hàng', state.query || state.customerFilter ? 'Thử tìm kiếm khác hoặc chọn “Tất cả”.' : 'Khách hàng có lịch hẹn với bạn sẽ xuất hiện tại đây.')}
      ${pages > 1 ? `<div class="cust-pager"><button data-cpage="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Trang trước">‹</button>${Array.from({ length: pages }, (_, i) => `<button data-cpage="${i + 1}" class="${i + 1 === page ? 'active' : ''}" aria-label="Trang ${i + 1}" aria-current="${i + 1 === page ? 'page' : 'false'}">${i + 1}</button>`).join('')}<button data-cpage="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Trang sau">›</button></div>` : ''}
    </section>
    <aside class="panel cust-detail" aria-label="Thông tin khách hàng">
      ${selected ? `<div class="section-heading"><h2>Thông tin khách hàng</h2></div>
      <div class="cust-profile">${avatar(selected.name, selected.avatar, true)}<div><h3>${esc(selected.name)}</h3>${isLoyal ? '<span class="cust-loyal-badge">Khách hàng thân thiết</span>' : `<span class="cust-muted">${fmtNum(selected.visits)} lượt đặt lịch</span>`}</div></div>
      <div class="cust-contact"><a href="tel:${esc(selected.phone)}"><span>☎</span>${esc(selected.phone)}</a><span><b>✉</b>${esc(email || 'Chưa cập nhật email')}</span></div>
      <div class="cust-mini-stats"><div><strong>${fmtNum(selected.visits)}</strong><span>Lần đặt dịch vụ</span></div><div><strong>${fmtNum(history.length)}</strong><span>Lịch trong ngày xem</span></div></div>
      <div class="cust-history-head"><h3>Lịch sử đặt dịch vụ</h3><span>${fmtNum(history.length)} lịch hẹn</span></div>
      ${history.length ? `<div class="cust-history">${history.map((b) => `<button class="cust-history-row" data-booking="${b.id}"><time>${b.startsAt.slice(8, 10)}/${b.startsAt.slice(5, 7)}/${b.startsAt.slice(0, 4)}</time><span><b>${esc(b.serviceName)}</b><small>${b.startsAt.slice(11)}</small></span>${badge(b.status)}</button>`).join('')}</div>` : empty('Chưa có lịch sử', 'Lịch hẹn của khách trong ngày đang xem sẽ hiện ở đây.')}
      ${selected.phone ? `<a class="button call-button" href="tel:${esc(selected.phone)}">☎ &nbsp; Liên hệ khách hàng</a>` : ''}` : empty('Chưa có khách hàng', 'Chọn một khách hàng để xem thông tin chi tiết.')}
    </aside>
  </div>`;
}
