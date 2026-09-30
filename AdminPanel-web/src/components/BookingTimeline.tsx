/* ===== Lịch sử hoạt động của lịch hẹn =====

   Mỗi dòng là một mốc đã thật sự xảy ra trong database, kèm ai làm và
   vai trò của người đó. Những chuyển trạng thái trong quá khứ không có
   dấu vết thời gian nên không được bịa ra — danh sách chỉ hiện những gì hệ
   thống thật sự ghi nhận. */

import { Icon, type IconName } from './Icon';

export interface BookingEvent {
  id: string;
  type: string;
  detail: string | null;
  actorRole: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'SYSTEM';
  actorName: string | null;
  createdAt: string;
}

const ROLE_TEXT: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  ADMIN: 'Quản trị',
  SYSTEM: 'Hệ thống',
};

/** Mỗi loại sự kiện dùng một biểu tượng và một màu để quét nhanh. */
const LOOK: Record<string, { icon: IconName; tone: string }> = {
  CREATED: { icon: 'calendar', tone: 'is-info' },
  CONFIRMED: { icon: 'check', tone: 'is-ok' },
  RESCHEDULED: { icon: 'clock', tone: 'is-info' },
  STAFF_CHANGED: { icon: 'adminStaff', tone: 'is-info' },
  SERVICE_STARTED: { icon: 'play', tone: 'is-gold' },
  SERVICE_COMPLETED: { icon: 'done', tone: 'is-ok' },
  CANCELLED: { icon: 'ban', tone: 'is-bad' },
  NO_SHOW: { icon: 'ban', tone: 'is-bad' },
  PAYMENT: { icon: 'card', tone: 'is-ok' },
  ADDON_ADDED: { icon: 'plus', tone: 'is-gold' },
  ADDON_REMOVED: { icon: 'trash', tone: 'is-muted' },
  NOTE: { icon: 'tag', tone: 'is-info' },
};

const timeOf = (iso: string) => {
  const date = new Date(iso);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
};

const dayOf = (iso: string) => {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};

export function BookingTimeline({ events }: { events: BookingEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="adm-field-note">
        Chưa có mốc nào được ghi nhận cho lịch hẹn này.
      </p>
    );
  }

  /* Nhóm theo ngày để một ngày có nhiều thao tác không bị tách rời rạc. */
  const groups: { day: string; items: BookingEvent[] }[] = [];
  for (const event of events) {
    const day = dayOf(event.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(event);
    else groups.push({ day, items: [event] });
  }

  return (
    <div className="adm-timeline">
      {groups.map((group) => (
        <section key={group.day}>
          <h5>{group.day}</h5>
          <ol>
            {group.items.map((event) => {
              const look = LOOK[event.type] ?? { icon: 'info' as IconName, tone: 'is-muted' };
              return (
                <li key={event.id} className={look.tone}>
                  <span className="adm-timeline-dot"><Icon name={look.icon} /></span>
                  <div>
                    <p>{event.detail ?? ROLE_TEXT[event.type] ?? event.type}</p>
                    <small>
                      {timeOf(event.createdAt)} · {event.actorName ?? 'Hệ thống'}
                      <em>{ROLE_TEXT[event.actorRole] ?? event.actorRole}</em>
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
