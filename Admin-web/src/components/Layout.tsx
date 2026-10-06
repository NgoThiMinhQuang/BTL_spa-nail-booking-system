/* ===== Khung ứng dụng cho NHÂN VIÊN: sidebar + topbar + tiêu đề trang =====
   Giao diện dùng class CSS trong base.css / reference.css / theme.css (sidebar
   hồng, thẻ bo góc, chữ nhỏ) — giữ nguyên như trước khi thêm khu vực Admin.
   Khu vực Admin nằm ở AdminLayout.tsx, tách riêng hoàn toàn. */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useApp, type ViewName } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { Icon, type IconName } from './Icon';
import { AccountMenu } from './AccountMenu';

const NAV: { view: ViewName; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Trang chủ', icon: 'home' },
  { view: 'schedule', label: 'Lịch làm việc', icon: 'schedule' },
  { view: 'customers', label: 'Khách hàng của tôi', icon: 'customers' },
  { view: 'services', label: 'Dịch vụ', icon: 'services' },
  { view: 'profile', label: 'Cá nhân', icon: 'profile' },
];

const TITLES: Record<string, string> = {
  home: 'Trang chủ nhân viên',
  schedule: 'Lịch làm việc',
  customers: 'Khách hàng của tôi',
  services: 'Dịch vụ',
  profile: 'Hồ sơ cá nhân',
  booking: 'Chi tiết lịch hẹn',
};

const DEFAULT_SUBTITLE = 'Chào mừng bạn trở lại! Cùng tạo nên những trải nghiệm tuyệt vời cho khách hàng hôm nay nhé!';

export function Layout({
  children, actions,
}: { children: ReactNode; actions?: ReactNode }) {
  const { state, dispatch, activeNav, reload } = useApp();
  const { goView } = useNavigation();
  const globalSearch = useRef<HTMLInputElement>(null);

  useEffect(() => {
    history.replaceState(null, '', state.view === 'schedule' || state.view === 'booking' ? '#schedule' : location.pathname);
  }, [state.view]);

  /* Đổi trang thì đưa con trỏ về đầu. Nếu giữ nguyên vị trí cuộn cũ, trang mới mở
     ở giữa nội dung nên nhìn như bị nhảy. Chỉ áp dụng khi thật sự đổi trang —
     đổi ngày hay bộ lọc trong cùng trang thì giữ nguyên chỗ đang xem. */
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [state.view]);

  /* home.css và home-layout.css viết toàn bộ style trang chủ dưới phạm vi
     `#nailhouse.staff-home`, nên body phải mang class này khi đang ở trang chủ. */
  useEffect(() => {
    document.body.classList.toggle('staff-home', state.view === 'home');
    return () => document.body.classList.remove('staff-home');
  }, [state.view]);

  const title = state.view === 'home' && state.data
    ? `Xin chào, ${state.data.profile.name}`
    : TITLES[state.view];

  const subtitle = state.view === 'home'
    ? 'Theo dõi lịch hẹn và công việc trong ngày của bạn.'
    : state.view === 'schedule'
      ? 'Quản lý lịch hẹn của bạn, chăm sóc khách hàng thật chu đáo mỗi ngày.'
      : state.view === 'customers'
        ? 'Quản lý thông tin khách hàng đã đặt lịch với bạn.'
        : state.view === 'services'
          ? 'Danh sách dịch vụ tại NailHouse — giá, thời lượng và trạng thái.'
          : state.view === 'profile'
            ? 'Hồ sơ, chuyên môn và ca làm việc của bạn tại NailHouse.'
            : state.view === 'booking'
              ? 'Thông tin chi tiết và trạng thái lịch hẹn'
              : DEFAULT_SUBTITLE;

  const onGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!state.data) return;
    dispatch({ type: 'query', query: globalSearch.current?.value.trim() ?? '' });
    goView('home');
  };

  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="./" aria-label="NailHouse - về trang chủ">
          <span className="brand-mark"><Icon name="flower" /></span>
          <span>Nail<span className="rose">House</span><small>BEAUTY NAILS · BETTER YOU</small></span>
        </a>
        <div className="nav-label">KHÔNG GIAN NHÂN VIÊN</div>
        <nav aria-label="Điều hướng chính">
          {NAV.map((item) => (
            <button
              key={item.view}
              className={activeNav === item.view ? 'active' : ''}
              onClick={() => goView(item.view)}
            >
              <span><Icon name={item.icon} /></span>{item.label}
            </button>
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
              aria-label="Tìm kiếm khách hàng, dịch vụ, lịch hẹn"
              placeholder="Tìm kiếm khách hàng, dịch vụ, lịch hẹn…"
            />
            <button type="submit" aria-label="Tìm kiếm">↵</button>
          </form>
          <div className="account">
            <AccountMenu />
          </div>
        </header>

        <main className={[
          state.view === 'booking' ? 'booking-page' : '',
          state.view === 'schedule' ? 'schedule-page' : '',
        ].filter(Boolean).join(' ')}>
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
                disabled={!state.staffId}
                onClick={() => { if (state.staffId) reload(); }}
              >
                ↻ <span>Làm mới dữ liệu</span>
              </button>
            </div>
          </div>
          <div id="feedback" role="status" aria-live="polite">{state.feedback}</div>
          <div
            id="content"
            aria-busy={state.loading}
            className={state.view === 'home' ? 'home-view' : undefined}
          >
            {children}
          </div>
          <footer>
            NailHouse Studio <span>Chăm sóc bằng cả sự tận tâm.</span>
            <span id="sync-time" />
          </footer>
        </main>
      </div>
    </>
  );
}
