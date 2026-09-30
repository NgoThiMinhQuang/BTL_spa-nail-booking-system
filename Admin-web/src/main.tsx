import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppProvider, useApp } from './store';
import { Layout } from './components/Layout';
import { EmptyState } from './components/Primitives';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { BookingPage } from './pages/BookingPage';
import { CustomersPage, CustomersPageActions } from './pages/CustomersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ServicesPage, ServicesPageActions } from './pages/ServicesPage';

function Routes() {
  const { state } = useApp();
  const { data, loading, view, feedback } = state;

  /* Chỉ lần đầu chưa có dữ liệu mới hiện màn hình chờ đầy trang. Những lần sau
     (đổi ngày, đổi chế độ xem lịch, đổi nhân viên) giữ nguyên nội dung đang có và
     chỉ báo bằng thanh tiến trình mảnh — tránh trang bị co lại rồi bung ra. */
  if (!data) {
    return (
      <Layout actions={null}>
        {feedback
          ? <EmptyState title="Chưa kết nối được hệ thống" detail={feedback} />
          : <div className="loading">Đang kết nối dữ liệu NailHouse…</div>}
      </Layout>
    );
  }

  let page: React.ReactNode = null;
  if (view === 'home') page = <HomePage />;
  else if (view === 'schedule') page = <SchedulePage />;
  else if (view === 'customers') page = <CustomersPage />;
  else if (view === 'services') page = <ServicesPage />;
  else if (view === 'profile') page = <ProfilePage />;
  else if (view === 'booking') page = <BookingPage />;

  return (
    <Layout actions={
      view === 'customers' ? <CustomersPageActions />
        : view === 'services' ? <ServicesPageActions />
          : null
    }>
      {loading && <div className="app-progress" role="status" aria-label="Đang tải dữ liệu" />}
      {feedback && <p className="app-feedback">{feedback}</p>}
      {page}
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
