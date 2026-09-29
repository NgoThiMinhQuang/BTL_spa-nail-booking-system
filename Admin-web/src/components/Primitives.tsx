import type { ReactNode } from 'react';
import type { BookingStatus } from '../types';
import { STATUS_LABELS, statusClass } from '../lib/utils';

export function Badge({ status }: { status: BookingStatus }) {
  return (
    <span className={statusClass(status)}>
      <i />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">▦</span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

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
