/* ===== Trang Lịch làm việc của quản trị =====
   Ba khối theo đúng thứ tự ra quyết định: yêu cầu đổi ca của nhân viên
   (thẻ chờ duyệt) → ma trận tuần dựng từ bảng staff_schedule → danh sách
   từng ca trong tuần đang xem để xếp/sửa/xoá trực tiếp.

   Danh sách ca cuối trang chính là các dòng staff_schedule của tuần đang
   xem (kèm số lịch hẹn PENDING/CONFIRMED/PROCESSING của nhân viên hôm đó
   do backend đếm) — không phải số bịa, và khớp từng ô với ma trận tuần. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp, today, weekAround } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtDayShort, timeToMinutes, weekdayShort } from '../lib/utils';
import type { ScheduleRequestItem, ShiftItem, StaffItem } from '../store';

const ACTION_META: Record<ScheduleRequestItem['action'], { label: string; cls: string }> = {
  ADD: { label: 'Xin thêm ca', cls: 'completed' },
  UPDATE: { label: 'Xin đổi ca', cls: 'pending' },
  REMOVE: { label: 'Xin bớt ca', cls: 'cancelled' },
};

/* Một yêu cầu đổi ca = một thẻ: ai xin, xin gì, ngày nào, vướng mấy lịch,
   ghi chú ngay trên thẻ rồi Duyệt/Từ chối — khỏi hộp thoại chen ngang. */
