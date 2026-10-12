/* ===== Trang lịch làm việc: ngày / tuần / tháng ===== */

import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { DayTimeline } from '../components/DayTimeline';
import { WeekGrid } from '../components/WeekGrid';
import { Icon } from '../components/Icon';
import { MiniCalendar } from '../components/MiniCalendar';
import { apiRequest, useApp, type CalendarMode } from '../store';
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
          <LeaveSection />
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

interface LeaveRequest {
  id: string;
  startDatetime: string;
  endDatetime: string;
  reason: string | null;
  leaveType?: 'NORMAL' | 'EMERGENCY';
  reasonCategory?: 'HEALTH' | 'FAMILY' | 'PERSONAL' | 'OTHER' | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  reviewerName: string | null;
  affectedBookings?: number;
}

const LEAVE_STATUS: Record<LeaveRequest['status'], string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

const REASON_GROUPS: { key: NonNullable<LeaveRequest['reasonCategory']>; label: string; hint: string }[] = [
  { key: 'HEALTH', label: 'Sức khỏe', hint: 'Ốm, mệt, chấn thương' },
  { key: 'FAMILY', label: 'Gia đình khẩn cấp', hint: 'Việc nhà gấp' },
  { key: 'PERSONAL', label: 'Sự cố cá nhân', hint: 'Xe hỏng, giấy tờ…' },
  { key: 'OTHER', label: 'Lý do khác', hint: 'Ghi thêm ở dưới' },
];

const REASON_LABEL: Record<string, string> = {
  HEALTH: 'Sức khỏe',
  FAMILY: 'Gia đình khẩn cấp',
  PERSONAL: 'Sự cố cá nhân',
  OTHER: 'Lý do khác',
};

/* Báo nghỉ đột xuất: biểu mẫu riêng cho sự cố trong ngày, KHÔNG nhập
   ngày giờ — server tự tính khoảng nghỉ từ ca hôm nay (chưa tới ca thì
   nghỉ cả ca, đang trong ca thì nghỉ từ lúc báo). */
function EmergencyLeavePanel({ onDone }: { onDone: () => void }) {
  const { state } = useApp();
  const [category, setCategory] = useState<NonNullable<LeaveRequest['reasonCategory']>>('HEALTH');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const today = localDate();
  const shift = state.data!.shifts.find((s) => s.date === today && s.status === 'AVAILABLE');
  const now = new Date();
  const nowHM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  /* Xem trước khoảng nghỉ để nhân viên biết; server mới quyết định cuối. */
  const previewText = !shift ? null
    : nowHM < shift.start ? shift.start + '–' + shift.end + ' (cả ca)'
    : nowHM < shift.end ? nowHM + '–' + shift.end + ' (từ lúc này)'
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const saved = await apiRequest<LeaveRequest>('/api/staff/leave-requests/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCategory: category, note: note.trim() || undefined }),
      });
      setNote('');
      setCategory('HEALTH');
      setOpen(false);
      setMessage('Đã ghi nhận báo nghỉ đột xuất thành công. Hệ thống đã tạm ngừng nhận lịch hẹn mới'
        + ' trong thời gian nghỉ. Quản trị viên đã được thông báo để sắp xếp'
        + ((saved as LeaveRequest)?.affectedBookings
          ? ' ' + (saved as LeaveRequest).affectedBookings + ' lịch hẹn bị ảnh hưởng.'
          : ' các lịch hẹn bị ảnh hưởng.'));
      onDone();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không gửi được yêu cầu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel leave-panel emergency-panel">
      <div className="section-heading">
        <h2>Báo nghỉ đột xuất</h2>
        <span className="emergency-flag">Nghỉ ngay</span>
      </div>
      {!shift ? (
        <p className="booking-action-note">Bạn không có ca làm việc hôm nay nên không cần báo nghỉ đột xuất.</p>
      ) : !previewText ? (
        <p className="booking-action-note">Ca làm việc hôm nay đã kết thúc. Vui lòng liên hệ quản trị viên nếu cần điều chỉnh chấm công.</p>
      ) : !open ? (
        <button className="leave-open emergency-open" onClick={() => { setOpen(true); setMessage(''); }}>
          <span aria-hidden="true">🚨</span> Báo nghỉ đột xuất ({previewText})
        </button>
      ) : (
        <form className="leave-form" onSubmit={submit}>
          <div className="emergency-shift">
            Ca hôm nay: <strong>{shift.start}–{shift.end}</strong>
            {' · '}Nghỉ dự kiến: <strong>{previewText}</strong>
          </div>
          <div className="reason-grid" role="radiogroup" aria-label="Nhóm lý do nghỉ">
            {REASON_GROUPS.map((g) => (
              <label key={g.key} className={'reason-card' + (category === g.key ? ' is-on' : '')}>
                <input type="radio" name="leave-reason" checked={category === g.key}
                  onChange={() => setCategory(g.key)} disabled={busy} />
                <strong>{g.label}</strong>
                <small>{g.hint}</small>
              </label>
            ))}
          </div>
          <label>
            <span>Ghi chú thêm (không bắt buộc)</span>
            <input value={note} maxLength={500}
              onChange={(e) => setNote(e.target.value)} disabled={busy}
              placeholder="Không cần ghi chi tiết riêng tư…" />
          </label>
          <p className="emergency-confirm">
            Khi xác nhận, hệ thống sẽ ngừng nhận lịch hẹn mới trong thời gian nghỉ
            và thông báo cho quản trị viên để xử lý những lịch hẹn bị ảnh hưởng.
          </p>
          <div className="leave-actions">
            <button type="button" className="leave-cancel" disabled={busy}
              onClick={() => setOpen(false)}>Hủy bỏ</button>
            <button type="submit" className="leave-submit" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Báo nghỉ ngay'}
            </button>
          </div>
        </form>
      )}
      {message && <p className="booking-action-note">{message}</p>}
    </section>
  );
}

