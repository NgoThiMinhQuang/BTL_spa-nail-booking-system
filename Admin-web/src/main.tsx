import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppProvider, useApp } from './store';
import { Layout } from './components/Layout';
import { EmptyState } from './components/Primitives';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { BookingPage } from './pages/BookingPage';
import { CustomersPage, CustomersPageActions } from './pages/CustomersPage';
import { ProfilePage, ServicesPage } from './pages/SimplePages';
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

  if (!data) {
    return (
      <Layout actions={null}>
        {feedback
          ? <EmptyState title="Chưa kết nối được hệ thống" detail={feedback} />
          : <div className="loading">Đang kết nối dữ liệu NailHouse…</div>}
      </Layout>
    );
  }

  const actions = view === 'customers' ? <CustomersPageActions /> : null;

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

  return (
    <Layout actions={actions}>
      {loading && <div className="loading">Đang tải dữ liệu…</div>}
      {!loading && page}
    </Layout>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <Routes />
    </AppProvider>
  </StrictMode>,
);