function ScheduleRequestCard({ item, onDone }: { item: ScheduleRequestItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const meta = ACTION_META[item.action];

  async function review(approve: boolean) {
    if (!approve && !note.trim()) {
      setMessage('Từ chối cần ghi rõ lý do.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = await sendAdmin(
      `/schedule-requests/${item.id}/${approve ? 'approve' : 'reject'}`,
      'PATCH',
      { note: note.trim() || null },
    );
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onDone();
  }

  return (
    <li className="adm-req-card">
      <Avatar name={item.staffName} url={null} size={40} />
      <div className="adm-req-copy">
        <div className="adm-req-head">
          <strong>{item.staffName}</strong>
          <span className={`badge ${meta.cls}`}><i />{meta.label}</span>
        </div>
        <p>
          {weekdayShort(item.workDate)} · {fmtDayShort(item.workDate)}
          {item.action === 'REMOVE'
            ? ' · Xoá ca ngày này'
            : ` · Ca mới ${item.startTime.slice(0, 5)} – ${item.endTime.slice(0, 5)}`}
        </p>
        {item.affectedBookings > 0
          ? <span className="badge cancelled"><i />{item.affectedBookings} lịch vướng</span>
          : <span className="badge completed"><i />Không vướng lịch</span>}
        <input value={note} onChange={(e) => setNote(e.target.value)} disabled={busy}
          placeholder={item.action === 'REMOVE'
            ? 'Ghi chú duyệt / lý do từ chối…'
            : 'Ghi chú duyệt (không bắt buộc), từ chối thì phải ghi lý do…'} />
        {message && <p className="adm-error">{message}</p>}
      </div>
      <div className="adm-req-actions">
        <button className="button" disabled={busy} onClick={() => review(true)}>Duyệt</button>
        <button className="button secondary" disabled={busy} onClick={() => review(false)}>Từ chối</button>
      </div>
    </li>
  );
}

/* Một hộp cho cả xếp ca mới và sửa giờ ca: tạo thì chọn người + ngày +
   giờ, sửa thì chỉ đổi giờ (không đổi người/ngày — đúng luật backend). */
function ShiftModal({ shift, staff, defaultDate, onClose, onDone }: {
  /** null = xếp ca mới. */
  shift: ShiftItem | null;
  staff: StaffItem[];
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [staffId, setStaffId] = useState(shift?.staffId ?? '');
  const [date, setDate] = useState(shift?.workDate ?? defaultDate);
  const [start, setStart] = useState(shift ? shift.startTime.slice(0, 5) : '09:00');
  const [end, setEnd] = useState(shift ? shift.endTime.slice(0, 5) : '18:00');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shift && !staffId) {
      setMessage('Hãy chọn nhân viên.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) {
      setMessage('Giờ bắt đầu phải trước giờ kết thúc (HH:mm).');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = shift
      ? await sendAdmin(`/schedule/${shift.id}`, 'PUT', { startTime: start, endTime: end })
      : await sendAdmin('/schedule', 'POST', {
        staffId: Number(staffId), workDate: date, startTime: start, endTime: end,
      });
    setBusy(false);
    if (!result.ok) {
      /* Luật chặn lịch vướng của backend hiện nguyên văn để biết ca nào kẹt. */
      setMessage(result.message);
      return;
    }
    onDone();
  }

  return (
    <div className="adm-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{shift ? `Sửa giờ ca ${shift.staffName}` : 'Xếp ca mới'}</h3>
        {shift && (
          <p className="adm-field-note">
            {weekdayShort(shift.workDate)} · {fmtDayShort(shift.workDate)} — chỉ đổi giờ,
            không đổi người và ngày.
          </p>
        )}
        <form className="adm-form" onSubmit={submit}>
          {!shift && (
            <>
              <label className="adm-field">
                <span>Nhân viên</span>
                <select value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={busy}>
                  <option value="">— Chọn nhân viên —</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
              <label className="adm-field">
                <span>Ngày</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
              </label>
            </>
          )}
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Giờ bắt đầu</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={busy} />
            </label>
            <label className="adm-field">
              <span>Giờ kết thúc</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={busy} />
            </label>
          </div>
          {message && <p className="adm-error">{message}</p>}
          <div className="adm-modal-foot">
            <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button className="button" type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : shift ? 'Lưu giờ ca' : 'Xếp ca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminWorkSchedulePage() {
  const { state, anchorDate, setAnchorDate, reload } = useApp();
  const { shifts, staff, scheduleRequests, attendance } = state;

  const week = weekAround(anchorDate);
  const isThisWeek = week[0] <= today() && today() <= week[6];

  /* Gom ca theo (nhân viên, ngày). DB unique một ca/ngày nên mỗi ô một
     ca, nhưng gom theo danh sách cho chắc nếu sau này mở nhiều ca. */
  const byStaffDay = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = `${shift.staffId}|${shift.workDate}`;
    const list = byStaffDay.get(key);
    if (list) list.push(shift);
    else byStaffDay.set(key, [shift]);
  }
  const attByStaffDay = new Map<string, (typeof attendance)[number]>();
  for (const record of attendance) {
    attByStaffDay.set(`${record.staffId}|${record.workDate}`, record);
  }
  const staffById = new Map(staff.map((person) => [person.id, person]));

  const totalShifts = shifts.length;
  const totalBookings = shifts.reduce((sum, shift) => sum + shift.bookingCount, 0);
  const busiest = staff.reduce((best, item) => {
    const count = shifts
      .filter((shift) => shift.staffId === item.id)
      .reduce((sum, shift) => sum + shift.bookingCount, 0);
    return count > best.count ? { name: item.name, count } : best;
  }, { name: '—', count: 0 });

  const move = (delta: number) => {
    const base = new Date(`${anchorDate}T00:00:00`);
    base.setDate(base.getDate() + delta * 7);
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    setAnchorDate(`${base.getFullYear()}-${month}-${day}`);
  };

  const pendingRequests = scheduleRequests
    .filter((item) => item.status === 'PENDING')
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

  /* Một panel duy nhất với 3 tab — mỗi lúc chỉ nhìn một khối thay vì
     cuộn qua 3 mảng xếp chồng. */
  const [tab, setTab] = useState<'grid' | 'shifts' | 'requests'>('grid');

  /* Modal xếp/sửa ca + gom ca theo ngày cho tab danh sách. */
  const [shiftModal, setShiftModal] = useState<{ shift: ShiftItem | null } | null>(null);
  const [listError, setListError] = useState('');

  async function removeShift(shift: ShiftItem) {
    const ok = window.confirm(
      `Xoá ca của ${shift.staffName} ngày ${fmtDayShort(shift.workDate)} `
      + `(${shift.startTime.slice(0, 5)} – ${shift.endTime.slice(0, 5)})?`
      + (shift.bookingCount > 0
        ? ` Ca còn ${shift.bookingCount} lịch của khách nên sẽ không xoá được.`
        : ''));
    if (!ok) return;
    const result = await sendAdmin(`/schedule/${shift.id}`, 'DELETE');
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    setListError('');
    reload();
  }

  /* Danh sách ca gom theo ngày để khỏi lặp lại ngày trên từng dòng. */
  const shiftsByDate = new Map<string, ShiftItem[]>();
  for (const shift of [...shifts].sort((a, b) =>
    a.workDate.localeCompare(b.workDate) || a.startTime.localeCompare(b.startTime))) {
    const list = shiftsByDate.get(shift.workDate);
    if (list) list.push(shift);
    else shiftsByDate.set(shift.workDate, [shift]);
  }

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="calendar" label="Ca trong tuần" value={totalShifts} note="tổng số ca đã xếp" />
        <StatTile tone="sage" icon="schedule" label="Lịch hẹn trong ca" value={totalBookings} note="chờ xác nhận và đã nhận" />
        <StatTile tone="gold" icon="adminStaff" label="Nhân viên có ca" value={new Set(shifts.map((s) => s.staffId)).size}
          note={`trên ${staff.length} người`} />
        <StatTile tone="lavender" icon="clock" label="Nhân viên bận nhất" value={busiest.name} note={`${busiest.count} lịch`} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="clock" />}
          title="Lịch làm việc"
          subtitle={`${fmtDayShort(week[0])} – ${fmtDayShort(week[6])}`}
        >
          <div className="mode-tabs">
            <button onClick={() => move(-1)} aria-label="Tuần trước">‹</button>
            <button className={isThisWeek ? 'active' : ''}
              onClick={() => setAnchorDate(today())}>Tuần này</button>
            <button onClick={() => move(1)} aria-label="Tuần sau">›</button>
          </div>
        </SectionHeading>

        <div className="adm-tabs" role="tablist" aria-label="Chế độ xem lịch làm việc">
          <button role="tab" aria-selected={tab === 'grid'}
            className={tab === 'grid' ? 'is-on' : ''} onClick={() => setTab('grid')}>
            <Icon name="calendar" /> Ma trận tuần
          </button>
          <button role="tab" aria-selected={tab === 'shifts'}
            className={tab === 'shifts' ? 'is-on' : ''} onClick={() => setTab('shifts')}>
            <Icon name="clock" /> Danh sách ca
            <em className="adm-tab-count">{totalShifts}</em>
          </button>
          <button role="tab" aria-selected={tab === 'requests'}
            className={tab === 'requests' ? 'is-on' : ''} onClick={() => setTab('requests')}>
            <Icon name="schedule" /> Yêu cầu đổi ca
            {pendingRequests.length > 0
              ? <em className="adm-tab-count is-alert">{pendingRequests.length}</em>
              : <em className="adm-tab-count">0</em>}
          </button>
        </div>

        {tab === 'grid' && (
          shifts.length === 0 ? (
            <EmptyState
              title="Chưa có ca làm việc trong tuần này"
              detail="Xem tuần khác bằng hai nút mũi tên ở trên."
            />
          ) : (
            <div className="table-scroll">
              <div className="adm-chart-legend" style={{ padding: '0 4px 10px' }}>
                <span><i className="sw-busy" />Có lịch hẹn</span>
                <span><i className="sw-free" />Ca trống</span>
                <span><i className="sw-off" />Nghỉ</span>
              </div>
              <table className="adm-week">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    {week.map((day) => (
                      <th key={day} className={day === today() ? 'is-today' : undefined}>
                        {weekdayShort(day)}<small>{fmtDayShort(day)}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((person, index) => (
                    <tr key={person.id}>
                      <th scope="row">
                        <span className="adm-stt" style={{ display: 'block' }}>{index + 1}</span>
                        <span className="adm-cell-name">
                          <Avatar name={person.name} url={person.avatarUrl} size={32} />
                          <span style={{ minWidth: 0 }}>
                            <strong>{person.name}</strong>
                            <small>{person.specialty ?? '—'}</small>
                          </span>
                        </span>
                      </th>
                      {week.map((day) => {
                        const dayShifts = byStaffDay.get(`${person.id}|${day}`) ?? [];
                        if (dayShifts.length === 0) {
                          return <td key={day}><div className="adm-cell is-off">Nghỉ</div></td>;
                        }
                        /* Gộp các ca trong ngày thành một khối cho gọn. */
                        const start = Math.min(...dayShifts.map((s) => timeToMinutes(s.startTime)));
                        const end = Math.max(...dayShifts.map((s) => timeToMinutes(s.endTime)));
                        const booked = dayShifts.reduce((sum, s) => sum + s.bookingCount, 0);
                        const off = dayShifts.every((s) => s.status === 'OFF');
                        /* Ô có lịch hẹn xanh lá, ca trống xám tím, nghỉ viền đứt —
                           nhìn một cái là biết ca nào đang có khách. */
                        const tone = off ? 'is-off' : booked > 0 ? 'is-busy' : 'is-free';

                        return (
                          <td key={day}>
                            <div className={`adm-cell ${tone}`}>
                              {off ? 'Nghỉ' : (
                                <>
                                  <strong>{`${dayShifts[0].startTime.slice(0, 5)} – ${dayShifts[0].endTime.slice(0, 5)}`}</strong>
                                  <small>
                                    {dayShifts.length > 1 ? `${dayShifts.length} ca · ` : ''}
                                    {Math.round((end - start) / 60 * 10) / 10}h · {booked} lịch
                                  </small>
                                  {(() => {
                                    const att = attByStaffDay.get(`${person.id}|${day}`);
                                    if (!att) return null;
                                    if (att.onLeave) return <small>🏖️ Đang nghỉ duyệt</small>;
                                    if (!att.checkInAt) return <small>⚠️ Chưa chấm công</small>;
                                    return (
                                      <small>
                                        ✓ {String(att.checkInAt).slice(11, 16)}
                                        {att.checkOutAt ? ` → ${String(att.checkOutAt).slice(11, 16)}` : ' → chưa về'}
                                        {att.status === 'LATE' ? ` · muộn ${att.lateMinutes}p` : ''}
                                      </small>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'shifts' && (
          <>
            <div className="adm-tab-bar">
              <p>{totalShifts} ca trong bảng phân ca — mỗi ca kèm số lịch hẹn của khách,
                bấm biểu tượng để sửa giờ hoặc xoá.</p>
              <button className="button" onClick={() => setShiftModal({ shift: null })}>
                ＋ Xếp ca
              </button>
            </div>
            {listError && <p className="adm-error" style={{ padding: '0 16px' }}>{listError}</p>}
            {shifts.length === 0 ? (
              <EmptyState
                title="Tuần này chưa có ca nào"
                detail="Bấm Xếp ca để tạo ca đầu tiên cho nhân viên."
              />
            ) : (
              <div style={{ padding: '4px 16px 16px' }}>
                {[...shiftsByDate.entries()].map(([date, list]) => (
                  <section key={date} className={`adm-day-group${date === today() ? ' is-today' : ''}`}>
                    <h4>
                      <span className="adm-day-chip">{weekdayShort(date)} · {fmtDayShort(date)}</span>
                      {date === today() && <span className="badge pending"><i />Hôm nay</span>}
                      <em>{list.length} ca</em>
                    </h4>
                    <ul>
                      {list.map((shift) => {
                        const hours = Math.round(
                          (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) / 60 * 10) / 10;
                        const tone = shift.status === 'OFF'
                          ? 'is-off'
                          : shift.bookingCount > 0 ? 'is-busy' : 'is-free';
                        return (
                          <li key={shift.id} className={`adm-shift-row ${tone}`}>
                            <Avatar name={shift.staffName}
                              url={staffById.get(shift.staffId)?.avatarUrl ?? shift.avatarUrl} size={32} />
                            <span className="adm-shift-who">
                              <strong>{shift.staffName}</strong>
                              <small>{staffById.get(shift.staffId)?.specialty ?? '—'}</small>
                            </span>
                            <span className="adm-shift-when">
                              <strong>{shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)}</strong>
                              <small>{hours}h</small>
                            </span>
                            {shift.status === 'OFF'
                              ? <span className="badge cancelled"><i />Nghỉ</span>
                              : shift.bookingCount > 0
                                ? <span className="badge pending"><i />{shift.bookingCount} lịch</span>
                                : <span className="adm-none">Chưa có lịch</span>}
                            <span className="adm-shift-actions">
                              <button className="adm-icon-btn" title="Sửa giờ ca"
                                aria-label={`Sửa giờ ca của ${shift.staffName}`}
                                onClick={() => setShiftModal({ shift })}>
                                <Icon name="edit" />
                              </button>
                              <button className="adm-icon-btn" title="Xoá ca"
                                aria-label={`Xoá ca của ${shift.staffName}`}
                                onClick={() => removeShift(shift)}>
                                <Icon name="trash" />
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'requests' && (
          pendingRequests.length === 0 ? (
            <EmptyState
              title="Không có yêu cầu đổi ca"
              detail="Nhân viên xin thêm, đổi hoặc bớt ca sẽ hiện ở đây để duyệt."
            />
          ) : (
            <ul className="adm-req-list">
              {pendingRequests.map((item) => (
                <ScheduleRequestCard key={item.id} item={item} onDone={reload} />
              ))}
            </ul>
          )
        )}
      </Panel>

      {shiftModal && (
        <ShiftModal
          shift={shiftModal.shift}
          staff={staff}
          defaultDate={today() < week[0] || today() > week[6] ? week[0] : today()}
          onClose={() => setShiftModal(null)}
          onDone={() => { setShiftModal(null); reload(); }}
        />
      )}
    </>
  );
}
