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
  const { shifts, staff, scheduleRequests } = state;

  const week = weekAround(anchorDate);
  const isThisWeek = week[0] <= today() && today() <= week[6];

  /* Gom ca theo (nhân viên, ngày): một ngày có thể có nhiều ca. */
  const byStaffDay = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = `${shift.staffId}|${shift.workDate}`;
    const list = byStaffDay.get(key);
    if (list) list.push(shift);
    else byStaffDay.set(key, [shift]);
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
    </>
  );
}
