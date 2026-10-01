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
    const byBooking = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const key = booking.staffId ?? '__none__';
      if (!byBooking.has(key)) byBooking.set(key, []);
      byBooking.get(key)!.push(booking);
    }
    
    for (const ownBookings of byBooking.values()) {
      const sorted = [...ownBookings].sort((a, b) => minutesOfDay(a.startsAt) - minutesOfDay(b.startsAt));
      let nextAvailableMinute = 0;
      for (const booking of sorted) {
        const originalStart = minutesOfDay(booking.startsAt);
        let span = booking.duration;
        if (!span || span <= 0) span = minutesOfDay(booking.endsAt) - originalStart;
        span = Math.max(span, 30);
        
        const start = Math.max(originalStart, nextAvailableMinute);
        const end = start + span;
        nextAvailableMinute = end;
        
        min = Math.min(min, start);
        max = Math.max(max, end);
      }
    }
    
    if (!Number.isFinite(min)) { min = 8 * 60; max = 20 * 60; }

    const hours: number[] = [];
    for (let m = Math.floor(min / 30) * 30; m <= Math.ceil(max / 30) * 30; m += 30) {
      hours.push(m);
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
    <>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', padding: '14px 16px', background: '#FCF8FA', borderRadius: '12px', border: '1px solid var(--nh-line)', alignItems: 'center', width: 'fit-content' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--nh-ink)', marginRight: '8px' }}>
          <Icon name="tag" /> Phân loại màu sắc:
        </strong>
        <div style={{ padding: '5px 12px', borderRadius: '8px', background: 'var(--nh-gold-soft)', border: '1px solid var(--nh-gold)', color: '#8A6A24', fontSize: '11.5px', fontWeight: 600 }}>
          Chờ xác nhận
        </div>
        <div style={{ padding: '5px 12px', borderRadius: '8px', background: 'var(--nh-lavender-soft)', border: '1px solid var(--nh-lavender)', color: '#5D4770', fontSize: '11.5px', fontWeight: 600 }}>
          Đã xác nhận
        </div>
        <div style={{ padding: '5px 12px', borderRadius: '8px', background: '#FBE8ED', border: '1px solid var(--nh-primary)', color: '#8A4E60', fontSize: '11.5px', fontWeight: 600 }}>
          Đang phục vụ
        </div>
        <div style={{ padding: '5px 12px', borderRadius: '8px', background: 'var(--nh-sage-soft)', border: '1px solid var(--nh-sage)', color: '#3D6656', fontSize: '11.5px', fontWeight: 600 }}>
          Đã hoàn thành
        </div>
        <div style={{ padding: '5px 12px', borderRadius: '8px', background: '#F2EEEF', border: '1px solid #B6A3AB', color: '#8A7B80', fontSize: '11.5px', fontWeight: 600 }}>
          Đã hủy / Vắng mặt
        </div>
      </div>

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

                {(() => {
                  const sorted = [...own].sort((a, b) => minutesOfDay(a.startsAt) - minutesOfDay(b.startsAt));
                  let nextAvailableMinute = 0;

                  return sorted.map((booking) => {
                    const originalStart = minutesOfDay(booking.startsAt);
                    let span = booking.duration;
                    if (!span || span <= 0) span = minutesOfDay(booking.endsAt) - minutesOfDay(booking.startsAt);
                    span = Math.max(span, 30);
                    
                    const start = Math.max(originalStart, nextAvailableMinute);
                    nextAvailableMinute = start + span;
                    
                    return (
                      <div key={booking.id}
                        className={`adm-cal-block ${TONE[booking.status] ?? ''}`}
                        style={{
                          top: topOf(start),
                          height: span * PX_PER_MIN - 3,
                          left: '7px',
                          right: '7px',
                          zIndex: 1,
                        }}
                        title={`${booking.code} · ${booking.customerName} · ${booking.serviceName}`}>
                        <strong>{booking.customerName}</strong>
                        <span>{fmtTime(booking.startsAt)} · {booking.serviceName}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            );
          })}

          {/* Cột chưa phân công */}
          {unassigned.length > 0 && (
            <div className="adm-cal-col is-unassigned" style={{ height }}>
              {(() => {
                const sorted = [...unassigned].sort((a, b) => minutesOfDay(a.startsAt) - minutesOfDay(b.startsAt));
                let nextAvailableMinute = 0;

                return sorted.map((booking) => {
                  const originalStart = minutesOfDay(booking.startsAt);
                  let span = booking.duration;
                  if (!span || span <= 0) span = minutesOfDay(booking.endsAt) - minutesOfDay(booking.startsAt);
                  span = Math.max(span, 30);
                  
                  const start = Math.max(originalStart, nextAvailableMinute);
                  nextAvailableMinute = start + span;
                  
                  return (
                    <div key={booking.id} className={`adm-cal-block ${TONE[booking.status] ?? ''}`}
                      style={{
                        top: topOf(start),
                        height: span * PX_PER_MIN - 3,
                        left: '7px',
                        right: '7px',
                        zIndex: 1,
                      }}
                      title={`${booking.code} · ${booking.customerName}`}>
                      <strong>{booking.customerName}</strong>
                      <span><Icon name="ban" /> Chưa có nhân viên</span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      <p className="app-note" style={{ marginTop: '12px' }}>
        <Icon name="info" /> Vùng xám trên lịch là ca làm việc. Lịch chưa phân công nằm ở cột cuối cùng.
      </p>
    </div>
    </>
  );
}
