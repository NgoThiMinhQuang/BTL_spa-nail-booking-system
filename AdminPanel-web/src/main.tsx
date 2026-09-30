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
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminStaffPage } from './pages/AdminStaffPage';
import { AdminServicesPage } from './pages/AdminServicesPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';
import { AdminCustomersPage } from './pages/AdminCustomersPage';
import { AdminWorkSchedulePage } from './pages/AdminWorkSchedulePage';
import { AdminReviewsPage } from './pages/AdminReviewsPage';
import { AdminPaymentsPage } from './pages/AdminPaymentsPage';

function Routes() {
  const { state } = useApp();
  const { view } = state;

  /* Màn đăng nhập nằm ngoài khung ứng dụng nên không cần bọc #nailhouse. */
  if (!state.user) return <LoginPage />;

  let page: React.ReactNode;
  if (view === 'admin-staff') page = <AdminStaffPage />;
  else if (view === 'admin-services') page = <AdminServicesPage />;
  else if (view === 'admin-bookings') page = <AdminBookingsPage />;
  else if (view === 'admin-customers') page = <AdminCustomersPage />;
  else if (view === 'admin-work-schedule') page = <AdminWorkSchedulePage />;
  else if (view === 'admin-reviews') page = <AdminReviewsPage />;
  else if (view === 'admin-payments') page = <AdminPaymentsPage />;
  else page = <AdminDashboardPage />;

  return <div id="nailhouse"><AdminLayout>{page}</AdminLayout></div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <Routes />
    </AppProvider>
  </StrictMode>,
);