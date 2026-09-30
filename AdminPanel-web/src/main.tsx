/* ===== KHU VỰC QUẢN TRỊ — điểm vào riêng =====
   Chạy độc lập với app nhân viên: cổng 5174, đường dẫn /admin, và khoá
   localStorage riêng nên đăng nhập hai bên không ảnh hưởng lẫn nhau.

   Toàn bộ giao diện được bọc trong <div id="nailhouse"> vì các lớp màu và cỡ chữ
   của theme.css / density.css đều gắn tiền tố này — nhờ đó khu quản trị dùng
   đúng bảng màu của app nhân viên. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppProvider, useApp } from './store';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './LoginPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminCustomersPage } from './pages/AdminCustomersPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminLeavePage } from './pages/AdminLeavePage';
import { AdminPaymentsPage } from './pages/AdminPaymentsPage';
import { AdminReportsPage } from './pages/AdminReportsPage';
import { AdminReviewsPage } from './pages/AdminReviewsPage';
import { AdminServicesPage } from './pages/AdminServicesPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminStaffPage } from './pages/AdminStaffPage';
import { AdminWorkSchedulePage } from './pages/AdminWorkSchedulePage';

function Routes() {
  const { state } = useApp();
  const { view } = state;

  /* Màn đăng nhập nằm ngoài khung ứng dụng nên không cần bọc #nailhouse. */
  if (!state.user) return <LoginPage />;

  let page: React.ReactNode;
  if (view === 'admin-bookings') page = <AdminBookingsPage />;
  else if (view === 'admin-customers') page = <AdminCustomersPage />;
  else if (view === 'admin-services') page = <AdminServicesPage />;
  else if (view === 'admin-categories') page = <AdminCategoriesPage />;
  else if (view === 'admin-staff') page = <AdminStaffPage />;
  else if (view === 'admin-work-schedule') page = <AdminWorkSchedulePage />;
  else if (view === 'admin-leave') page = <AdminLeavePage />;
  else if (view === 'admin-payments') page = <AdminPaymentsPage />;
  else if (view === 'admin-reports') page = <AdminReportsPage />;
  else if (view === 'admin-reviews') page = <AdminReviewsPage />;
  else if (view === 'admin-settings') page = <AdminSettingsPage />;
  else page = <AdminDashboardPage />;

  /* Đường dẫn bên trong thẻ vì Dashboard là trang chủ của khu quản trị. */
  const breadcrumb = view === 'admin-dashboard'
    ? ['Trang chủ', 'Tổng quan']
    : undefined;

  return <div id="nailhouse"><AdminLayout breadcrumb={breadcrumb}>{page}</AdminLayout></div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <Routes />
    </AppProvider>
  </StrictMode>,
);
