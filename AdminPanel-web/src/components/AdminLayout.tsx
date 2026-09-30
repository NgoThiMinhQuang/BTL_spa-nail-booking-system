/* ===== Khung ứng dụng của KHU VỰC QUẢN TRỊ =====
   Dùng đúng bộ class của app nhân viên (sidebar, topbar, page-heading, panel)
   để hai bên nhìn như một sản phẩm: cùng nền kem, sidebar hồng, chữ 11–13px.
   Khác app nhân viên ở chỗ có thêm nhóm menu và nhãn "Khu vực quản trị". */

import { useEffect, useRef } from 'react';
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
    title: 'TỔNG QUAN',
    items: [
      { view: 'admin-dashboard', label: 'Bảng điều khiển', icon: 'adminDashboard' },
    ],
  },
  {
    title: 'QUẢN LÝ CỬA HÀNG',
    items: [
      { view: 'admin-bookings', label: 'Lịch hẹn', icon: 'schedule' },
      { view: 'admin-services', label: 'Dịch vụ', icon: 'services' },
      { view: 'admin-staff', label: 'Nhân viên', icon: 'adminStaff' },
      { view: 'admin-customers', label: 'Khách hàng', icon: 'customers' },
      { view: 'admin-work-schedule', label: 'Lịch làm việc', icon: 'clock' },
      { view: 'admin-payments', label: 'Doanh thu', icon: 'dollar' },
      { view: 'admin-reviews', label: 'Đánh giá', icon: 'star' },
    ],
  },
  {
    title: 'HỆ THỐNG',
    items: [
      { view: 'admin-settings', label: 'Cài đặt', icon: 'settings' },
    ],
  },
];

/* Tiêu đề + phụ đề do khung đảm nhiệm, giống hệt app nhân viên — các trang
   không tự viết lại <h1> nữa. */
const TITLES: Record<ViewName, [string, string]> = {
  'admin-dashboard': ['Bảng điều khiển', 'Tổng quan hoạt động của cửa hàng hôm nay.'],
  'admin-bookings': ['Lịch hẹn', 'Toàn bộ lịch hẹn của cửa hàng, theo dõi và cập nhật trạng thái.'],
  'admin-services': ['Dịch vụ', 'Danh mục dịch vụ, bảng giá và quy định đặt cọc.'],
  'admin-staff': ['Nhân viên', 'Quản lý hồ sơ, chuyên môn và ca làm việc của nhân sự.'],
  'admin-customers': ['Khách hàng', 'Danh sách khách hàng đã và đang sử dụng dịch vụ.'],
  'admin-work-schedule': ['Lịch làm việc', 'Ca làm việc của toàn bộ nhân viên trong tuần.'],
  'admin-payments': ['Thanh toán & Doanh thu', 'Theo dõi doanh thu và các giao dịch của cửa hàng.'],
  'admin-reviews': ['Đánh giá', 'Phản hồi của khách hàng sau mỗi buổi chăm sóc.'],
  'admin-settings': ['Cài đặt', 'Thông tin cửa hàng và tùy chọn hệ thống.'],
};

export function AdminLayout({
  children, actions,
}: { children: ReactNode; actions?: ReactNode }) {
  const { state, dispatch, activeNav, reload } = useApp();
  const { goView } = useNavigation();
  const globalSearch = useRef<HTMLInputElement>(null);

  /* Đổi trang thì đưa con trỏ về đầu, nếu không trang mới mở ở giữa nội dung
     nên nhìn như bị nhảy. */
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [state.view]);

  const [title, subtitle] = TITLES[state.view] ?? TITLES['admin-dashboard'];

  const onGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    goView('admin-bookings');
  };

  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="./" aria-label="NailHouse - về bảng điều khiển">
          <span className="brand-mark"><Icon name="flower" /></span>
          <span>Nail<span className="rose">House</span><small>BEAUTY NAILS · BETTER YOU</small></span>
        </a>
        <div className="nav-label">KHU VỰC QUẢN TRỊ</div>
        <nav aria-label="Điều hướng quản trị">
          {ADMIN_GROUPS.map((group) => (
            <div key={group.title} style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
              <p className="nav-label" style={{ margin: '0 12px' }}>{group.title}</p>
              {group.items.map((item) => (
                <button
                  key={item.view}
                  className={activeNav === item.view ? 'active' : ''}
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
          <form className="global-search" onSubmit={onGlobalSearch}>
            <span aria-hidden="true">⌕</span>
            <input
              ref={globalSearch}
              aria-label="Tìm kiếm lịch hẹn, khách hàng"
              placeholder="Tìm kiếm lịch hẹn, khách hàng…"
            />
            <button type="submit" aria-label="Tìm kiếm">↵</button>
          </form>
          {/* Khối tài khoản xếp theo thứ tự ngược: reference.css đặt
              .account{flex-direction:row-reverse}, nên khai báo DOM ngược lại
              để hiển thị ra là avatar — tên — đăng xuất. */}
          <div className="account">
            <button className="text-button" onClick={() => dispatch({ type: 'logout' })}>
              Đăng xuất
            </button>
            <select id="admin-name" aria-label="Tài khoản đang đăng nhập" defaultValue="admin">
              <option value="admin">{state.user?.name ?? 'Quản lý NailHouse'}</option>
            </select>
            <label htmlFor="admin-name">Quản trị viên</label>
            <span className="account-avatar">
              <Avatar name={state.user?.name ?? 'Quản lý'} url={state.user?.avatar ?? null} size={36} />
            </span>
          </div>
        </header>

        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">MỖI NGÀY, MỘT CHÚT CHĂM CHÚT</p>
              <h1 id="page-title">{title}</h1>
              <p className="subtitle" id="page-subtitle">{subtitle}</p>
            </div>
            <div className="page-heading-actions">
              {actions}
              <button
                id="refresh"
                aria-label="Làm mới dữ liệu"
                className="button secondary"
                onClick={reload}
              >
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
    </>
  );
}