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
import { ProfilePage, ServicesPage } from './pages/SimplePages';

function Routes() {
  const { state } = useApp();
  const { data, loading, view, feedback } = state;

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
  if (view === 'home') page = <HomePage />;
  else if (view === 'schedule') page = <SchedulePage />;
  else if (view === 'customers') page = <CustomersPage />;
  else if (view === 'services') page = <ServicesPage />;
  else if (view === 'profile') page = <ProfilePage />;
  else if (view === 'booking') page = <BookingPage />;

  return (
    <Layout actions={actions}>
      {loading && <div className="loading">Đang tải dữ liệu công việc…</div>}
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
