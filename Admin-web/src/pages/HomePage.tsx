/* ===== Trang chủ nhân viên ===== */

import { BookingTable, bookingCountLabel } from '../components/BookingTable';
import { Icon } from '../components/Icon';
import { MiniCalendar } from '../components/MiniCalendar';
import { SearchTools } from '../components/SearchTools';
import { useApp } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { fmtNum, localDate, longDate } from '../lib/utils';
import type { Booking } from '../types';
import type { IconName } from '../components/Icon';

interface Metric {
  symbol: IconName;
  label: string;
  value: number;
  status: string;
  tone: 'rose' | 'gold' | 'sage' | 'lavender';
  /** Gợi ý nhỏ dưới số, giúp đọc nhanh tỉ lệ. */
  note: string;
}

function buildMetrics(bookings: Booking[], dateLabel: string): Metric[] {
  const total = bookings.length;
  const count = (status: string) => bookings.filter((b) => b.status === status).length;
  const share = (n: number) => (total ? `${Math.round((n / total) * 100)}% tổng lịch` : 'Chưa có lịch hẹn');

  return [
    { symbol: 'schedule', label: 'Tổng lịch hẹn', value: total, status: '', tone: 'rose', note: `${fmtNum(total)} lượt ${dateLabel}` },
    { symbol: 'clock', label: 'Chờ xác nhận', value: count('PENDING'), status: 'PENDING', tone: 'gold', note: share(count('PENDING')) },
    { symbol: 'play', label: 'Đang thực hiện', value: count('PROCESSING'), status: 'PROCESSING', tone: 'lavender', note: share(count('PROCESSING')) },
    { symbol: 'done', label: 'Đã hoàn thành', value: count('COMPLETED'), status: 'COMPLETED', tone: 'sage', note: share(count('COMPLETED')) },
  ];
}

export function HomePage() {
  const { state, dispatch } = useApp();
  const { openBooking, goView } = useNavigation();
  const { profile, bookings, shifts } = state.data!;

  const dayShifts = shifts.filter((s) => s.date === state.date);
  const ordered = [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const query = state.query.toLocaleLowerCase('vi');
  const rows = ordered.filter((b) => (
    (!state.status || b.status === state.status)
    && `${b.customerName} ${b.phone} ${b.serviceName}`.toLocaleLowerCase('vi').includes(query)
  ));

  const now = new Date();
  const next = ordered.find((b) => (
    ['CONFIRMED', 'PENDING'].includes(b.status)
    && new Date(b.startsAt.replace(' ', 'T')) >= now
  ));
  const inProgress = ordered.find((b) => b.status === 'PROCESSING');
  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;
  const dateLabel = state.date === localDate() ? 'hôm nay' : 'trong ngày';

  return (
    <>
      <div className="home-overview-heading">
        <h2>Tổng quan {dateLabel}</h2>
        <span>{longDate(state.date)}</span>
      </div>

      <div className="home-metrics">
        {buildMetrics(bookings, dateLabel).map((m) => {
          const isActive = m.status ? state.status === m.status : !state.status;
          return (
            <button
              key={m.label}
              className={`home-metric home-metric-${m.tone}${isActive ? ' is-active' : ''}`}
              onClick={() => dispatch({ type: 'stat', status: m.status })}
              aria-pressed={m.status ? state.status === m.status : undefined}
            >
              <span className="metric-symbol" aria-hidden="true"><Icon name={m.symbol} /></span>
              <span className="metric-copy">
                <span>{m.label}</span>
                <strong>{fmtNum(m.value)}</strong>
                <small className="metric-note">{m.note}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="home-layout">
        <div className="home-primary">
          <section className="panel home-agenda">
            <div className="section-heading">
              <div>
                <h2>Lịch hẹn {dateLabel}</h2>
                <p>{bookings.length} lịch hẹn của {profile.name}</p>
              </div>
              <button className="home-link" onClick={() => goView('schedule')}>Mở lịch làm việc ↗</button>
            </div>
            <SearchTools
              query={state.query}
              onQuery={(v) => dispatch({ type: 'query', query: v })}
              status={state.status}
              onStatus={(v) => dispatch({ type: 'status', status: v })}
              placeholder="Tìm tên khách, số điện thoại, dịch vụ…"
            />
            <BookingTable
              rows={rows}
              selected={state.selected}
              pagerKey="home"
              size={8}
              hasFilter={Boolean(state.query || state.status)}
              onOpen={openBooking}
            />
            <div className="home-agenda-foot">
              <span>{bookingCountLabel(rows.length, bookings.length)}</span>
              <span>Giờ tại cửa hàng</span>
            </div>
          </section>
        </div>

        <aside className="home-secondary" aria-label="Việc cần làm, ca làm và chọn ngày">
          <section className="panel home-attention">
            <div className="section-heading">
              <h2>Cần chú ý</h2>
              <span className="attention-label">{state.date.split('-').reverse().join('/')}</span>
            </div>
            <div className="attention-list">
              {inProgress && (
                <button className="attention-row sage" onClick={() => openBooking(String(inProgress.id))}>
                  <span className="attention-icon"><Icon name="play" /></span>
                  <span>
                    <strong>Đang phục vụ {inProgress.customerName}</strong>
                    <small>{inProgress.serviceName} · từ {inProgress.startsAt.slice(11)}</small>
                  </span>
                  <b aria-hidden="true">›</b>
                </button>
              )}
              {pendingCount > 0 && (
                <button className="attention-row sand" onClick={() => dispatch({ type: 'stat', status: 'PENDING' })}>
                  <span className="attention-icon"><Icon name="clock" /></span>
                  <span>
                    <strong>{fmtNum(pendingCount)} lịch chờ xác nhận</strong>
                    <small>Xem danh sách khách đang chờ.</small>
                  </span>
                  <b aria-hidden="true">›</b>
                </button>
              )}
              {next && (
                <button className="attention-row blue" onClick={() => openBooking(String(next.id))}>
                  <span className="attention-icon"><Icon name="schedule" /></span>
                  <span>
                    <strong>Tiếp theo · {next.startsAt.slice(11)}</strong>
                    <small>{next.customerName} · {next.serviceName}</small>
                  </span>
                  <b aria-hidden="true">›</b>
                </button>
              )}
              {!inProgress && pendingCount === 0 && !next && (
                <div className="attention-clear">
                  <span><Icon name="done" /></span>
                  <div>
                    <strong>Mọi việc đã xong</strong>
                    <p>Lịch chờ xác nhận và khách sắp tới sẽ hiện ở đây.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="panel home-shift">
            <div className="home-shift-heading">
              <div>
                <h2>Ca làm {dateLabel}</h2>
                <p className="shift-date">{longDate(state.date)}</p>
              </div>
              <span aria-hidden="true"><Icon name="clock" /></span>
            </div>
            <div className="shift-times">
              {dayShifts.length ? dayShifts.map((s) => (
                <p key={`${s.start}-${s.end}`}>
                  {s.status === 'OFF' ? 'Ngày nghỉ' : `${s.start} – ${s.end}`}
                </p>
              )) : <p className="shift-empty">Chưa có ca được phân công</p>}
            </div>
            <button className="home-link" onClick={() => goView('schedule')}>Xem lịch làm việc ↗</button>
          </section>

          <MiniCalendar />
        </aside>
      </div>
    </>
  );
}
