function bookingPage() {
  const b = state.data.bookings.find(item => String(item.id) === String(state.selected));
  const back = '<button class="booking-back" data-view="schedule">← Quay lại lịch làm việc</button>';
  if (!b) return back + empty('Không tìm thấy lịch hẹn', 'Quay lại danh sách để chọn lịch hẹn của nhân viên này.');
  const customer = state.data.customers.find(c => String(c.id) === String(b.customerId));
  const following = state.data.bookings.filter(item => item.startsAt > b.startsAt && ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(item.status)).slice(0, 3);
  const heading = (symbol, title) => `<h2 class="booking-card-title"><span>${icon(symbol)}</span>${title}</h2>`;
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const stage = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED'].indexOf(b.status);
  const steps = ['Đặt lịch', 'Xác nhận', 'Đang thực hiện', 'Hoàn thành'];
  const timeline = stage < 0
    ? `<div class="booking-terminal">${badge(b.status)}<p>Lịch hẹn này ${b.status === 'CANCELLED' ? 'đã được hủy' : 'được ghi nhận khách không đến'}.</p></div>`
    : `<ol class="booking-timeline">${steps.map((label, i) => `<li class="${i < stage ? 'complete' : i === stage ? 'current' : ''}" ${i === stage ? 'aria-current="step"' : ''}><span class="timeline-dot">${i < stage ? '✓' : ''}</span><div><strong>${label}</strong><small>${i === 0 ? esc(b.createdAt || 'Đã đặt lịch') : i < stage ? 'Đã thực hiện' : i === stage ? 'Trạng thái hiện tại' : 'Chưa thực hiện'}</small></div></li>`).join('')}</ol>`;
  return `<div class="booking-topline">${back}<div>Mã lịch hẹn: <strong>#BK${esc(String(b.id).padStart(6, '0'))}</strong>${badge(b.status)}</div></div>
  <div class="booking-grid">
    <div class="booking-column">
      <section class="booking-card">${heading('customers', 'Thông tin khách hàng')}
        <div class="booking-customer">${avatar(b.customerName, b.avatar, true)}<div><h3>${esc(b.customerName)}</h3><span class="booking-soft-label">Khách hàng NailHouse</span></div></div>
        <div class="booking-contact"><a href="tel:${esc(b.phone)}"><span>☎</span>${esc(b.phone || 'Chưa có số điện thoại')}</a><span><b>✉</b>${esc(b.email || 'Chưa cập nhật email')}</span></div>
        <div class="booking-customer-stat"><span>Lịch hẹn với bạn</span><strong>${customer ? esc(customer.visits) : '—'} <small>lần</small></strong></div>
      </section>
      <section class="booking-card">${heading('flower', 'Thông tin dịch vụ')}
        <div class="booking-service-summary">${safeImage(b.serviceImage) ? `<img src="${safeImage(b.serviceImage)}" alt="${esc(b.serviceName)}">` : `<div class="booking-service-placeholder">${icon('flower')}</div>`}<div><h3>${esc(b.serviceName)}</h3><span class="booking-price">${money(b.price)}</span><p>◷ ${esc(b.duration)} phút</p>${b.bufferTime ? `<small>+ ${esc(b.bufferTime)} phút chuẩn bị</small>` : ''}</div></div>
        <p class="booking-description">${esc(b.serviceDescription || 'Chăm sóc tỉ mỉ, dành riêng cho bạn tại NailHouse.')}</p>
      </section>
      <section class="booking-card booking-note">${heading('schedule', 'Ghi chú từ khách hàng')}<p>${esc(b.note || 'Khách hàng chưa để lại ghi chú cho lịch hẹn này.')}</p></section>
    </div>
    <div class="booking-column">
      <section class="booking-card">${heading('schedule', 'Thông tin lịch hẹn')}<dl class="booking-facts">
        ${row('Ngày hẹn', esc(longDate(b.startsAt.slice(0, 10))))}
        ${row('Thời gian', `<strong>${esc(b.startsAt.slice(11))} – ${esc(b.endsAt.slice(11))}</strong>`)}
        ${row('Nhân viên', `${esc(state.data.profile.name)} <span class="booking-muted">(Bạn)</span>`)}
        ${row('Trạng thái', badge(b.status))}
        ${row('Thời gian đặt', esc(b.createdAt || 'Chưa cập nhật'))}
      </dl></section>
      <section class="booking-card booking-status">${heading('clock', 'Trạng thái lịch hẹn')}${timeline}<div class="booking-status-foot">${icon('clock')} Thông tin cập nhật từ lịch hẹn của bạn</div></section>
    </div>
    <div class="booking-column">
      <section class="booking-card">${heading('services', 'Thao tác nhanh')}<div class="booking-actions">
        <button class="booking-primary" disabled>▷ &nbsp; Bắt đầu thực hiện</button>
        <button class="booking-soft" disabled>✓ &nbsp; Hoàn thành dịch vụ</button>
        <button disabled>▦ &nbsp; Thay đổi lịch hẹn</button><button disabled>× &nbsp; Hủy lịch hẹn</button>
        ${b.phone ? `<a href="tel:${esc(b.phone)}">☎ &nbsp; Liên hệ khách hàng</a>` : ''}
      </div><p class="booking-action-note">Chức năng cập nhật lịch hẹn sắp được hỗ trợ.</p></section>
      <section class="booking-card"><div class="booking-next-heading">${heading('schedule', 'Lịch trình tiếp theo')}<button data-view="schedule">Xem tất cả ↗</button></div>
        ${following.length ? following.map(item => `<button class="booking-next" data-booking="${esc(item.id)}"><time>${esc(item.startsAt.slice(11))}</time><span><strong>${esc(item.customerName)}</strong><small>${esc(item.serviceName)}</small></span><span class="booking-next-arrow">›</span></button>`).join('') : '<p class="booking-description">Không còn lịch hẹn tiếp theo trong ngày.</p>'}
      </section>
    </div>
  </div>`;
}
