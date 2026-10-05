/* ===== Trang chi tiết lịch hẹn (kèm hóa đơn khi đã hoàn thành) ===== */

import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Badge, EmptyState } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useApp } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { fmtNum, longDate, money, safeImage } from '../lib/utils';
import type { Booking, StaffProfile } from '../types';

const STEPS = ['Đặt lịch', 'Xác nhận', 'Đang thực hiện', 'Hoàn thành'];
const ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED'] as const;

function heading(icon: 'customers' | 'schedule' | 'services' | 'clock' | 'flower', title: string) {
  return (
    <h2 className="booking-card-title">
      <span><Icon name={icon} /></span>
      {title}
    </h2>
  );
}

export function BookingPage() {
  const { state, reload } = useApp();
  const { goView, openBooking } = useNavigation();
  const { profile, services } = state.data!;

  /* Hai bước bắt đầu và hoàn thành thuộc về nhân viên đang phục vụ, nên
     khu quản trị cố tình không có. Chỉ lịch được phân công cho mình mới
     cập nhật được, và backend cũng kiểm lại điều này. */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* Thêm dịch vụ phát sinh khi khách đang được phục vụ (PROCESSING).
     Backend chỉ cho nhân viên được phân công thêm lúc này — gọi đường
     /api/bookings/:id/addons với token nhân viên. */
  const [addonService, setAddonService] = useState('');
  const [addonQty, setAddonQty] = useState(1);
  const [addonMsg, setAddonMsg] = useState('');

  async function addAddon() {
    if (!addonService) { setAddonMsg('Hãy chọn dịch vụ phát sinh.'); return; }
    setBusy(true);
    setAddonMsg('');
    try {
      const response = await fetch(`/api/bookings/${b?.id}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: Number(addonService), quantity: addonQty }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setAddonMsg(payload.message ?? 'Không thêm được dịch vụ phát sinh.');
      } else {
        setAddonMsg(`Đã thêm ${payload.data.name} ×${payload.data.quantity}.`);
        setAddonService('');
        setAddonQty(1);
        reload();
      }
    } catch {
      setAddonMsg('Mất kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  async function advance(nextStatus: 'PROCESSING' | 'COMPLETED') {
    setBusy(true);
    setError('');
    try {
      /* Không gửi staffId nữa: backend lấy nhân viên từ token đăng nhập và tự
       kiểm tra lịch có được phân công cho mình không. Trước đây gửi
       staffId trong body là chỉ cần đổi số là thao tác được lịch của
       nhân viên khác. */
      const response = await fetch(`/api/bookings/${b?.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) setError(payload.message ?? 'Không cập nhật được trạng thái.');
      else reload();
    } catch {
      setError('Mất kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  const b = [...state.data!.bookings, ...state.rangeBookings]
    .find((item) => String(item.id) === String(state.selected));

  if (!b) {
    return (
      <>
        <button className="booking-back" onClick={() => goView('schedule')}>← Quay lại lịch làm việc</button>
        <EmptyState title="Không tìm thấy lịch hẹn" detail="Quay lại danh sách để chọn lịch hẹn của nhân viên này." />
      </>
    );
  }

  const stage = ORDER.indexOf(b.status as typeof ORDER[number]);
  const code = `HD${String(b.id).padStart(6, '0')}`;
  const showInvoice = b.status === 'COMPLETED';
  const customer = state.data!.customers.find((c) => String(c.id) === String(b.customerId));
  const following = [...state.data!.bookings]
    .filter((item) => item.startsAt > b.startsAt
      && ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(item.status))
    .slice(0, 3);

  return (
    <>
      <div className="booking-topline no-print">
        <button className="booking-back" onClick={() => goView('schedule')}>← Quay lại lịch làm việc</button>
        <div>
          <span>Mã lịch hẹn: </span>
          <strong>#{code}</strong>
          <Badge status={b.status} />
        </div>
        {showInvoice && (
          <button className="button" onClick={() => window.print()}>🖨 &nbsp; In hóa đơn</button>
        )}
      </div>

      {showInvoice && <Invoice b={b} code={code} profile={profile} />}

      <div className="booking-grid no-print">
        {/* Cột 1: khách hàng, dịch vụ, ghi chú */}
        <div className="booking-column">
          <section className="booking-card">
            {heading('customers', 'Thông tin khách hàng')}
            <div className="booking-customer">
              <Avatar name={b.customerName} url={b.avatar} large />
              <div>
                <h3>{b.customerName}</h3>
                <span className="booking-soft-label">{b.phone}</span>
              </div>
            </div>
            <div className="booking-contact">
              <a href={`tel:${b.phone}`}><span>☎</span>{b.phone}</a>
              <span><b>✉</b>{b.email || 'Chưa cập nhật email'}</span>
            </div>
            <div className="booking-customer-stat">
              <span>Lịch hẹn với bạn</span>
              <strong>{fmtNum(customer?.visits ?? 0)} <small>lần</small></strong>
            </div>
          </section>

          <section className="booking-card">
            {heading('flower', 'Thông tin dịch vụ')}
            <div className="booking-service-summary">
              {safeImage(b.serviceImage) ? (
                <img src={safeImage(b.serviceImage)} alt="" loading="lazy" />
              ) : (
                <div className="booking-service-placeholder"><Icon name="flower" /></div>
              )}
              <div>
                <h3>{b.serviceName}</h3>
                <span className="booking-price">{money(b.price)}</span>
                <p>◷ {b.duration} phút</p>
                {b.bufferTime ? <small>+ {b.bufferTime} phút chuẩn bị</small> : null}
              </div>
            </div>
            {b.serviceDescription && <p className="booking-description">{b.serviceDescription}</p>}
          </section>

          <section className="booking-card booking-note">
            {heading('schedule', 'Ghi chú từ khách hàng')}
            <p className="booking-note-text">{b.note || 'Khách hàng chưa có ghi chú cho lịch hẹn này.'}</p>
          </section>
        </div>

        {/* Cột 2: thông tin + tiến trình */}
        <div className="booking-column">
          <section className="booking-card">
            {heading('schedule', 'Thông tin lịch hẹn')}
            <dl className="booking-facts">
              <div><dt>Ngày hẹn</dt><dd>{longDate(b.startsAt.slice(0, 10))}</dd></div>
              <div><dt>Thời gian</dt><dd>{b.startsAt.slice(11)} – {b.endsAt.slice(11)}</dd></div>
              <div>
                <dt>Nhân viên</dt>
                <dd>{profile.name} <span className="booking-muted">(Bạn)</span></dd>
              </div>
              <div><dt>Trạng thái</dt><dd><Badge status={b.status} /></dd></div>
              <div><dt>Thời gian đặt</dt><dd>{b.createdAt}</dd></div>
            </dl>
          </section>

          <section className="booking-card booking-status">
            {heading('clock', 'Trạng thái lịch hẹn')}
            {stage < 0 ? (
              <div className="booking-terminal">
                <Badge status={b.status} />
                <p>
                  {b.status === 'CANCELLED'
                    ? 'Lịch hẹn này đã được hủy.'
                    : 'Lịch hẹn này được ghi nhận khách không đến.'}
                </p>
              </div>
            ) : (
              <ol className="booking-timeline">
                {STEPS.map((label, i) => (
                  <li
                    key={label}
                    className={i < stage ? 'complete' : i === stage ? 'current' : ''}
                    aria-current={i === stage ? 'step' : undefined}
                  >
                    <span className="timeline-dot">{i < stage ? '✓' : i + 1}</span>
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {i === 0 ? b.createdAt
                          : i < stage ? 'Đã thực hiện'
                            : i === stage ? 'Trạng thái hiện tại'
                              : 'Chưa thực hiện'}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="booking-status-foot">
              <Icon name="clock" />
              Thông tin cập nhật từ lịch hẹn của bạn
            </div>
          </section>
        </div>

        {/* Cột 3: thao tác + lịch tiếp theo */}
        <div className="booking-column">
          <section className="booking-card">
            {heading('services', 'Thao tác nhanh')}
            <div className="booking-actions">
              <button
                className="booking-primary"
                disabled={busy || b.status !== 'CONFIRMED'}
                onClick={() => advance('PROCESSING')}
              >
                ▷ Bắt đầu thực hiện
              </button>
              <button
                className="booking-soft"
                disabled={busy || b.status !== 'PROCESSING'}
                onClick={() => advance('COMPLETED')}
              >
                ✓ Hoàn thành dịch vụ
              </button>
              <button className="booking-soft" disabled>▦ Thay đổi lịch hẹn</button>
              <button className="booking-soft" disabled>× Hủy lịch hẹn</button>
              <a href={`tel:${b.phone}`}>☎ Liên hệ khách hàng</a>
            </div>
            {/* Dịch vụ phát sinh: chỉ khi đang phục vụ (PROCESSING), đúng
                luồng Staff. Backend chặn các trạng thái khác nên ở đây chỉ
                ẩn cho gọn, không phải bảo mật. */}
            {b.status === 'PROCESSING' && (
              <div className="booking-addon">
                <label htmlFor="addon-service">Dịch vụ phát sinh</label>
                <select
                  id="addon-service"
                  value={addonService}
                  disabled={busy}
                  onChange={(e) => setAddonService(e.target.value)}
                >
                  <option value="">— Chọn dịch vụ —</option>
                  {services.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} — {money(s.price)}
                    </option>
                  ))}
                </select>
                <div className="booking-addon-row">
                  <input
                    type="number"
                    aria-label="Số lượng"
                    min={1}
                    max={20}
                    value={addonQty}
                    disabled={busy}
                    onChange={(e) => setAddonQty(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                  />
                  <button className="booking-soft" disabled={busy} onClick={addAddon}>
                    ＋ Thêm phát sinh
                  </button>
                </div>
                {addonMsg && <p className="booking-action-note">{addonMsg}</p>}
              </div>
            )}
            {error
              ? <p className="booking-action-note is-error">{error}</p>
              : <p className="booking-action-note">
                {b.status === 'CONFIRMED'
                  ? 'Bấm "Bắt đầu thực hiện" khi bắt đầu phục vụ khách.'
                  : b.status === 'PROCESSING'
                    ? 'Bấm "Hoàn thành dịch vụ" khi làm xong.'
                    : 'Chỉ nhân viên được phân công mới cập nhật được tiến trình.'}
                {' '}Đổi lịch hoặc hủy lịch thì liên hệ quản trị viên.
              </p>}
          </section>

          <section className="booking-card">
            <div className="booking-next-heading">
              {heading('schedule', 'Lịch trình tiếp theo')}
              <button onClick={() => goView('schedule')}>Xem tất cả ↗</button>
            </div>
            {following.length ? following.map((item) => (
              <button key={item.id} className="booking-next" onClick={() => openBooking(String(item.id))}>
                <time>{item.startsAt.slice(11)}</time>
                <span>
                  <strong>{item.customerName}</strong>
                  <small>{item.serviceName}</small>
                </span>
                <span className="booking-next-arrow">›</span>
              </button>
            )) : <p className="booking-description">Không còn lịch hẹn tiếp theo trong ngày.</p>}
          </section>

          <section className="booking-card">
            {heading('services', `Dịch vụ của tôi (${services.length})`)}
            <p className="booking-description">Nhân viên đang phục vụ {services.length} dịch vụ chuyên môn.</p>
          </section>
        </div>
      </div>
    </>
  );
}

/* ===== Hóa đơn mẫu in được ===== */

function Invoice({ b, code, profile }: { b: Booking; code: string; profile: StaffProfile }) {
  return (
    <section className="booking-card invoice" id="invoice" aria-label="Hóa đơn dịch vụ">
      <div className="invoice-head">
        <div className="invoice-brand">
          <span className="invoice-logo">✳</span>
          <div>
            <strong>NailHouse</strong>
            <small>BEAUTY NAILS · BETTER YOU</small>
            <small>Cửa hàng NailHouse · Liên hệ: {profile.phone || b.phone || '—'}</small>
          </div>
        </div>
        <div className="invoice-title">
          <h2>HÓA ĐƠN DỊCH VỤ</h2>
          <p>Số: <strong>{code}</strong></p>
          <p>Ngày lập: {b.createdAt || longDate(b.startsAt.slice(0, 10))}</p>
          <Badge status={b.status} />
        </div>
      </div>

      <div className="invoice-customer">
        <span>Khách hàng: <strong>{b.customerName}</strong></span>
        <span>Điện thoại: <strong>{b.phone}</strong></span>
        <span>Email: <strong>{b.email || '—'}</strong></span>
        <span>Địa chỉ liên hệ: <strong>Chưa cập nhật</strong></span>
        <span>Nhân viên phục vụ: <strong>{profile.name}</strong></span>
        <span>Thời gian hẹn: <strong>{b.startsAt.slice(11)} – {b.endsAt.slice(11)}</strong></span>
      </div>

      <div className="table-scroll">
        <table className="admin-table invoice-table">
          <thead>
            <tr>
              <th className="col-stt">STT</th>
              <th className="txt">Dịch vụ</th>
              <th className="num">SL</th>
              <th className="num">Thời lượng</th>
              <th className="num">Đơn giá</th>
              <th className="num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="col-stt num">1</td>
              <td className="txt">{b.serviceName}</td>
              <td className="num">1</td>
              <td className="num">{b.duration} phút</td>
              <td className="num">{fmtNum(b.price)}đ</td>
              <td className="num">{fmtNum(b.price)}đ</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="txt" colSpan={5}>Tổng thành tiền</td>
              <td className="num">{money(b.price)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="invoice-foot">
        <p>Cảm ơn quý khách đã tin tưởng NailHouse!</p>
        <div>
          <span>Khách hàng<br /><small>(Ký, ghi rõ họ tên)</small></span>
          <span>Nhân viên lập<br /><small>{profile.name}</small></span>
        </div>
      </div>
    </section>
  );
}
