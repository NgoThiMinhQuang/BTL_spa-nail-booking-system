/* ===== Khung ứng dụng của KHU VỰC QUẢN TRỊ =====

   Dùng đúng bộ class của app nhân viên (sidebar, topbar, page-heading, panel)
   để hai bên nhìn như một sản phẩm. Menu chia 5 nhóm theo mục đích nghiệp vụ:
   Quản lý, Dịch vụ, Nhân viên, Tài chính, Khác. */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp, type ViewName } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { Icon, type IconName } from './Icon';
import { Avatar } from './Avatar';

interface NavGroup {
  title: string;
  items: { view: ViewName; label: string; icon: IconName }[];
}

const ADMIN_GROUPS: NavGroup[] = [
  {
    title: 'QUẢN LÝ',
    items: [
      { view: 'admin-dashboard', label: 'Tổng quan', icon: 'adminDashboard' },
      { view: 'admin-bookings', label: 'Lịch hẹn', icon: 'schedule' },
      { view: 'admin-customers', label: 'Khách hàng', icon: 'customers' },
    ],
  },
  {
    title: 'DỊCH VỤ',
    items: [
      { view: 'admin-services', label: 'Dịch vụ', icon: 'services' },
      { view: 'admin-categories', label: 'Danh mục', icon: 'tag' },
    ],
  },
  {
    title: 'NHÂN VIÊN',
    items: [
      { view: 'admin-staff', label: 'Nhân viên', icon: 'adminStaff' },
      { view: 'admin-work-schedule', label: 'Lịch làm việc', icon: 'clock' },
      { view: 'admin-leave', label: 'Yêu cầu nghỉ', icon: 'pause' },
    ],
  },
  {
    title: 'TÀI CHÍNH',
    items: [
      { view: 'admin-payments', label: 'Thanh toán', icon: 'card' },
      { view: 'admin-reports', label: 'Báo cáo', icon: 'sparkles' },
    ],
  },
  {
    title: 'KHÁC',
    items: [
      { view: 'admin-reviews', label: 'Đánh giá', icon: 'star' },
      { view: 'admin-settings', label: 'Cài đặt', icon: 'settings' },
    ],
  },
];

/* Tiêu đề + phụ đề do khung đảm nhiệm, giống hệt app nhân viên — các trang
   không tự viết lại <h1> nữa. */
const TITLES: Record<ViewName, [string, string]> = {
  'admin-dashboard': ['Tổng quan', 'Tình hình hoạt động của cửa hàng hôm nay.'],
  'admin-bookings': ['Lịch hẹn', 'Toàn bộ lịch hẹn của cửa hàng, theo dõi và cập nhật trạng thái.'],
  'admin-customers': ['Khách hàng', 'Danh sách khách hàng đã và đang sử dụng dịch vụ.'],
  'admin-services': ['Dịch vụ', 'Danh mục dịch vụ, bảng giá và quy định đặt cọc.'],
  'admin-categories': ['Danh mục dịch vụ', 'Nhóm các dịch vụ cùng chủ đề để khách dễ tìm.'],
  'admin-staff': ['Nhân viên', 'Hồ sơ, chuyên môn và khối lượng công việc của nhân sự.'],
  'admin-work-schedule': ['Lịch làm việc', 'Ca làm việc của toàn bộ nhân viên trong tuần.'],
  'admin-leave': ['Yêu cầu nghỉ', 'Các ngày nhân viên đã xếp nghỉ và ảnh hưởng tới lịch hẹn.'],
  'admin-payments': ['Thanh toán', 'Theo dõi doanh thu và từng giao dịch của cửa hàng.'],
  'admin-reports': ['Báo cáo', 'Tổng hợp doanh thu theo dịch vụ, nhân viên và khách hàng.'],
  'admin-reviews': ['Đánh giá', 'Phản hồi của khách hàng sau mỗi buổi chăm sóc.'],
  'admin-settings': ['Cài đặt', 'Thông tin cửa hàng và kiểm tra tính đầy đủ của dữ liệu.'],
};

