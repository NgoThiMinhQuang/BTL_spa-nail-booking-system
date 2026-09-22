function arrangeSchedule() {
  const root = $('#content');
  root.classList.add('schedule-workspace');
  const main = root.querySelector('.schedule-main');
  const aside = root.querySelector('.schedule-aside');
  const stats = root.querySelector('.schedule-stats');
  const all = state.calendarMode === 'day' ? state.data.bookings : state.rangeBookings;
  stats.lastElementChild.remove();
  [...stats.children].forEach((card,index) => {
    const count = index === 0 ? all.length : all.filter(b=>b.status === (index===1?'CONFIRMED':'PROCESSING')).length;
    const small = card.querySelector('small');
    small.textContent = index === 0 ? 'lịch hẹn' : `${all.length ? Math.round(count / all.length * 100) : 0}% tổng lịch`;
  });
  main.prepend(stats);
  const upcoming = root.querySelector('.upcoming-panel');
  const detail = root.querySelector('.schedule-detail');
  const shifts = root.querySelector('.shift-disclosure');
  root.querySelector('.schedule-bottom').remove();
  aside.replaceChildren();
  const dayShifts = state.data.shifts.filter(s=>s.date===state.date);
  const available = dayShifts.filter(s=>s.status==='AVAILABLE');
  const now = new Date();
  const time = now.toTimeString().slice(0,5);
  const working = state.date===localDate() && available.some(s=>s.start<=time && s.end>time);
  const shiftPanel = document.createElement('section');
  shiftPanel.className = 'panel workday-card';
  shiftPanel.innerHTML = `<div class="section-heading"><h2>Ca làm việc ${state.date===localDate()?'hôm nay':'trong ngày'}</h2></div><div class="workday-hours">${icon('clock')}<strong>${available.length ? available.map(s=>`${s.start} – ${s.end}`).join('<br>') : dayShifts.length ? 'Ngày nghỉ' : 'Chưa phân ca'}</strong>${working?'<span class="badge completed">Đang làm việc</span>':''}</div><dl><div><dt>Ngày làm việc</dt><dd>${state.date.split('-').reverse().join('/')}</dd></div><div><dt>Ca được phân công</dt><dd>${available.length} ca</dd></div></dl>`;
  aside.append(shiftPanel);
  shiftPanel.append(shifts);
  shifts.querySelector('summary').textContent = 'Xem ca làm trong 7 ngày →';
  const calendar = document.createElement('div');
  calendar.innerHTML = homeCalendar();
  aside.append(calendar.firstElementChild, upcoming);
  const detailWrap = document.createElement('details');
  detailWrap.className = 'booking-detail-drawer';
  detailWrap.open = Boolean(state.scheduleDetailOpen && scheduleRows().length);
  const summary = document.createElement('summary');
  summary.textContent = 'Chi tiết lịch hẹn đang chọn';
  detailWrap.append(summary,detail);
  main.append(detailWrap);
  const reminder = document.createElement('div');
  reminder.className = 'workday-reminder';
  reminder.innerHTML = `${icon('flower')}<p>Chuẩn bị đầy đủ dụng cụ và kiểm tra ghi chú trước mỗi cuộc hẹn.</p>`;
  main.append(reminder);
  root.querySelectorAll('.schedule-table tbody tr').forEach(row=>{
    const button = row.querySelector('[data-booking]');
    if (!button) return;
    const booking = all.find(b=>String(b.id)===button.dataset.booking);
    button.textContent = 'Xem chi tiết';
    const timeCell = row.querySelector('td');
    if (booking) {
      const end = document.createElement('small');
      end.textContent = booking.endsAt.slice(11);
      timeCell.append(end);
      row.dataset.status = booking.status.toLowerCase();
    }
  });
  const lastHeading = root.querySelector('.schedule-table th:last-child');
  if (lastHeading) lastHeading.textContent = 'Hành động';
}