/* Xin nghỉ phép (có kế hoạch): nhân viên gửi khoảng nghỉ, quản trị duyệt
   mới có hiệu lực. Tách riêng khỏi báo nghỉ đột xuất. */
function NormalLeavePanel({ onDone }: { onDone: () => void }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!start || !end) {
      setMessage('Hãy chọn thời gian bắt đầu và kết thúc.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      /* datetime-local ra 'YYYY-MM-DDTHH:mm' — backend nhận 'YYYY-MM-DD HH:mm'. */
      await apiRequest<LeaveRequest>('/api/staff/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDatetime: start.replace('T', ' '),
          endDatetime: end.replace('T', ' '),
          reason: reason.trim() || undefined,
        }),
      });
      setStart('');
      setEnd('');
      setReason('');
      setOpen(false);
      setMessage('Đã gửi yêu cầu. Quản trị duyệt thì kỳ nghỉ mới có hiệu lực.');
      onDone();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không gửi được yêu cầu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel leave-panel">
      <div className="section-heading">
        <h2>Xin nghỉ phép</h2>
      </div>
      {!open ? (
        <button className="leave-open" onClick={() => { setOpen(true); setMessage(''); }}>
          <span aria-hidden="true">＋</span> Gửi yêu cầu nghỉ
        </button>
      ) : (
        <form className="leave-form" onSubmit={submit}>
          <label>
            <span>Từ lúc</span>
            <input type="datetime-local" value={start}
              onChange={(e) => setStart(e.target.value)} disabled={busy} />
          </label>
          <label>
            <span>Đến lúc</span>
            <input type="datetime-local" value={end}
              onChange={(e) => setEnd(e.target.value)} disabled={busy} />
          </label>
          <label>
            <span>Lý do (không bắt buộc)</span>
            <input value={reason} maxLength={500}
              onChange={(e) => setReason(e.target.value)} disabled={busy}
              placeholder="Ví dụ: việc gia đình…" />
          </label>
          <div className="leave-actions">
            <button type="button" className="leave-cancel" disabled={busy}
              onClick={() => setOpen(false)}>Hủy bỏ</button>
            <button type="submit" className="leave-submit" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      )}
      {message && <p className="booking-action-note">{message}</p>}
    </section>
  );
}

