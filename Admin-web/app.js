const $ = (selector) => document.querySelector(selector);
const state = { view: 'home', date: localDate(), staffId: '', data: null, selected: null, query: '', status: '', request: 0 };
const labels = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến' };
const titles = { home: 'Trang chủ nhân viên', schedule: 'Lịch làm việc', customers: 'Khách hàng của tôi', services: 'Dịch vụ của tôi', profile: 'Hồ sơ cá nhân' };
function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function initials(name) { return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join(''); }
function safeImage(value) { return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/uploads\//.test(value)) ? esc(value) : ''; }
function avatar(name, url, large = false) { const src = safeImage(url); return `<span class="avatar ${large ? 'large' : ''}">${src ? `<img src="${src}" alt="" loading="lazy">` : esc(initials(name))}</span>`; }
function money(value) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value); }
function longDate(date) { return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function badge(status) { return `<span class="badge ${esc(status.toLowerCase())}"><i></i>${esc(labels[status] ?? status)}</span>`; }
function empty(title, detail) { return `<div class="empty"><span class="empty-icon">▦</span><h3>${title}</h3><p>${detail}</p></div>`; }
async function request(url) { const response = await fetch(url, { signal: AbortSignal.timeout(12000), cache: 'no-store' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Không thể tải dữ liệu.'); return payload.data; }
async function load() {
  const requestId = ++state.request;
  $('#content').setAttribute('aria-busy', 'true');
  $('#feedback').textContent = '';
  $('#refresh').disabled = true;
  $('#content').innerHTML = '<div class="loading">Đang tải dữ liệu công việc…</div>';
  try {
    const data = await request(`/api/staff-dashboard/${encodeURIComponent(state.staffId)}?date=${state.date}`);
    if (requestId !== state.request) return;
    state.data = data;
    if (!data.bookings.some((b) => String(b.id) === String(state.selected))) state.selected = data.bookings.find((b) => b.status === 'PROCESSING')?.id ?? data.bookings[0]?.id ?? null;
    $('#account-avatar').innerHTML = avatar(data.profile.name, data.profile.avatar);
    $('#sync-time').textContent = `Đã cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    render();
  } catch (error) {
    if (requestId !== state.request) return;
    state.data = null;
    $('#content').innerHTML = empty('Chưa tải được dữ liệu', 'Kiểm tra backend, sau đó nhấn “Làm mới dữ liệu” để thử lại.');
    $('#feedback').textContent = error.message;
  } finally { if (requestId === state.request) { $('#content').setAttribute('aria-busy', 'false'); $('#refresh').disabled = false; } }
}
function dateControls() { return `<div class="date-controls"><button class="icon-button" data-day="-1" aria-label="Ngày trước">‹</button><input type="date" id="work-date" aria-label="Ngày làm việc" value="${state.date}"><button class="icon-button" data-day="1" aria-label="Ngày sau">›</button><button class="text-button" data-today>Hôm nay</button></div>`; }
function customerCards(limit) { const rows = state.data.customers.filter((c) => `${c.name} ${c.phone}`.toLocaleLowerCase('vi').includes(state.query.toLocaleLowerCase('vi'))).slice(0, limit); return rows.length ? `<div class="customer-grid">${rows.map((c) => `<article class="customer-card">${avatar(c.name, c.avatar)}<h3>${esc(c.name)}</h3><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><span>${c.visits} lịch hẹn</span><small>Lịch gần nhất · ${esc(c.lastVisit)}</small></article>`).join('')}</div>` : empty('Chưa có khách hàng', 'Khách hàng có lịch hẹn với bạn sẽ xuất hiện tại đây.'); }
function serviceCards(limit) { const rows = state.data.services.filter((s) => s.name.toLocaleLowerCase('vi').includes(state.query.toLocaleLowerCase('vi'))).slice(0, limit); return rows.length ? `<div class="service-grid">${rows.map((s) => `<article class="service-card">${safeImage(s.image) ? `<img class="service-image" src="${safeImage(s.image)}" alt="${esc(s.name)}" loading="lazy">` : '<div class="service-image placeholder">✳</div>'}<div><small>${esc(s.category || 'Dịch vụ NailHouse')}</small><h3>${esc(s.name)}</h3><p>${esc(s.description || 'Chăm sóc tỉ mỉ bởi chuyên viên NailHouse.')}</p><div class="service-meta"><strong>${money(s.price)}</strong><span>◷ ${s.duration} phút</span></div></div></article>`).join('')}</div>` : empty('Chưa được phân công dịch vụ', 'Dịch vụ chuyên môn sẽ hiển thị khi được cập nhật trong hệ thống.'); }
function detail() {
  const b = state.data.bookings.find((item) => String(item.id) === String(state.selected));
  if (!b) return `<aside class="panel detail-panel"><div class="section-heading"><h2>Chi tiết lịch hẹn</h2><span>↗</span></div>${empty('Sẵn sàng cho lịch hẹn mới', 'Chọn một lịch hẹn để xem thông tin khách hàng và dịch vụ.')}<div class="detail-note">Một chút chuẩn bị, một trải nghiệm tốt hơn.</div></aside>`;
  const step = ['CONFIRMED', 'PROCESSING', 'COMPLETED'].indexOf(b.status);
  return `<aside class="panel detail-panel"><div class="section-heading"><h2>Chi tiết lịch hẹn</h2><span class="muted">#${b.id}</span></div><div class="detail-customer">${avatar(b.customerName, b.avatar, true)}<h3>${esc(b.customerName)}</h3><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>${badge(b.status)}</div><dl><div><dt>Dịch vụ</dt><dd>${esc(b.serviceName)}</dd></div><div><dt>Thời gian</dt><dd>${b.startsAt.slice(11)} – ${b.endsAt.slice(11)}</dd></div><div><dt>Thời lượng dịch vụ</dt><dd>${b.duration} phút</dd></div><div><dt>Giá dịch vụ</dt><dd>${money(b.price)}</dd></div></dl><div class="customer-note"><small>GHI CHÚ KHÁCH HÀNG</small><p>${esc(b.note || 'Chưa có ghi chú cho lịch hẹn này.')}</p></div>${['CANCELLED', 'NO_SHOW'].includes(b.status) ? '' : `<div class="progress">${['Xác nhận', 'Thực hiện', 'Hoàn thành'].map((label, i) => `<div class="${i <= step ? 'done' : ''}"><span>${i <= step ? '✓' : i + 1}</span><small>${label}</small></div>`).join('')}</div>`}<a class="button call-button" href="tel:${esc(b.phone)}">Liên hệ khách hàng ↗</a></aside>`;
}
function appointmentPanel() {
  const bookings = state.data.bookings.filter((b) => (!state.status || b.status === state.status) && `${b.customerName} ${b.serviceName} ${b.phone}`.toLocaleLowerCase('vi').includes(state.query.toLocaleLowerCase('vi')));
  return `<section class="panel appointments"><div class="section-heading"><div><h2>Lịch hẹn ${state.date === localDate() ? 'hôm nay' : 'trong ngày'} <span class="count">${state.data.bookings.length}</span></h2><p>${longDate(state.date)}</p></div>${dateControls()}</div><div class="table-tools"><label class="search"><span>⌕</span><input id="search" placeholder="Tìm khách hàng, dịch vụ…" value="${esc(state.query)}" aria-label="Tìm lịch hẹn"></label><select id="status-filter" aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option>${Object.entries(labels).map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>${bookings.length ? `<div class="table-scroll"><table><thead><tr><th>Giờ</th><th>Khách hàng</th><th>Dịch vụ</th><th>Thời lượng</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${bookings.map((b) => `<tr class="${String(b.id) === String(state.selected) ? 'selected' : ''}"><td><strong>${b.startsAt.slice(11)}</strong></td><td><div class="table-person">${avatar(b.customerName, b.avatar)}<strong>${esc(b.customerName)}</strong></div></td><td class="booking-service">${esc(b.serviceName)}</td><td>${b.duration} phút</td><td>${badge(b.status)}</td><td><button class="view-button" data-booking="${b.id}" aria-label="Xem lịch hẹn của ${esc(b.customerName)}">Xem</button></td></tr>`).join('')}</tbody></table></div>` : empty(state.data.bookings.length ? 'Không có lịch hẹn phù hợp' : 'Hôm nay có chút thảnh thơi', state.data.bookings.length ? 'Thử tìm kiếm khác hoặc chọn tất cả trạng thái.' : 'Chưa có lịch hẹn trong ngày được chọn. Bạn có thể xem những ngày khác.')}<div class="table-footer"><span>${bookings.length} lịch hẹn được hiển thị</span><span>Giờ làm việc tại cửa hàng</span></div></section>`;
}
function render() {
  if (!state.data) return;
  const { profile, bookings, shifts } = state.data;
  $('#page-title').textContent = titles[state.view];
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  let html = '';
  if (state.view === 'home') {
    const next = bookings.find((b) => ['PENDING', 'CONFIRMED'].includes(b.status) && new Date(b.startsAt.replace(' ', 'T')) >= new Date());
    html = `<section class="hero"><div class="hero-copy"><span class="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Xin chào, <em>${esc(profile.name)}!</em> <span class="wave">✦</span></h2><p>Mỗi bộ nail là một câu chuyện đẹp.<br>Cảm ơn bạn đã luôn tận tâm làm đẹp mỗi ngày!</p><span class="hero-quote">“Khách hàng hạnh phúc, là thành công của chúng ta!”</span></div><div class="hero-photo"><img src="/uploads/banner/nail-banner-v2.png" alt="Nghệ thuật làm móng tại NailHouse"><div class="photo-caption">Good Nails<br>Brighter Days</div></div></section><div class="stats"><article><span class="stat-icon rose-bg">▦</span><div><p>Lịch hẹn trong ngày</p><strong>${bookings.length.toString().padStart(2, '0')}</strong><small>${state.date === localDate() ? 'Hôm nay' : state.date}</small></div></article><article><span class="stat-icon ochre-bg">◷</span><div><p>Đang thực hiện</p><strong>${bookings.filter((b) => b.status === 'PROCESSING').length.toString().padStart(2, '0')}</strong><small>lịch hẹn</small></div></article><article><span class="stat-icon green-bg">✓</span><div><p>Đã hoàn thành</p><strong>${bookings.filter((b) => b.status === 'COMPLETED').length.toString().padStart(2, '0')}</strong><small>lịch hẹn trong ngày</small></div></article><article><span class="stat-icon neutral-bg">↗</span><div><p>Lịch hẹn tiếp theo</p><strong class="next-time">${next ? next.startsAt.slice(11) : '—'}</strong><small>${next ? esc(next.customerName) : 'Chưa có lịch sắp tới'}</small></div></article></div><div class="work-grid">${appointmentPanel()}${detail()}</div><section class="panel lower-panel"><div class="section-heading"><div><span class="eyebrow">NHỮNG GƯƠNG MẶT THÂN QUEN</span><h2>Khách hàng của tôi</h2></div><button class="text-button" data-view="customers">Xem tất cả ↗</button></div>${customerCards(4)}</section><section class="panel lower-panel"><div class="section-heading"><div><span class="eyebrow">CHĂM CHÚT BẰNG CHUYÊN MÔN</span><h2>Dịch vụ của tôi</h2></div><button class="text-button" data-view="services">Xem tất cả ↗</button></div>${serviceCards(3)}</section>`;
  } else if (state.view === 'schedule') {
    html = `<section class="panel shifts"><div class="section-heading"><div><h2>Ca làm việc · 7 ngày</h2><p>Từ ${longDate(state.date)}</p></div></div>${shifts.length ? `<div class="shift-list">${shifts.map((s) => `<button class="shift-card" data-date="${s.date}"><small>${longDate(s.date)}</small><strong>${s.start} – ${s.end}</strong><span>${s.status === 'OFF' ? 'Nghỉ' : 'Có lịch làm việc'}</span></button>`).join('')}</div>` : empty('Chưa có ca làm việc', 'Chưa có ca được phân công trong 7 ngày kể từ ngày đang chọn.')}</section><div class="work-grid">${appointmentPanel()}${detail()}</div>`;
  } else if (state.view === 'customers' || state.view === 'services') {
    html = `<section class="panel lower-panel"><div class="section-heading"><h2>${titles[state.view]}</h2><label class="search"><span>⌕</span><input id="search" value="${esc(state.query)}" placeholder="Tìm kiếm…" aria-label="Tìm kiếm"></label></div>${state.view === 'customers' ? customerCards() : serviceCards()}</section>`;
  } else {
    html = `<section class="panel profile"><div class="profile-cover"></div>${avatar(profile.name, profile.avatar, true)}<p class="eyebrow">CHUYÊN VIÊN NAILHOUSE</p><h2>${esc(profile.name)}</h2><p>${esc(profile.specialty || 'Chuyên viên chăm sóc sắc đẹp')}</p><div class="profile-stats"><div><strong>${profile.experienceYears}</strong><span>Năm kinh nghiệm</span></div><div><strong>${profile.rating} / 5</strong><span>Đánh giá</span></div><div><strong>${state.data.services.length}</strong><span>Dịch vụ chuyên môn</span></div></div><dl><div><dt>Số điện thoại</dt><dd>${esc(profile.phone || 'Chưa cập nhật')}</dd></div><div><dt>Email</dt><dd>${esc(profile.email || 'Chưa cập nhật')}</dd></div><div><dt>Chuyên môn</dt><dd>${esc(profile.specialty || 'Chưa cập nhật')}</dd></div></dl></section>`;
  }
  $('#content').innerHTML = html;
  $('#content').classList.toggle('home-view', state.view === 'home');
  if (state.view === 'home') {
    const bottom = document.createElement('div');
    bottom.className = 'bottom-grid';
    document.querySelectorAll('#content > .lower-panel').forEach(panel => bottom.append(panel));
    $('#content').append(bottom);
    document.querySelectorAll('.stats article').forEach((card, index) => {
      if (index === 3) return;
      const link = document.createElement('button');
      link.className = 'stat-link';
      link.textContent = 'Xem chi tiết  →';
      link.dataset.stat = ['', 'PROCESSING', 'COMPLETED'][index];
      card.lastElementChild.append(link);
    });
  }
  decorateIcons();
}
document.addEventListener('click', (event) => {
  const stat = event.target.closest('[data-stat]');
  if (stat) { state.view = 'schedule'; state.status = stat.dataset.stat; state.query = ''; render(); }
  const view = event.target.closest('[data-view]');
  if (view) { state.view = view.dataset.view; state.query = ''; state.status = ''; render(); }
  const booking = event.target.closest('[data-booking]');
  if (booking) { state.selected = booking.dataset.booking; render(); }
  const day = event.target.closest('[data-day]');
  const today = event.target.closest('[data-today]');
  const date = event.target.closest('[data-date]');
  if (day || today || date) { const d = new Date(`${state.date}T12:00:00`); if (day) d.setDate(d.getDate() + Number(day.dataset.day)); state.date = today ? localDate() : date ? date.dataset.date : localDate(d); load(); }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'staff-select') { state.staffId = event.target.value; state.selected = null; load(); }
  if (event.target.id === 'work-date' && event.target.value) { state.date = event.target.value; load(); }
  if (event.target.id === 'status-filter') { state.status = event.target.value; render(); }
});
document.addEventListener('input', (event) => { if (event.target.id === 'search') { const pos = event.target.selectionStart; state.query = event.target.value; render(); $('#search').focus(); $('#search').setSelectionRange(pos, pos); } });
async function init() {
  try {
    const staff = await request('/api/staff');
    if (!staff.length) throw new Error('Chưa có nhân viên hoạt động trong hệ thống.');
    $('#staff-select').innerHTML = staff.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    state.staffId = staff[0].id;
    await load();
  } catch (error) { $('#feedback').textContent = error.message; $('#content').innerHTML = empty('Chưa kết nối được hệ thống', 'Nhấn “Làm mới dữ liệu” để kết nối lại.'); $('#content').setAttribute('aria-busy', 'false'); }
}
$('#global-search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.data) return;
  state.query = $('#global-search').value.trim();
  state.status = '';
  state.view = 'home';
  render();
  $('.appointments').scrollIntoView({behavior:'smooth',block:'start'});
});
$('#refresh').addEventListener('click', () => state.staffId ? load() : init());
init();

function icon(type) {
 const paths = {
  home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  customers: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v3"/>',
  services: '<rect x="3" y="3" width="7" height="7" rx="3"/><rect x="14" y="3" width="7" height="7" rx="3"/><rect x="3" y="14" width="7" height="7" rx="3"/><rect x="14" y="14" width="7" height="7" rx="3"/>',
  profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>',
  done: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  flower: '<circle cx="12" cy="12" r="2"/><path d="M12 8C5-2 2 7 8 10c-12 0-6 10 1 5-5 10 6 12 5 3 6 9 12 0 4-4 11-3 4-12-2-6 2-11-8-10-4 0Z"/>'
 };
 return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[type]||paths.flower)+'</svg>';
}
function decorateIcons() {
 document.querySelectorAll('nav [data-view]').forEach(button => button.querySelector('span').innerHTML=icon(button.dataset.view));
 $('.brand-mark').innerHTML=icon('flower');
 document.querySelectorAll('.stat-icon').forEach((el,i)=>el.innerHTML=icon(['schedule','play','done','clock'][i]));
 document.querySelectorAll('.section-heading h2').forEach(el=>{const span=document.createElement('span');span.className='heading-icon';span.innerHTML=icon(el.closest('.appointments')||el.closest('.detail-panel')?'schedule':el.textContent.includes('Khách')?'customers':'flower');el.prepend(span);});
}
decorateIcons();
