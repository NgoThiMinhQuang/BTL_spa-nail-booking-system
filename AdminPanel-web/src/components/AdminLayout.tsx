/* ===== Khung ứng dụng đồng bộ 100% với ảnh thiết kế NAIL STUDIO ===== */

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useApp, type ViewName } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { Icon, type IconName } from './Icon';
import { Avatar } from './Avatar';

interface NavGroup {
  title?: string;
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
      { view: 'admin-customers', label: 'Khách hàng', icon: 'adminCustomers' },
      { view: 'admin-work-schedule', label: 'Lịch làm việc', icon: 'clock' },
      { view: 'admin-payments', label: 'Thanh toán & Doanh thu', icon: 'dollar' },
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

export function AdminLayout({ children }: { children: ReactNode; actions?: ReactNode }) {
  const { state, dispatch, activeNav } = useApp();
  const { goView } = useNavigation();
  const globalSearch = useRef<HTMLInputElement>(null);

  const navGroups = ADMIN_GROUPS;

  const onGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    goView('admin-bookings');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC', fontFamily: 'var(--font-sans)' }}>
      {/* LEFT SIDEBAR: Clean White with Pink Active Pills */}
      <aside style={{
        width: '260px',
        minWidth: '260px',
        background: '#FFFFFF',
        borderRight: '1px solid #F1F5F9',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 20px',
        boxSizing: 'border-box'
      }}>
        <div>
          {/* Logo Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#EC4899',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="flower" />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', color: '#0F172A', textTransform: 'uppercase' }}>
              NAIL STUDIO
            </span>
          </div>

          {/* Navigation Groups */}
          <nav aria-label="Main Navigation">
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} style={{ marginBottom: '24px' }}>
                {group.title && (
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: '#94A3B8',
                    marginBottom: '12px',
                    paddingLeft: '12px',
                    textTransform: 'uppercase'
                  }}>
                    {group.title}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {group.items.map((item) => {
                    const isActive = activeNav === item.view;
                    return (
                      <button
                        key={item.view}
                        onClick={() => goView(item.view)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '24px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#FFFFFF' : '#64748B',
                          background: isActive ? 'linear-gradient(90deg, #ec4899 0%, #e11d48 100%)' : 'transparent',
                          boxShadow: isActive ? '0 4px 14px rgba(236, 72, 153, 0.35)' : 'none',
                          transition: 'all 0.2s ease',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <Icon name={item.icon} />
                        </span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Studio Status Bottom Card */}
        <div style={{
          background: '#FFF0F5',
          borderRadius: '16px',
          padding: '16px',
          marginTop: 'auto'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
            Cửa hàng đang mở
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            Hôm nay · 09:00 - 20:00
          </div>
        </div>
      </aside>

      {/* RIGHT WORKSPACE AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP HEADER BAR */}
        <header style={{
          height: '76px',
          background: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 36px',
          boxSizing: 'border-box'
        }}>
          {/* Rounded Global Search Input */}
          <form onSubmit={onGlobalSearch} style={{ flex: 1, maxWidth: '420px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
              ⌕
            </span>
            <input
              ref={globalSearch}
              placeholder="Tìm kiếm lịch hẹn, khách hàng, dịch vụ..."
              style={{
                width: '100%',
                padding: '10px 16px 10px 42px',
                borderRadius: '24px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: '13px',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </form>

          {/* Right Controls: Bell, Admin Info, Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Notification Bell */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              cursor: 'pointer'
            }}>
              <Icon name="bell" />
            </div>

            {/* Profile Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '24px', border: '1px solid #E2E8F0' }}>
              <Avatar name={state.user?.name || 'Admin'} url={state.user?.avatar || null} size={32} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                  {state.user?.name || 'Quản lý Admin'}
                </span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Quản lý Cửa hàng
                </span>
              </div>
              <button
                onClick={() => dispatch({ type: 'logout' })}
                title="Đăng xuất"
                style={{
                  background: '#FEE2E2',
                  color: '#DC2626',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: '4px'
                }}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        {/* MAIN BODY CONTENT */}
        <main style={{ flex: 1, padding: '0 36px 36px', boxSizing: 'border-box', overflowY: 'auto', maxWidth: 'none', margin: 0 }}>
          <div id="feedback" role="status" aria-live="polite">{state.feedback}</div>
          <div id="content" aria-busy={state.loading}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
