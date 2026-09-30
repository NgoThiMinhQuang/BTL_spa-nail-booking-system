import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppProvider, useApp } from './store';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { EmptyState } from './components/Primitives';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { BookingPage } from './pages/BookingPage';
import { CustomersPage, CustomersPageActions } from './pages/CustomersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ServicesPage, ServicesPageActions } from './pages/ServicesPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { AdminServicesPage } from './pages/admin/AdminServicesPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminWorkSchedulePage } from './pages/admin/AdminWorkSchedulePage';

function Routes() {
  const { state } = useApp();
  const { data, loading, view, feedback, user } = state;

  // Nếu người dùng chưa đăng nhập -> hiển thị màn hình Đăng nhập (LoginPage)
  if (!user) {
    return <LoginPage />;
  }

  /* Khu vực Admin dùng bộ khung riêng (NAIL STUDIO), khu vực nhân viên dùng
     khung cũ (sidebar hồng NailHouse) — tách file để hai bên không lẫn style. */
  const Shell = user.role === 'admin' ? AdminLayout : Layout;

  /* Chỉ lần đầu chưa có dữ liệu mới hiện màn hình chờ đầy trang. Những lần sau
     (đổi ngày, đổi chế độ xem lịch, đổi nhân viên) giữ nguyên nội dung đang có và
     chỉ báo bằng thanh tiến trình mảnh — tránh trang bị co lại rồi bung ra. */
  if (!data) {
    return (
      <Shell actions={null}>
        {feedback
          ? <EmptyState title="Chưa kết nối được hệ thống" detail={feedback} />
          : <div className="loading">Đang kết nối dữ liệu NailHouse…</div>}
      </Shell>
    );
  }

  let page: React.ReactNode = null;

  // Phân quyền màn hình dựa theo vai trò của tài khoản đã đăng nhập
  if (user.role === 'admin') {
    if (view === 'admin-staff') page = <AdminStaffPage />;
    else if (view === 'admin-services') page = <AdminServicesPage />;
    else if (view === 'admin-bookings') page = <AdminBookingsPage />;
    else if (view === 'admin-customers') page = <AdminCustomersPage />;
    else if (view === 'admin-work-schedule') page = <AdminWorkSchedulePage />;
    else page = <AdminDashboardPage />; // Mặc định cho Admin
  } else {
    if (view === 'schedule') page = <SchedulePage />;
    else if (view === 'customers') page = <CustomersPage />;
    else if (view === 'services') page = <ServicesPage />;
    else if (view === 'profile') page = <ProfilePage />;
    else if (view === 'booking') page = <BookingPage />;
    else page = <HomePage />; // Mặc định cho Nhân viên
  }

  // Nút ở đầu trang: trang Dịch vụ có thêm nút "+ Thêm dịch vụ".
  const actions = view === 'customers' ? <CustomersPageActions />
    : view === 'services' ? <ServicesPageActions />
      : null;

  return (
    <Shell actions={actions}>
      {loading && <div className="app-progress" role="status" aria-label="Đang tải dữ liệu" />}
      {!loading && feedback && <p className="app-feedback">{feedback}</p>}
      {!loading && page}
    </Shell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <Routes />
    </AppProvider>
  </StrictMode>,
);
