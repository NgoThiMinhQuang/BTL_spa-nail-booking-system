/* ===== Trang lịch làm việc: ngày / tuần / tháng ===== */

import { useMemo } from 'react';
import { Avatar } from '../components/Avatar';
import { Badge, EmptyState } from '../components/Primitives';
import { BookingTable } from '../components/BookingTable';
import { Icon } from '../components/Icon';
import { MiniCalendar } from '../components/MiniCalendar';
import { PageBar } from '../components/PageBar';
import { useApp, type CalendarMode } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { usePager } from '../hooks/usePager';
import { longDate, localDate, money, STATUS_LABELS, STATUS_ORDER } from '../lib/utils';
import type { Booking, BookingStatus } from '../types';

const MODE_TABS: [CalendarMode, string][] = [['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']];

const STAT_CARDS: [string, BookingStatus | '', string, 'schedule' | 'done' | 'play'][] = [
  ['Tổng lịch', '', 'rose-bg', 'schedule'],
  ['Đã xác nhận', 'CONFIRMED', 'neutral-bg', 'done'],
  ['Đang thực hiện', 'PROCESSING', 'ochre-bg', 'play'],
];

export function SchedulePage() {
  const { state, dispatch } = useApp();
  const { openBooking, shiftPeriod } = useNavigation();

  const all = state.calendarMode === 'day' ? state.data!.bookings : state.rangeBookings;
  const query = state.query.toLocaleLowerCase('vi');
  const rows = all.filter((b) => (
    (!state.status || b.status === state.status)
    && `${b.customerName} ${b.phone} ${b.serviceName}`.toLocaleLowerCase('vi').includes(query)
  ));

  const period = state.calendarMode === 'day'
    ? (state.date === localDate() ? 'hôm nay' : 'trong ngày')
    : state.calendarMode === 'week' ? 'trong tuần' : 'trong tháng';

  const upcoming = all
    .filter((b) => ['CONFIRMED', 'PENDING'].includes(b.status)
      && new Date(b.startsAt.replace(' ', 'T')) >= new Date())
    .slice(0, 3);

  const periodCaption = usePeriodCaption();

  return (
    <div className="schedule-workspace">
      <section className="schedule-toolbar panel">
        <div className="schedule-date">
          <Icon name="schedule" />
          <input
            id="work-date"
            type="date"
            aria-label="Ngày làm việc"
            value={state.date}
            onChange={(e) => e.target.value && dispatch({ type: 'dateField', date: e.target.value })}
          />
        </div>
        <div className="period-arrows">
          <button className="icon-button" onClick={() => shiftPeriod(-1)} aria-label="Khoảng thời gian trước">‹</button>
          <button className="icon-button" onClick={() => shiftPeriod(1)} aria-label="Khoảng thời gian sau">›</button>
        </div>
        <button className="button today-button" onClick={() => dispatch({ type: 'today' })}>Hôm nay</button>
        <div className="mode-tabs" aria-label="Chế độ xem lịch">
          {MODE_TABS.map(([mode, label]) => (
            <button
              key={mode}
              className={state.calendarMode === mode ? 'active' : ''}
              aria-pressed={state.calendarMode === mode}
              onClick={() => dispatch({ type: 'mode', mode })}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          id="status-filter"
          aria-label="Lọc trạng thái"
          value={state.status}
          onChange={(e) => dispatch({ type: 'status', status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_ORDER.map((key) => <option key={key} value={key}>{STATUS_LABELS[key]}</option>)}
        </select>
      </section>

      <div className="schedule-columns">
        <div className="schedule-main">
          <div className="stats schedule-stats">
            {STAT_CARDS.map(([label, status, color, symbol], index) => {
              const count = status ? all.filter((b) => b.status === status).length : all.length;
              return (
                <article key={label}>
                  <span className={`stat-icon ${color}`}><Icon name={symbol} /></span>
                  <div>
                    <p>{index === 0 ? `${label} ${period}` : label}</p>
                    <strong>{count}</strong>
                    <small>
                      {index === 0
                        ? 'lịch hẹn'
                        : `${all.length ? Math.round((count / all.length) * 100) : 0}% tổng lịch`}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="panel schedule-list">
            <div className="section-heading">
              <h2>Danh sách lịch hẹn</h2>
              <span className="period-caption">{periodCaption}</span>
            </div>
            <div className="schedule-search">
              <label className="search">
                <span>⌕</span>
                <input
                  aria-label="Tìm lịch hẹn"
                  placeholder="Tìm tên khách, số điện thoại hoặc dịch vụ…"
                  value={state.query}
                  onChange={(e) => dispatch({ type: 'query', query: e.target.value })}
                />
              </label>
              <span id="schedule-count">{rows.length} lịch hẹn</span>
            </div>

            {state.calendarMode === 'day' && (
              <BookingTable
                rows={rows}
                selected={state.selected}
                pagerKey="schedule-day"
                size={10}
                detailed
                hasFilter={Boolean(state.query || state.status)}
                onOpen={openBooking}
              />
            )}
            {state.calendarMode === 'week' && <WeekAgenda rows={rows} onOpen={openBooking} />}
            {state.calendarMode === 'month' && <MonthGrid rows={rows} />}

            <div className="schedule-list-footer">
              <span><i /> Lịch hẹn hiển thị theo giờ bắt đầu</span>
            </div>
          </section>

          <SelectedDetail rows={rows} onOpen={openBooking} />

          <div className="workday-reminder">
            <Icon name="flower" />
            <p>Chuẩn bị đầy đủ dụng cụ và kiểm tra ghi chú trước mỗi cuộc hẹn.</p>
          </div>
        </div>

        <div className="schedule-aside">
          <WorkdayCard />
          <MiniCalendar />
          {upcoming.length > 0 && (
            <section className="panel upcoming-panel">
              <div className="section-heading"><h2>Lịch sắp tới</h2></div>
              {upcoming.map((b) => (
                <button key={b.id} className="upcoming-row" onClick={() => openBooking(String(b.id))}>
                  <Avatar name={b.customerName} url={b.avatar} />
                  <span>
                    <strong>
                      {b.customerName}
                      <small>{b.serviceName}</small>
                    </strong>
                  </span>
                  <b>{b.startsAt.slice(11)}</b>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function usePeriodCaption() {
  const { state } = useApp();
  const dates = useMemo(() => {
    const anchor = new Date(`${state.date}T12:00:00`);
    let count = 1;
    if (state.calendarMode === 'week') {
      anchor.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
      count = 7;
    }
    if (state.calendarMode === 'month') {
      anchor.setDate(1);
      count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    }
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, [state.date, state.calendarMode]);

  if (state.calendarMode === 'day') return longDate(state.date);
  const first = dates[0].split('-').reverse().join('/');
  const last = dates[dates.length - 1].split('-').reverse().join('/');
  return `${first} – ${last}`;
}

/* ===== Chế độ tuần: mỗi trang 2 ngày ===== */

function WeekAgenda({ rows, onOpen }: { rows: Booking[]; onOpen: (id: string) => void }) {
  const { state, dispatch } = useApp();
  const dates = useMemo(() => {
    const anchor = new Date(`${state.date}T12:00:00`);
    anchor.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, [state.date]);

  const info = usePager('schedule-week', dates, 2);
  return (
    <>
      <div className="week-agenda">
        {info.rows.map((date) => {
          const dayRows = rows.filter((b) => b.startsAt.startsWith(date));
          return (
            <section key={date} className="agenda-day">
              <button className="agenda-date" onClick={() => dispatch({ type: 'date', date })}>
                <span>{new Date(`${date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' })}</span>
                <strong>{date.slice(8)}</strong>
                <small>{dayRows.length} lịch hẹn</small>
              </button>
              <div className="agenda-items">
                {dayRows.length ? dayRows.map((b) => (
                  <button
                    key={b.id}
                    className={`agenda-booking ${b.status.toLowerCase()} ${String(b.id) === String(state.selected) ? 'chosen' : ''}`}
                    onClick={() => onOpen(String(b.id))}
                  >
                    <strong>{b.startsAt.slice(11)} · {b.customerName}</strong>
                    <span>{b.serviceName}</span>
                    <small>{STATUS_LABELS[b.status]}</small>
                  </button>
                )) : <p className="agenda-empty">Chưa có lịch hẹn</p>}
              </div>
            </section>
          );
        })}
      </div>
      <PageBar info={info} onChange={info.goTo} unit="ngày" />
    </>
  );
}

/* ===== Chế độ tháng: lưới 7 cột, không phân trang ===== */

function MonthGrid({ rows }: { rows: Booking[] }) {
  const { state, dispatch } = useApp();
  const dates = useMemo(() => {
    const first = new Date(`${state.date}T12:00:00`);
    first.setDate(1);
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(first);
      d.setDate(d.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, [state.date]);

  const offset = (new Date(`${dates[0]}T12:00:00`).getDay() + 6) % 7;
  const today = localDate();

  return (
    <div className="month-calendar">
      <div className="month-weekdays">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="month-grid">
        {Array.from({ length: offset }, (_, i) => <div key={`b${i}`} className="month-blank" />)}
        {dates.map((date) => {
          const items = rows.filter((b) => b.startsAt.startsWith(date));
          return (
            <button
              key={date}
              className={`month-day ${date === today ? 'today' : ''}`}
              onClick={() => dispatch({ type: 'date', date })}
              aria-label={`${longDate(date)}, ${items.length} lịch hẹn`}
            >
              <strong>{Number(date.slice(8))}</strong>
              {items.slice(0, 2).map((b) => (
                <span key={b.id} className={`month-booking ${b.status.toLowerCase()}`}>
                  {b.startsAt.slice(11)} {b.customerName}
                </span>
              ))}
              {items.length > 2 && <small>+{items.length - 2} lịch hẹn</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Ca làm việc trong ngày ===== */

function WorkdayCard() {
  const { state } = useApp();
  const allShifts = state.data!.shifts;
  const dayShifts = allShifts.filter((s) => s.date === state.date);
  const available = dayShifts.filter((s) => s.status === 'AVAILABLE');
  const time = new Date().toTimeString().slice(0, 5);
  const working = state.date === localDate() && available.some((s) => s.start <= time && s.end > time);

  return (
    <section className="panel workday-card">
      <div className="section-heading">
        <h2>Ca làm việc {state.date === localDate() ? 'hôm nay' : 'trong ngày'}</h2>
      </div>
      <div className="workday-hours">
        <Icon name="clock" />
        <strong>
          {available.length
            ? available.map((s, i) => (
              <span key={`${s.start}-${s.end}`}>
                {i > 0 && <br />}
                {s.start} – {s.end}
              </span>
            ))
            : dayShifts.length ? 'Ngày nghỉ' : 'Chưa phân ca'}
        </strong>
        {working && <span className="badge completed">Đang làm việc</span>}
      </div>
      <dl>
        <div><dt>Ngày làm việc</dt><dd>{state.date.split('-').reverse().join('/')}</dd></div>
        <div><dt>Ca được phân công</dt><dd>{available.length} ca</dd></div>
      </dl>
      <details className="shift-disclosure">
        <summary>Xem ca làm trong 7 ngày →</summary>
        <div className="shift-list">
          {allShifts.map((s) => (
            <div key={`${s.date}-${s.start}`} className="shift-card">
              <strong>{s.date.split('-').reverse().join('/')}</strong>
              <span>{s.status === 'OFF' ? 'Nghỉ' : `${s.start} – ${s.end}`}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

/* ===== Chi tiết lịch hẹn đang chọn ===== */

const NOTES: Record<string, string> = {
  PENDING: 'Lịch hẹn đang chờ xác nhận từ cửa hàng.',
  CONFIRMED: 'Lịch hẹn đã được xác nhận. Hãy kiểm tra ghi chú và chuẩn bị dụng cụ trước giờ hẹn.',
  PROCESSING: 'Dịch vụ đang được thực hiện. Chúc bạn và khách hàng một trải nghiệm thật tốt.',
  COMPLETED: 'Dịch vụ đã hoàn thành. Cảm ơn bạn đã chăm sóc khách hàng!',
  CANCELLED: 'Lịch hẹn này đã được hủy.',
  NO_SHOW: 'Khách hàng được ghi nhận không đến.',
};

const STEPS = ['Đã xác nhận', 'Đang thực hiện', 'Hoàn thành'];

function SelectedDetail({ rows, onOpen }: { rows: Booking[]; onOpen: (id: string) => void }) {
  const { state } = useApp();
  const b = rows.find((item) => String(item.id) === String(state.selected));
  const phase = b ? ['CONFIRMED', 'PROCESSING', 'COMPLETED'].indexOf(b.status) : -1;

  return (
    <details className="booking-detail-drawer" open={Boolean(b)}>
      <summary>Chi tiết lịch hẹn đang chọn</summary>
      <aside className="panel schedule-detail">
        {!b ? (
          <>
            <div className="section-heading"><h2>Chi tiết lịch hẹn</h2></div>
            <EmptyState title="Sẵn sàng đón khách" detail="Chọn lịch hẹn trong danh sách để xem thông tin chi tiết." />
            <div className="schedule-tip">Chuẩn bị dụng cụ, kiểm tra lịch và dành một chút thời gian cho khách hàng tiếp theo.</div>
          </>
        ) : (
          <>
            <div className="section-heading">
              <h2>Chi tiết lịch hẹn</h2>
              <span className="booking-code">#LH{String(b.id).padStart(5, '0')}</span>
            </div>
            <div className="booking-info">
              <div className="booking-person">
                <Avatar name={b.customerName} url={b.avatar} large />
                <div>
                  <h3>{b.customerName}</h3>
                  <a href={`tel:${b.phone}`}>{b.phone}</a>
                </div>
                <a className="contact-pill" href={`tel:${b.phone}`}>Liên hệ ↗</a>
              </div>
              <dl>
                <div>
                  <dt>◷ &nbsp; Thời gian</dt>
                  <dd>
                    {b.startsAt.slice(11)} – {b.endsAt.slice(11)}
                    <small>{longDate(b.startsAt.slice(0, 10))}</small>
                  </dd>
                </div>
                <div><dt>✂ &nbsp; Dịch vụ</dt><dd>{b.serviceName}</dd></div>
                <div><dt>◷ &nbsp; Thời lượng</dt><dd>{b.duration} phút</dd></div>
                <div><dt>₫ &nbsp; Giá dịch vụ</dt><dd>{money(b.price)}</dd></div>
                <div><dt>≡ &nbsp; Ghi chú</dt><dd>{b.note || 'Khách hàng chưa có ghi chú.'}</dd></div>
              </dl>
            </div>
            <div className="service-progress">
              <h3>Trạng thái dịch vụ</h3>
              {['CANCELLED', 'NO_SHOW', 'PENDING'].includes(b.status) ? (
                <Badge status={b.status} />
              ) : (
                <div className="progress">
                  {STEPS.map((label, i) => (
                    <div key={label} className={i <= phase ? 'done' : ''}>
                      <span>{i <= phase ? '✓' : i + 1}</span>
                      <small>{label}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="schedule-tip"><span>i</span><p>{NOTES[b.status]}</p></div>
            <button className="button call-button" onClick={() => onOpen(String(b.id))}>Mở trang chi tiết ↗</button>
          </>
        )}
      </aside>
    </details>
  );
}