export function AdminLayout({
  children, actions, breadcrumb, hideHeading,
}: {
  children: ReactNode;
  actions?: ReactNode;
  /** Ghi đè breadcrumb khi trang con có đường dẫn riêng. */
  breadcrumb?: string[];
  /** Trang con tự có tiêu đề riêng thì ẩn tiêu đề chung để không hiện hai lần. */
  hideHeading?: boolean;
}) {
  const { state, dispatch, activeNav, reload } = useApp();
  const { goView } = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Đổi mật khẩu: trước đây nút này chỉ đóng menu chứ không mở gì cả.
     Nay mở hộp thoại gọi PUT /api/auth/password thật. */
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next.length < 6) {
      setPwMsg('Mật khẩu mới cần ít nhất 6 ký tự.');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg('Nhập lại mật khẩu mới chưa khớp.');
      return;
    }
    setPwBusy(true);
    setPwMsg('');
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setPwMsg(payload?.message ?? 'Không đổi được mật khẩu.');
        return;
      }
      setPwForm({ current: '', next: '', confirm: '' });
      setPwMsg('OK');
    } catch {
      setPwMsg('Mất kết nối tới máy chủ.');
    } finally {
      setPwBusy(false);
    }
  }

  /* Đóng menu tài khoản khi bấm ra ngoài hoặc nhấn Esc. */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const [title, subtitle] = TITLES[state.view] ?? TITLES['admin-dashboard'];
  const trail = breadcrumb ?? ['Trang chủ', title];

  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="./" aria-label="NailHouse - về tổng quan">
          <span className="brand-mark"><Icon name="flower" /></span>
          <span>Nail<span className="rose">House</span><small>BEAUTY NAILS · BETTER YOU</small></span>
        </a>

        <nav aria-label="Điều hướng quản trị">
          {ADMIN_GROUPS.map((group) => (
            <div key={group.title} className="nav-group">
              <p className="nav-label">{group.title}</p>
              {group.items.map((item) => (
                <button
                  key={item.view}
                  className={activeNav === item.view ? 'active' : ''}
                  aria-current={activeNav === item.view ? 'page' : undefined}
                  onClick={() => goView(item.view)}
                >
                  <span><Icon name={item.icon} /></span>{item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-note"><span>♥</span><p>Làm đẹp<br />Mỗi ngày<br />Là một niềm vui!</p></div>
        <div className="sidebar-footer">
          <p>“Những bàn tay xinh đẹp<br />Tạo nên những ngày hạnh phúc”</p>
          <span>— &nbsp; NailHouse &nbsp; —</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            {trail.map((item, index) => (
              <span key={item} className={index === trail.length - 1 ? 'is-current' : undefined}>
                {item}{index < trail.length - 1 ? '' : ''}
              </span>
            ))}
          </div>

          <div className="account">
            {/* reference.css đặt .account là row-reverse nên thứ tự trong
                DOM bị đảo: khai báo tài khoản trước, chuông sau thì hiển thị
                ra là chuông rồi tới tài khoản. */}
            <div className="adm-user" ref={menuRef}>
              <button
                className="adm-user-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Avatar name={state.user?.name ?? 'Quản lý'} url={state.user?.avatar ?? null} size={32} />
                <span className="adm-user-text">
                  <strong>{state.user?.name ?? 'Quản lý NailHouse'}</strong>
                  <small>Quản trị viên</small>
                </span>
                <Icon name="chevronDown" className="adm-user-caret" />
              </button>

              {menuOpen && (
                <div className="adm-menu" role="menu">
                  <button role="menuitem" onClick={() => { setMenuOpen(false); goView('admin-settings'); }}>
                    <Icon name="user" /> Hồ sơ cá nhân
                  </button>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); setPwMsg(''); setPwOpen(true); }}>
                    <Icon name="shield" /> Đổi mật khẩu
                  </button>
                  <button role="menuitem" className="is-danger"
                    onClick={() => dispatch({ type: 'logout' })}>
                    <Icon name="ban" /> Đăng xuất
                  </button>
                </div>
              )}
            </div>

            <button className="adm-bell" aria-label="Thông báo">
              <Icon name="bell" />
              {state.reviewStats.total > 0 && <i />}
            </button>
          </div>
        </header>

        <main>
          {/* Trang con có tiêu đề riêng thì chỉ giữ nút làm mới dữ liệu, tránh
              hai khối tiêu đề cạnh nhau. */}
          <div className="page-heading">
            {hideHeading ? <span /> : (
              <div>
                <p className="eyebrow">MỖI NGÀY, MỘT CHÚT CHĂM CHÚT</p>
                <h1 id="page-title">{title}</h1>
                <p className="subtitle" id="page-subtitle">{subtitle}</p>
              </div>
            )}
            <div className="page-heading-actions">
              {actions}
              <button id="refresh" aria-label="Làm mới dữ liệu"
                className="button secondary" onClick={reload}>
                ↻ <span>Làm mới dữ liệu</span>
              </button>
            </div>
          </div>
          <div id="feedback" role="status" aria-live="polite">{state.feedback}</div>
          <div id="content" aria-busy={state.loading}>{children}</div>
          <footer>
            NailHouse Studio <span>Khu vực quản trị — cùng một cửa hàng.</span>
          </footer>
        </main>
      </div>

      {pwOpen && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setPwOpen(false)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Đổi mật khẩu</h3>
            <form className="adm-form" onSubmit={submitPassword}>
              <label className="adm-field">
                <span>Mật khẩu hiện tại</span>
                <input type="password" value={pwForm.current}
                  onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                  disabled={pwBusy} autoComplete="current-password" />
              </label>
              <label className="adm-field">
                <span>Mật khẩu mới (ít nhất 6 ký tự)</span>
                <input type="password" value={pwForm.next}
                  onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                  disabled={pwBusy} autoComplete="new-password" />
              </label>
              <label className="adm-field">
                <span>Nhập lại mật khẩu mới</span>
                <input type="password" value={pwForm.confirm}
                  onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                  disabled={pwBusy} autoComplete="new-password" />
              </label>
              {pwMsg && (
                <p className={pwMsg === 'OK' ? 'adm-ok' : 'adm-error'}>
                  {pwMsg === 'OK' ? 'Đã đổi mật khẩu.' : pwMsg}
                </p>
              )}
              <div className="adm-modal-foot">
                <button className="button secondary" type="button" disabled={pwBusy}
                  onClick={() => setPwOpen(false)}>Đóng</button>
                <button className="button" type="submit" disabled={pwBusy}>
                  {pwBusy ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
