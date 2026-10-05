import { Component, type ReactNode } from 'react';
import type { BookingStatus } from '../types';
import { STATUS_LABELS, statusClass } from '../lib/utils';

/* Lưới an toàn cho các khung bật lên (drawer, modal): lỗi render bên
   trong chỉ hiện thông báo trong khung, không bao giờ thành trang trắng
   toàn màn hình khiến người dùng tưởng treo máy. */
export class SafeArea extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[SafeArea]', error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="empty">
          <span className="empty-icon">⚠</span>
          <h3>Không hiển thị được nội dung này</h3>
          <p>Vui lòng đóng lại rồi thử lại. Nếu vẫn lỗi, chụp màn hình Konsole (F12) gửi quản trị.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

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
