/* ===== Trang lịch làm việc: ngày / tuần / tháng ===== */

import { useMemo } from 'react';
import { Avatar } from '../components/Avatar';
import { DayTimeline } from '../components/DayTimeline';
import { WeekGrid } from '../components/WeekGrid';
import { Icon } from '../components/Icon';
import { MiniCalendar } from '../components/MiniCalendar';
import { useApp, type CalendarMode } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { longDate, localDate, STATUS_LABELS, STATUS_ORDER } from '../lib/utils';
import type { Booking, BookingStatus } from '../types';

const MODE_TABS: [CalendarMode, string][] = [['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']];

const STAT_CARDS: [string, BookingStatus | '', string, 'schedule' | 'done' | 'play' | 'clock'][] = [
  ['Tổng lịch', '', 'rose-bg', 'schedule'],
  ['Đã xác nhận', 'CONFIRMED', 'neutral-bg', 'done'],
  ['Đang thực hiện', 'PROCESSING', 'ochre-bg', 'play'],
  ['Đã hoàn thành', 'COMPLETED', 'green-bg', 'clock'],
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

  /* Bảy ngày của tuần chứa state.date, luôn bắt đầu từ thứ Hai. */
  const weekDates = useMemo(() => {
    const anchor = new Date(`${state.date}T12:00:00`);
    anchor.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, [state.date]);

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
                  <div className="stat-body">
                    <p>{index === 0 ? `${label} ${period}` : label}</p>
                    <div className="stat-line">
                      <strong>{count}</strong>
                      <small>
                        {index === 0
                          ? 'lịch hẹn'
                          : `${all.length ? Math.round((count / all.length) * 100) : 0}% tổng lịch`}
                      </small>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="workday-reminder">
            <Icon name="flower" />
            <p>Chuẩn bị đầy đủ dụng cụ và kiểm tra ghi chú trước mỗi cuộc hẹn.</p>
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
              <DayTimeline
                rows={rows}
                shifts={state.data!.shifts}
                date={state.date}
                selected={state.selected}
                onOpen={openBooking}
              />
            )}
            {state.calendarMode === 'week' && (
              <WeekGrid
                rows={rows}
                shifts={state.data!.shifts}
                dates={weekDates}
                selected={state.selected}
                onOpen={openBooking}
                onPickDate={(date) => dispatch({ type: 'date', date })}
              />
            )}
            {state.calendarMode === 'month' && <MonthGrid rows={rows} />}

            <div className="schedule-list-footer">
              <span><i /> Lịch hẹn hiển thị theo giờ bắt đầu</span>
            </div>
          </section>
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
