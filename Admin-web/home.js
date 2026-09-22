function homeCalendar() {
  const month = state.homeMonth || state.date.slice(0,7);
  const first = new Date(`${month}-01T12:00:00`);
  const offset = (first.getDay()+6)%7;
  const count = new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  return `<section class="panel home-calendar"><div class="section-heading"><h2>Lịch của tôi</h2></div><div class="home-month-nav"><button data-home-month="-1" class="icon-button" aria-label="Tháng trước">‹</button><strong>Tháng ${first.getMonth()+1}, ${first.getFullYear()}</strong><button data-home-month="1" class="icon-button" aria-label="Tháng sau">›</button></div><div class="home-calendar-grid">${['T2','T3','T4','T5','T6','T7','CN'].map(d=>`<span class="weekday">${d}</span>`).join('')}${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:count},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`;return `<button data-date="${date}" class="${date===state.date?'selected-date':''} ${date===localDate()?'today-date':''}" aria-label="${longDate(date)}" aria-pressed="${date===state.date}">${i+1}</button>`;}).join('')}</div><div class="calendar-caption"><span></span> Ngày đang xem <button data-today>Về hôm nay</button></div></section>`;
}
function homePage() {
  const { profile, bookings, shifts } = state.data;
  const completed = bookings.filter(b => b.status === 'COMPLETED').length;
  const processing = bookings.filter(b => b.status === 'PROCESSING').length;
  const pending = bookings.filter(b => b.status === 'PENDING');
  const dayShifts = shifts.filter(s => s.date === state.date);
  const ordered = [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const rows = ordered.filter(b => (!state.status || b.status === state.status) &&
    `${b.customerName} ${b.phone} ${b.serviceName}`.toLocaleLowerCase('vi').includes(state.query.toLocaleLowerCase('vi')));
  const next = ordered.find(b => ['CONFIRMED', 'PENDING'].includes(b.status) &&
    new Date(b.startsAt.replace(' ', 'T')) >= new Date());
  const inProgress = ordered.find(b => b.status === 'PROCESSING');
  const dateLabel = state.date === localDate() ? 'hôm nay' : 'trong ngày';
  const metrics = [
    ['schedule', 'Tổng lịch hẹn', bookings.length, ''],
    ['clock', 'Chờ xác nhận', pending.length, 'PENDING'],
    ['play', 'Đang thực hiện', processing, 'PROCESSING'],
    ['done', 'Đã hoàn thành', completed, 'COMPLETED'],
  ];
  return `
    <div class="home-overview-heading"><h2>Tổng quan ${dateLabel}</h2><span>${longDate(state.date)}</span></div>
    <div class="home-metrics">
      ${metrics.map(([symbol, label, value, status]) => `
        <button class="home-metric" data-stat="${status}" aria-label="${esc(label)}: ${value}. Xem danh sách">
          <span class="metric-symbol" aria-hidden="true">${icon(symbol)}</span>
          <span class="metric-copy"><span>${label}</span><strong>${value}<small>lịch hẹn</small></strong></span>
        </button>`).join('')}
    </div>
    <div class="home-layout">
      <div class="home-primary">
        <section class="panel home-agenda">
          <div class="section-heading"><div><h2>Lịch hẹn ${dateLabel}</h2><p>${bookings.length} lịch hẹn của ${esc(profile.name)}</p></div><button class="home-link" data-view="schedule">Mở lịch làm việc ↗</button></div>
          <div class="home-table-tools">
            <label class="search"><span aria-hidden="true">⌕</span><input id="search" aria-label="Tìm lịch hẹn" placeholder="Tìm tên khách, số điện thoại, dịch vụ…" value="${esc(state.query)}"></label>
            <select id="status-filter" aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option>${Object.entries(labels).map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
          </div>
          ${scheduleTable(rows)}
          <div class="home-agenda-foot"><span>Hiển thị ${rows.length} / ${bookings.length} lịch hẹn</span><span>Giờ tại cửa hàng</span></div>
        </section>
      </div>
      <aside class="home-secondary" aria-label="Việc cần làm, ca làm và chọn ngày">
        <section class="panel home-attention">
          <div class="section-heading"><h2>Cần chú ý</h2><span class="attention-label">${state.date.split('-').reverse().join('/')}</span></div>
          <div class="attention-list">
          ${inProgress ? `<button class="attention-row sage" data-booking="${esc(inProgress.id)}"><span class="attention-icon">${icon('play')}</span><span><strong>Đang phục vụ ${esc(inProgress.customerName)}</strong><small>${esc(inProgress.serviceName)} · từ ${esc(inProgress.startsAt.slice(11))}</small></span><b aria-hidden="true">›</b></button>` : ''}
          ${pending.length ? `<button class="attention-row sand" data-stat="PENDING"><span class="attention-icon">${icon('clock')}</span><span><strong>${pending.length} lịch chờ xác nhận</strong><small>Xem danh sách khách đang chờ.</small></span><b aria-hidden="true">›</b></button>` : ''}
          ${next ? `<button class="attention-row blue" data-booking="${esc(next.id)}"><span class="attention-icon">${icon('schedule')}</span><span><strong>Tiếp theo · ${esc(next.startsAt.slice(11))}</strong><small>${esc(next.customerName)} · ${esc(next.serviceName)}</small></span><b aria-hidden="true">›</b></button>` : ''}
          ${!inProgress && !pending.length && !next ? `<div class="attention-clear"><span>${icon('done')}</span><div><strong>Mọi việc đã xong</strong><p>Lịch chờ xác nhận và khách sắp tới sẽ hiện ở đây.</p></div></div>` : ''}
          </div>
        </section>
        <section class="panel home-shift">
          <div class="home-shift-heading"><div><h2>Ca làm ${dateLabel}</h2><p class="shift-date">${longDate(state.date)}</p></div><span aria-hidden="true">${icon('clock')}</span></div>
          <div class="shift-times">${dayShifts.length ? dayShifts.map(s => `<p>${s.status === 'OFF' ? 'Ngày nghỉ' : `${esc(s.start)} – ${esc(s.end)}`}</p>`).join('') : '<p class="shift-empty">Chưa có ca được phân công</p>'}</div>
          <button class="home-link" data-view="schedule">Xem lịch làm việc ↗</button>
        </section>
        ${homeCalendar()}
      </aside>
    </div>`;
}
