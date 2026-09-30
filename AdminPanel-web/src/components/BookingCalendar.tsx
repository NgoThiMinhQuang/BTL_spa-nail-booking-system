/* ===== Lịch hẹn dạng lưới: cột là nhân viên, trục ngang là giờ =====

   Cố tình vẽ trên ca làm việc thật của nhân viên trong ngày (lấy từ
   staff_schedule đã nạp sẵn), chứ không dùng một khung giờ cố định. Nhờ vậy
   Admin thấy đúng phần ca làm việc và phần đã đặt, không lẫn hai thứ với
   nhau: ca làm là lúc nhân viên có mặt, còn khối là lịch khách đã đặt. */

import { useMemo } from 'react';
import { Icon } from './Icon';
import { EmptyState } from './Primitives';
import type { Booking, StaffItem } from '../store';
import { fmtTime, minutesOfDay, minutesToTime, timeToMinutes } from '../lib/utils';

/** Chiều cao một nửa giờ, tính theo px. */
const SLOT_PX = 44;
const PX_PER_MIN = SLOT_PX / 30;

const TONE: Record<string, string> = {
  PENDING: 'is-pending',
  CONFIRMED: 'is-confirmed',
  PROCESSING: 'is-processing',
  COMPLETED: 'is-completed',
  CANCELLED: 'is-cancelled',
  NO_SHOW: 'is-cancelled',
};

export function BookingCalendar({
  bookings, staff, shifts,
}: {
  bookings: Booking[];
  staff: StaffItem[];
  shifts: { staffId: string; workDate: string; startTime: string; endTime: string; status: string }[];
}) {
  /* Ca làm của đúng ngày đang xem. Danh sách lịch đã lọc theo ngày nên lấy
     ngày từ chính những lịch đó; nếu không có lịch nào thì coi như cả ngày. */
  const day = bookings[0]?.startsAt.slice(0, 10);

  const plan = useMemo(() => {
    const byStaff = new Map<string, { from: number; to: number; off: boolean }>();

    if (day) {
      for (const shift of shifts) {
        if (shift.workDate !== day) continue;
        const existing = byStaff.get(shift.staffId);
        const from = timeToMinutes(shift.startTime);
        const to = timeToMinutes(shift.endTime);
        if (existing) {
          existing.from = Math.min(existing.from, from);
          existing.to = Math.max(existing.to, to);
          existing.off = existing.off && shift.status === 'OFF';
        } else {
          byStaff.set(shift.staffId, { from, to, off: shift.status === 'OFF' });
        }
      }
    }

    /* Gộp khung giờ chung của các cột để trục ngang thẳng nhau. */
    let min = Infinity;
    let max = -Infinity;
    for (const item of byStaff.values()) {
      if (item.off) continue;
      min = Math.min(min, item.from);
      max = Math.max(max, item.to);
    }
    if (!Number.isFinite(min)) { min = 8 * 60; max = 20 * 60; }

    const hours: number[] = [];
    for (let h = Math.floor(min / 60); h <= Math.ceil(max / 60); h += 1) hours.push(h * 60);

    const byBooking = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const key = booking.staffId ?? '__none__';
      if (!byBooking.has(key)) byBooking.set(key, []);
      byBooking.get(key)!.push(booking);
    }

    return { byStaff, byBooking, min, max, hours };
  }, [bookings, shifts, day]);

  if (!day) {
    return (
      <EmptyState
        title="Chưa có lịch hẹn trong khoảng đang xem"
        detail="Chọn một ngày khác ở bộ lọc phía trên để xem lịch theo nhân viên."
      />
    );
  }

  const height = (plan.max - plan.min) * PX_PER_MIN;
  const topOf = (minutes: number) => (minutes - plan.min) * PX_PER_MIN;

  const columns = staff.filter((person) => (
    plan.byStaff.has(person.id) || plan.byBooking.has(person.id)
  ));
  const unassigned = plan.byBooking.get('__none__') ?? [];

  return (
    <div className="adm-cal">
      <div className="adm-cal-head">
        <span className="adm-cal-corner" />
        {columns.map((person) => (
          <span key={person.id} className="adm-cal-name">
            <strong>{person.name}</strong>
            <small>{plan.byBooking.get(person.id)?.length ?? 0} lịch</small>
          </span>
        ))}
        {unassigned.length > 0 && (
          <span className="adm-cal-name is-unassigned">
            <strong>Chưa phân công</strong>
            <small>{unassigned.length} lịch</small>
          </span>
        )}
      </div>

      <div className="adm-cal-scroll">
        <div className="adm-cal-body" style={{ gridTemplateColumns: `56px repeat(${columns.length + (unassigned.length ? 1 : 0)}, minmax(170px, 1fr))` }}>
          {/* Cột giờ bên trái */}
          <div className="adm-cal-hours" style={{ height }}>
            {plan.hours.map((minute) => (
              <span key={minute} style={{ top: topOf(minute) }}>
                {minutesToTime(minute)}
              </span>
            ))}
          </div>

          {/* Mỗi cột là một nhân viên */}
          {columns.map((person) => {
            const shift = plan.byStaff.get(person.id);
            const own = plan.byBooking.get(person.id) ?? [];
            return (
              <div key={person.id} className="adm-cal-col" style={{ height }}>
                {/* Vùng ca làm — nền xám nhạt, tách bạch với khối lịch */}
                {shift && !shift.off && (
                  <div className="adm-cal-shift"
                    style={{
                      top: topOf(shift.from),
                      height: (shift.to - shift.from) * PX_PER_MIN,
                    }}>
                    <span>{minutesToTime(shift.from)} – {minutesToTime(shift.to)}</span>
                  </div>
                )}
                {shift?.off && <div className="adm-cal-off">Nghỉ</div>}

                {own.map((booking) => {
                  const start = minutesOfDay(booking.startsAt);
                  const end = minutesOfDay(booking.endsAt);
                  const span = Math.max(end - start, 30);
                  return (
                    <div key={booking.id}
                      className={`adm-cal-block ${TONE[booking.status] ?? ''}`}
                      style={{ top: topOf(start), height: span * PX_PER_MIN - 3 }}
                      title={`${booking.code} · ${booking.customerName} · ${booking.serviceName}`}>
                      <strong>{booking.customerName}</strong>
                      <span>{fmtTime(booking.startsAt)} · {booking.serviceName}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Cột chưa phân công */}
          {unassigned.length > 0 && (
            <div className="adm-cal-col is-unassigned" style={{ height }}>
              {unassigned.map((booking) => {
                const start = minutesOfDay(booking.startsAt);
                const end = minutesOfDay(booking.endsAt);
                const span = Math.max(end - start, 30);
                return (
                  <div key={booking.id} className={`adm-cal-block ${TONE[booking.status] ?? ''}`}
                    style={{ top: topOf(start), height: span * PX_PER_MIN - 3 }}
                    title={`${booking.code} · ${booking.customerName}`}>
                    <strong>{booking.customerName}</strong>
                    <span><Icon name="ban" /> Chưa có nhân viên</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="app-note">
        <Icon name="info" /> Vùng xám là ca làm việc, khối màu là lịch khách đã đặt.
        Lịch chưa phân công nằm ở cột cuối cùng.
      </p>
    </div>
  );
}
