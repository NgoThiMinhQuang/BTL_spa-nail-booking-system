/* ===== Trang Lịch làm việc của quản trị =====
   Ma trận tuần dựng từ bảng staff_schedule: mỗi dòng một nhân viên, mỗi cột một
   ngày. Ô trống là ngày không có ca; ô có ca ghi rõ giờ và số lịch hẹn đã nhận. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp, today, weekAround } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtDayShort, timeToMinutes, weekdayShort } from '../lib/utils';
import type { ScheduleRequestItem } from '../store';

const ACTION_TEXT: Record<ScheduleRequestItem['action'], string> = {
  ADD: 'Thêm ca',
  UPDATE: 'Đổi ca',
  REMOVE: 'Xoá ca',
};

function ScheduleRequestRow({ item, onDone }: { item: ScheduleRequestItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function review(approve: boolean) {
    const note = approve
      ? (window.prompt('Ghi chú duyệt (không bắt buộc):', '') ?? '')
      : (window.prompt('Lý do từ chối:', '') ?? '');
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
    <tr key={item.id}>
      <td><strong>{item.workDate}</strong><small>{weekdayShort(item.workDate)}</small></td>
      <td><strong>{item.staffName}</strong><small>{item.specialty ?? '—'}</small></td>
      <td>{ACTION_TEXT[item.action]}</td>
      <td>
        {item.action === 'REMOVE' ? (
          <span className="adm-none">Xoá ca ngày này</span>
        ) : (
          <strong>{item.startTime.slice(0, 5)} – {item.endTime.slice(0, 5)}</strong>
        )}
      </td>
      <td>
        {item.affectedBookings > 0
          ? <span className="badge cancelled"><i />{item.affectedBookings} lịch vướng</span>
          : <span className="badge completed"><i />Không vướng</span>}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button" disabled={busy} onClick={() => review(true)}>Duyệt</button>
          <button className="button secondary" disabled={busy} onClick={() => review(false)}>Từ chối</button>
        </div>
        {message && <p className="adm-error">{message}</p>}
      </td>
    </tr>
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

  /* Xếp ca trực tiếp (không qua yêu cầu của nhân viên). Cùng luật chặn
     lịch vướng như duyệt yêu cầu nên thông điệp lỗi hiện nguyên văn. */
  const [shiftForm, setShiftForm] = useState({ staffId: '', date: today(), start: '09:00', end: '18:00' });
  const [shiftMsg, setShiftMsg] = useState('');
  const [shiftBusy, setShiftBusy] = useState(false);

  const setShift = (key: keyof typeof shiftForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setShiftForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (!shiftForm.staffId) {
      setShiftMsg('Hãy chọn nhân viên.');
      return;
    }
    setShiftBusy(true);
    setShiftMsg('');
    const result = await sendAdmin('/schedule', 'POST', {
      staffId: Number(shiftForm.staffId),
      workDate: shiftForm.date,
      startTime: shiftForm.start,
      endTime: shiftForm.end,
    });
    setShiftBusy(false);
    if (!result.ok) {
      setShiftMsg(result.message);
      return;
    }
    setShiftMsg('Đã xếp ca.');
    reload();
  }

  async function editShift(id: string, currentStart: string, currentEnd: string) {
    const start = window.prompt('Giờ bắt đầu mới (HH:mm):', currentStart.slice(0, 5)) ?? '';
    if (!/^\d{2}:\d{2}$/.test(start.trim())) return;
    const end = window.prompt('Giờ kết thúc mới (HH:mm):', currentEnd.slice(0, 5)) ?? '';
    if (!/^\d{2}:\d{2}$/.test(end.trim())) return;
    const result = await sendAdmin(`/schedule/${id}`, 'PUT', {
      startTime: start.trim(), endTime: end.trim(),
    });
    if (!result.ok) {
      setShiftMsg(result.message);
      return;
    }
    reload();
  }

  async function removeShift(id: string) {
    if (!window.confirm('Xoá ca này? Ca còn lịch của khách thì không xoá được.')) return;
    const result = await sendAdmin(`/schedule/${id}`, 'DELETE');
    if (!result.ok) {
      setShiftMsg(result.message);
      return;
    }
    reload();
  }

  const weekShifts = [...shifts].sort((a, b) =>
    a.workDate.localeCompare(b.workDate) || a.startTime.localeCompare(b.startTime));

  return (
    <>
      <Panel>
        <SectionHeading
          icon={<Icon name="schedule" />}
          title="Yêu cầu đổi ca chờ duyệt"
          subtitle={pendingRequests.length > 0
            ? `${pendingRequests.length} yêu cầu của nhân viên`
            : 'Không có yêu cầu mới'}
        />

        {pendingRequests.length === 0 ? (
          <EmptyState
            title="Không có yêu cầu đổi ca"
            detail="Nhân viên xin thêm, đổi hoặc bớt ca sẽ hiện ở đây để duyệt."
          />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th>Ngày</th><th>Nhân viên</th><th>Loại</th>
                  <th>Ca mới</th><th>Lịch vướng</th><th>Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((item) => (
                  <ScheduleRequestRow key={item.id} item={item} onDone={reload} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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
          title="Lịch làm việc trong tuần"
          subtitle={`${fmtDayShort(week[0])} – ${fmtDayShort(week[6])}`}
        >
          <div className="mode-tabs">
            <button onClick={() => move(-1)} aria-label="Tuần trước">‹</button>
            <button className={isThisWeek ? 'active' : ''}
              onClick={() => setAnchorDate(today())}>Tuần này</button>
            <button onClick={() => move(1)} aria-label="Tuần sau">›</button>
          </div>
        </SectionHeading>

        {shifts.length === 0 ? (
          <EmptyState
            title="Chưa có ca làm việc trong tuần này"
            detail="Xem tuần khác bằng hai nút mũi tên ở trên."
          />
        ) : (
          <div className="table-scroll">
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
                {staff.map((person) => (
                  <tr key={person.id}>
                    <th scope="row">
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

                      return (
                        <td key={day}>
                          <div className={`adm-cell ${off ? 'is-off' : 'is-shift'}`}>
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
        )}
      </Panel>

      <Panel>
        <SectionHeading
          icon={<Icon name="plus" />}
          title="Xếp ca trực tiếp"
          subtitle="Admin chủ động xếp ca, không qua yêu cầu của nhân viên"
        />
        <form className="adm-form" onSubmit={createShift} style={{ padding: '0 16px 16px' }}>
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Nhân viên</span>
              <select value={shiftForm.staffId} onChange={setShift('staffId')} disabled={shiftBusy}>
                <option value="">— Chọn nhân viên —</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>Ngày</span>
              <input type="date" value={shiftForm.date} onChange={setShift('date')} disabled={shiftBusy} />
            </label>
          </div>
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Giờ bắt đầu</span>
              <input type="time" value={shiftForm.start} onChange={setShift('start')} disabled={shiftBusy} />
            </label>
            <label className="adm-field">
              <span>Giờ kết thúc</span>
              <input type="time" value={shiftForm.end} onChange={setShift('end')} disabled={shiftBusy} />
            </label>
          </div>
          <div>
            <button className="button" type="submit" disabled={shiftBusy}>Xếp ca</button>
          </div>
          {shiftMsg && <p className="adm-error">{shiftMsg}</p>}
        </form>

        {weekShifts.length > 0 && (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr><th>Ngày</th><th>Nhân viên</th><th>Giờ</th><th>Lịch</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {weekShifts.map((shift) => (
                  <tr key={shift.id}>
                    <td><strong>{shift.workDate}</strong></td>
                    <td>{shift.staffName}</td>
                    <td>{shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)}</td>
                    <td>{shift.bookingCount} lịch</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button secondary"
                          onClick={() => editShift(shift.id, shift.startTime, shift.endTime)}>
                          Sửa giờ
                        </button>
                        <button className="button secondary" onClick={() => removeShift(shift.id)}>
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
