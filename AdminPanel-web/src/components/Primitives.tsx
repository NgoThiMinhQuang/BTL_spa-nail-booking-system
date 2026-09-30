/* ===== Thành phần dùng chung của khu vực quản trị =====
   Dùng lại đúng class CSS của app nhân viên (.panel, .section-heading,
   .empty, .svc-stat) để không phát sinh thêm một hệ thiết kế thứ hai. */

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Panel({
  className = '', children, ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return <section className={`panel ${className}`.trim()} {...rest}>{children}</section>;
}

export function SectionHeading({
  icon, title, subtitle, children,
}: {
  icon?: ReactNode; title: string; subtitle?: string; children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{icon && <span className="heading-icon">{icon}</span>}{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Trạng rỗng. `children` là nút hành động, ví dụ "Đặt lại bộ lọc" hay
    "Tạo lịch khách trực tiếp" — trạng không có dữ liệu thì vẫn phải chỉ ra
    được cách thoát ra khỏi nó. */
export function EmptyState({
  title, detail, children,
}: { title: string; detail: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name="flower" /></span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

/** Thẻ số liệu chỉ đọc — dùng lại nguyên bộ .svc-stat của trang Dịch vụ. */
export function StatTile({
  tone, icon, label, value, note,
}: {
  tone: 'rose' | 'sage' | 'gold' | 'lavender';
  icon: IconName; label: string; value: ReactNode; note?: string;
}) {
  return (
    <article className={`svc-stat svc-stat-${tone}`}>
      <span className="svc-stat-icon"><Icon name={icon} /></span>
      <span className="svc-stat-copy">
        <span className="svc-stat-label">{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </span>
    </article>
  );
}

/** Trạng thái lịch hẹn — cùng bảng màu .badge với app nhân viên. */
const STATUS: Record<string, { cls: string; text: string }> = {
  PENDING: { cls: 'pending', text: 'Chờ xác nhận' },
  CONFIRMED: { cls: 'confirmed', text: 'Đã xác nhận' },
  PROCESSING: { cls: 'processing', text: 'Đang thực hiện' },
  COMPLETED: { cls: 'completed', text: 'Hoàn thành' },
  CANCELLED: { cls: 'cancelled', text: 'Đã hủy' },
  NO_SHOW: { cls: 'no_show', text: 'Không đến' },
};

export function StatusBadge({ status }: { status: string }) {
  const item = STATUS[status?.toUpperCase()] ?? { cls: 'pending', text: status ?? '—' };
  return <span className={`badge ${item.cls}`}><i />{item.text}</span>;
}