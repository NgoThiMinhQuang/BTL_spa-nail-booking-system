/* ===== Trang Lịch làm việc của quản trị =====
   Ma trận tuần dựng từ bảng staff_schedule: mỗi dòng một nhân viên, mỗi cột một
   ngày. Ô trống là ngày không có ca; ô có ca ghi rõ giờ và số lịch hẹn đã nhận. */

import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp, today, weekAround } from '../store';
import { fmtDayShort, timeToMinutes, weekdayShort } from '../lib/utils';

export function AdminWorkSchedulePage() {
  const { state, anchorDate, setAnchorDate } = useApp();
  const { shifts, staff } = state;

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
