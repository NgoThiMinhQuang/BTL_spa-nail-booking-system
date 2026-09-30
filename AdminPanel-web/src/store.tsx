/* ===== Lớp trạng thái của KHU VỰC QUẢN TRỊ =====

   Cố tình tách khỏi store nhân viên: hai app chạy ở hai cổng khác nhau và
   dùng hai khoá localStorage khác nhau, nên đăng nhập bên này không ảnh
   hưởng bên kia.

   Với khu quản trị, dữ liệu được nạp một lần rồi chia sẻ cho mọi trang —
   cùng cách AppProvider của app nhân viên gom tải về một chỗ. */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState,
  type ReactNode, type Dispatch,
} from 'react';
import type { Role, AuthUser } from './types';

export type ViewName =
  | 'admin-dashboard' | 'admin-staff' | 'admin-services' | 'admin-bookings'
  | 'admin-customers' | 'admin-work-schedule'
  | 'admin-payments' | 'admin-reviews' | 'admin-settings';

/* Khoá riêng của khu vực quản trị, KHÔNG dùng chung với app nhân viên. */
const STORAGE_KEY = 'nailhouse_admin_user';

/** Hôm nay theo định dạng YYYY-MM-DD, tính theo giờ máy người dùng. */
export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Ngày trong tuần (thứ hai là đầu tuần) quanh ngày neo, trả về 7 chuỗi. */
export function weekAround(anchor: string): string[] {
  const base = new Date(`${anchor}T00:00:00`);
  /* getDay() 0 = chủ nhật; đổi sang thứ hai = 0. */
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  });
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Máy chủ trả về ${response.status}`);
  return (await response.json()) as T;
}

/* ================================================================
   Kiểu dữ liệu
   ================================================================ */
export interface Overview {
  today: { total: number; pending: number; confirmed: number; processing: number; completed: number };
  staff: { total: number; onShift: number };
  revenue: { paidAmount: number; depositAmount: number; paidCount: number };
  chart: { day: string; bookings: number; revenue: number }[];
  upcoming: {
    id: string; startsAt: string; status: string; serviceName: string;
    customerName: string; staffName: string | null; duration: number; price: number;
  }[];
  topServices: { id: string; name: string; category: string; bookings: number; revenue: number }[];
}

export interface AdminService {
  id: string; name: string; description: string | null;
  price: number; duration: number; bufferTime: number;
  status: 'ACTIVE' | 'HIDDEN'; imageUrl: string | null;
  categoryId: string | null; category: string | null;
  staffCount: number; staffNames: string[];
  bookingCount: number; revenue: number;
  rating: number | null; reviewCount: number;
}

export interface AdminBooking {
  id: string; startsAt: string; endsAt: string; status: string; note: string | null;
  serviceId: string; serviceName: string; duration: number; price: number;
  customerId: string; customerName: string; customerPhone: string;
  staffId: string | null; staffName: string | null;
  paymentStatus: string | null; paymentMethod: string | null;
  paidAmount: number | null; paymentText: string | null; methodText: string | null;
}

export interface AdminStaff {
  id: string; name: string; email: string | null; phone: string;
  avatarUrl: string | null; specialty: string | null;
  experienceYears: number; worksToday: boolean;
  bookingCount: number; completedCount: number; revenue: number;
  serviceCount: number; serviceNames: string[];
  rating: number | null; reviewCount: number;
}

export interface AdminCustomer {
  id: string; name: string; phone: string; email: string | null;
  avatarUrl: string | null; address: string | null;
  totalSpending: number; noShowCount: number; bookingCount: number;
  lastVisit: string | null; rating: number | null; reviewCount: number;
}

export interface AdminShift {
  staffId: string; staffName: string; avatarUrl: string | null;
  workDate: string; startTime: string; endTime: string;
  status: 'AVAILABLE' | 'OFF'; bookingCount: number;
}

export interface AdminReview {
  id: string; rating: number; comment: string | null; createdAt: string;
  customerName: string; customerAvatarUrl: string | null;
  staffName: string | null; serviceName: string;
}

export interface AdminPayment {
  id: string; amount: number; paymentMethod: string; paymentStatus: string;
  paymentDate: string | null; bookingId: string; startsAt: string;
  serviceName: string; customerName: string; staffName: string | null;
  methodText: string; statusText: string;
}

export interface AdminState {
  user: AuthUser | null;
  role: Role;
  view: ViewName;
  loading: boolean;
  feedback: string;
  overview: Overview | null;
  services: AdminService[];
  categories: { id: string; name: string; serviceCount: number }[];
  bookings: AdminBooking[];
  staff: AdminStaff[];
  customers: AdminCustomer[];
  shifts: AdminShift[];
  reviews: AdminReview[];
  reviewStats: { total: number; average: number | null; five: number; four: number; low: number };
  payments: AdminPayment[];
  paymentMonths: { month: string; paidCount: number; paidAmount: number; totalAmount: number }[];
  paymentTotals: { all: number; paid: number; deposit: number; unpaid: number };
  /** Tăng mỗi lần làm mới để kích hoạt lại vòng tải. */
  reloadToken: number;
}

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialUser = getStoredUser();

export const initialState: AdminState = {
  user: initialUser,
  role: 'admin',
  view: 'admin-dashboard',
  loading: false,
  feedback: '',
  overview: null,
  services: [],
  categories: [],
  bookings: [],
  staff: [],
  customers: [],
  shifts: [],
  reviews: [],
  reviewStats: { total: 0, average: null, five: 0, four: 0, low: 0 },
  payments: [],
  paymentMonths: [],
  paymentTotals: { all: 0, paid: 0, deposit: 0, unpaid: 0 },
  reloadToken: 0,
};

export type Action =
  | { type: 'login'; user: AuthUser }
  | { type: 'logout' }
  | { type: 'view'; view: ViewName }
  | { type: 'loadStart' }
  | { type: 'loadError'; message: string }
  | { type: 'loaded'; payload: Partial<AdminState> }
  | { type: 'refresh' };

export function reducer(state: AdminState, action: Action): AdminState {
  switch (action.type) {
    case 'login':
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(action.user));
      } catch { /* trình duyệt chặn lưu trữ — phiên vẫn dùng được */ }
      return { ...initialState, user: action.user, reloadToken: 1 };

    case 'logout':
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch { /* bỏ qua */ }
      return { ...initialState };

    case 'view':
      return { ...state, view: action.view };

    case 'loadStart':
      return { ...state, loading: true, feedback: '' };

    case 'loadError':
      return { ...state, loading: false, feedback: action.message };

    case 'loaded':
      return { ...state, loading: false, feedback: '', ...action.payload };

    case 'refresh':
      return { ...state, loading: true, feedback: '', reloadToken: state.reloadToken + 1 };

    default:
      return state;
  }
}

interface AppContextValue {
  state: AdminState;
  dispatch: Dispatch<Action>;
  activeNav: ViewName;
  /** Làm mới dữ liệu — nút ở đầu trang và sau khi đổi trạng thái lịch hẹn. */
  reload: () => void;
  /** Ngày neo của màn lịch làm việc, luôn khớp với tuần đang xem. */
  anchorDate: string;
  setAnchorDate: (value: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [anchorDate, setAnchorDate] = useState(today);

  useEffect(() => {
    document.title = 'NailHouse · Quản trị';
  }, []);

  /* Vòng tải duy nhất: gọi song song mọi nhóm dữ liệu của khu quản trị rồi
     đổ vào store. Nhờ vậy các trang chỉ việc đọc, không tự fetch lại. */
  const { reloadToken, user } = state;
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const week = weekAround(anchorDate);
    dispatch({ type: 'loadStart' });

    (async () => {
      try {
        const [overview, services, bookings, staff, customers, shifts, reviews, payments] =
          await Promise.all([
            getJson<{ data: Overview }>('/overview'),
            getJson<{ data: AdminService[]; meta: { categories: AdminState['categories'] } }>('/services'),
            getJson<{ data: AdminBooking[] }>('/bookings'),
            getJson<{ data: AdminStaff[] }>('/staff'),
            getJson<{ data: AdminCustomer[] }>('/customers'),
            getJson<{ data: AdminShift[] }>(`/schedule?from=${week[0]}&to=${week[6]}`),
            getJson<{ data: AdminReview[]; meta: AdminState['reviewStats'] }>('/reviews'),
            getJson<{
              data: AdminPayment[];
              meta: { months: AdminState['paymentMonths']; totals: AdminState['paymentTotals'] };
            }>('/payments'),
          ]);

        if (cancelled) return;
        dispatch({
          type: 'loaded',
          payload: {
            overview: overview.data,
            services: services.data,
            categories: services.meta.categories,
            bookings: bookings.data,
            staff: staff.data,
            customers: customers.data,
            shifts: shifts.data,
            reviews: reviews.data,
            reviewStats: reviews.meta,
            payments: payments.data,
            paymentMonths: payments.meta.months,
            paymentTotals: payments.meta.totals,
          },
        });
      } catch (error) {
        if (cancelled) return;
        dispatch({
          type: 'loadError',
          message: error instanceof Error ? error.message : 'Không tải được dữ liệu.',
        });
      }
    })();

    return () => { cancelled = true; };
  }, [reloadToken, user, anchorDate]);

  const reload = useCallback(() => dispatch({ type: 'refresh' }), []);

  const value = useMemo<AppContextValue>(() => ({
    state,
    dispatch,
    activeNav: state.view,
    reload,
    anchorDate,
    setAnchorDate,
  }), [state, reload, anchorDate]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong AppProvider');
  return ctx;
}