/* Lịch sử nghỉ chung của cả hai loại. */
function LeaveHistory({ items }: { items: LeaveRequest[] }) {
  if (items.length === 0) return null;
  return (
    <section className="panel leave-panel">
      <div className="section-heading"><h2>Lịch sử nghỉ</h2></div>
      <ul className="leave-list">
        {items.slice(0, 5).map((item) => (
          <li key={item.id}>
            <div>
              <strong>
                {String(item.startDatetime).slice(0, 16).replace('T', ' ')}
                {' → '}
                {String(item.endDatetime).slice(0, 16).replace('T', ' ')}
              </strong>
              <small>
                {item.leaveType === 'EMERGENCY'
                  ? '🚨 Đột xuất' + (item.reasonCategory ? ' · ' + (REASON_LABEL[item.reasonCategory] ?? '') : '') + ' · '
                  : ''}{LEAVE_STATUS[item.status]}
                {item.reviewerName ? ' bởi ' + item.reviewerName : ''}
                {item.reviewNote ? ' — ' + item.reviewNote : ''}
              </small>
            </div>
            <span className={'badge ' + (item.status === 'PENDING' ? 'pending'
              : item.status === 'APPROVED' ? 'completed' : 'cancelled')}>
              <i />{LEAVE_STATUS[item.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LeaveSection() {
  const [items, setItems] = useState<LeaveRequest[]>([]);

  async function load() {
    try {
      /* apiRequest đã bóc sẵn .data nên kiểu là mảng, không phải { data }. */
      const rows = await apiRequest<LeaveRequest[]>('/api/staff/leave-requests');
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      /* Lỗi tải danh sách không chặn form gửi mới. */
    }
  }

  useEffect(() => { load(); }, []);

  const pending = items.filter((item) => item.status === 'PENDING').length;

  return (
    <>
      <EmergencyLeavePanel onDone={load} />
      <NormalLeavePanel onDone={load} />
      {pending > 0 && (
        <p className="booking-action-note">Có {pending} yêu cầu nghỉ phép chờ duyệt.</p>
      )}
      <LeaveHistory items={items} />
    </>
  );
}
function usePeriodCaption() {  const { state } = useApp();
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

/* ===== Ca làm việc trong ngày + chấm công ===== */

function WorkdayCard() {
  const { state, reload } = useApp();
  const allShifts = state.data!.shifts;
  const dayShifts = allShifts.filter((s) => s.date === state.date);
  const available = dayShifts.filter((s) => s.status === 'AVAILABLE');
  const time = new Date().toTimeString().slice(0, 5);
  const working = state.date === localDate() && available.some((s) => s.start <= time && s.end > time);
  const attendance = state.data!.attendance ?? null;
  const isToday = state.date === localDate();
  const [attBusy, setAttBusy] = useState(false);
  const [attMsg, setAttMsg] = useState('');

  async function mark(action: 'check-in' | 'check-out') {
    setAttBusy(true);
    setAttMsg('');
    try {
      const saved = await apiRequest<{ checkInAt: string | null; checkOutAt: string | null; message?: string }>(
        `/api/staff/attendance/${action}`,
        { method: 'POST' },
      );
      setAttMsg(saved?.message ?? (action === 'check-in' ? 'Đã check-in.' : 'Đã check-out.'));
      reload();
    } catch (e) {
      setAttMsg(e instanceof Error ? e.message : 'Chấm công thất bại.');
    } finally {
      setAttBusy(false);
    }
  }

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
        <div>
          <dt>Chấm công</dt>
          <dd>
            {attendance?.checkInAt
              ? `${String(attendance.checkInAt).slice(11, 16)}${attendance.checkOutAt ? ` → ${String(attendance.checkOutAt).slice(11, 16)}` : ' → chưa về'}`
              : 'Chưa check-in'}
          </dd>
        </div>
      </dl>
      {isToday && available.length > 0 && (
        <div className="leave-actions" style={{ padding: '0 14px' }}>
          {!attendance?.checkInAt ? (
            <button className="leave-submit" disabled={attBusy} onClick={() => mark('check-in')}>
              {attBusy ? 'Đang ghi…' : 'Check-in vào ca'}
            </button>
          ) : !attendance?.checkOutAt ? (
            <button className="leave-submit" disabled={attBusy} onClick={() => mark('check-out')}>
              {attBusy ? 'Đang ghi…' : 'Check-out tan ca'}
            </button>
          ) : (
            <span className="badge completed"><i />Đã chấm công đủ</span>
          )}
        </div>
      )}
      {attMsg && <p className="booking-action-note" style={{ margin: '10px 14px 0' }}>{attMsg}</p>}
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
