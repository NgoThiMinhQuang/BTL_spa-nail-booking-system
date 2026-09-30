/* ===== KHU VỰC QUẢN TRỊ — điểm vào riêng =====
   Chạy độc lập với app nhân viên: cổng 5174, đường dẫn /admin, và khoá
   localStorage riêng nên đăng nhập hai bên không ảnh hưởng lẫn nhau. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from './store';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './LoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminStaffPage } from './pages/AdminStaffPage';
import { AdminServicesPage } from './pages/AdminServicesPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';
import { AdminCustomersPage } from './pages/AdminCustomersPage';
import { AdminWorkSchedulePage } from './pages/AdminWorkSchedulePage';

function Routes() {
  const { state } = useApp();
  const { view } = state;

  if (!state.user) return <LoginPage />;

  let page: React.ReactNode;
  if (view === 'admin-staff') page = <AdminStaffPage />;
  else if (view === 'admin-services') page = <AdminServicesPage />;
  else if (view === 'admin-bookings') page = <AdminBookingsPage />;
  else if (view === 'admin-customers') page = <AdminCustomersPage />;
  else if (view === 'admin-work-schedule') page = <AdminWorkSchedulePage />;
  else page = <AdminDashboardPage />;

  return <AdminLayout>{page}</AdminLayout>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <Routes />
    </AppProvider>
  </StrictMode>,
);
