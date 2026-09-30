/* ===== Lớp trạng thái của KHU VỰC QUẢN TRỊ =====

   Cố tình tách khỏi store nhân viên: hai app chạy ở hai cổng khác nhau và
   dùng hai khoá localStorage khác nhau, nên đăng nhập bên này không ảnh
   hưởng bên kia.

   Với khu quản trị, dữ liệu được nạp một lần rồi chia sẻ cho mọi trang —
   cùng cách AppProvider của app nhân viên gom tải về một chỗ. Riêng biểu đồ
   doanh thu có nhiều khoảng thời gian nên tách thêm một vòng tải nhỏ. */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState,
  type ReactNode, type Dispatch,
} from 'react';
import type { Role, AuthUser } from './types';

export type ViewName =
  | 'admin-dashboard' | 'admin-bookings' | 'admin-customers'
  | 'admin-services' | 'admin-categories'
  | 'admin-staff' | 'admin-work-schedule' | 'admin-leave'
  | 'admin-payments' | 'admin-reports'
  | 'admin-reviews' | 'admin-settings';

export type ChartRange = '7' | '30' | 'month';

/** Khoá riêng của khu vực quản trị, KHÔNG dùng chung với app nhân viên. */
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
export interface Booking {
  id: string;
  /** Mã hiển thị dựng từ id, ví dụ #BK00125. */
  code: string;
  startsAt: string; endsAt: string;
  status: string; statusText: string;
  note: string | null;
  source: string; sourceText: string;
  cancelReason: string | null; cancelledAt: string | null;
  serviceId: string; serviceName: string; duration: number; price: number;
  customerId: string; customerName: string; customerPhone: string;
  customerAvatarUrl?: string | null;
  staffId: string | null; staffName: string | null; staffAvatarUrl?: string | null;
  paymentStatus: string | null; paymentMethod: string | null;
  paidAmount: number | null; paymentText: string | null; methodText: string | null;
  /** Tổng tiền các dịch vụ phát sinh, chưa tính vào price. */
  addonCount: number; addonTotal: number;
  /** price + addonTotal. */
  total: number;
}

/** Khoảng thời gian của bộ chọn nhanh đầu trang Lịch hẹn. */
export type BookingScope = 'today' | 'tomorrow' | 'week' | 'all';

export interface BookingQuery {
  scope: BookingScope;
  /** YYYY-MM-DD; chỉ dùng khi chọn một ngày cụ thể trong ô lọc Ngày. */
  day: string;
  status: string;
  payment: string;
  source: string;
  staffId: string;
  serviceId: string;
  q: string;
}

/** Đếm nhanh theo trạng thái, phục vụ tab lọc. */
export type BookingCounts = Record<string, number>;

export interface Overview {
  range: string;
  today: {
    total: number; pending: number; confirmed: number;
    processing: number; completed: number; cancelled: number; noShow: number;
  };
  /** Số lịch chờ xác nhận trên toàn bộ hệ thống — việc Admin phải xử lý. */
  pendingAll: number;
  staff: { total: number };
  revenue: { paidAmount: number; depositAmount: number; paidCount: number };
  todayBookings: Booking[];
  staffToday: {
    id: string; name: string; avatarUrl: string | null;
    shiftStart: string | null; shiftEnd: string | null;
    bookingCount: number; servingNow: string | null; nextStart: string | null;
    status: 'FREE' | 'BUSY' | 'UPCOMING' | 'DONE' | 'OFF';
  }[];
  chart: { day: string; bookings: number; revenue: number }[];
  topServices: { id: string; name: string; category: string; bookings: number; revenue: number }[];
  todos: { pending: number; leave: number; unpaid: number; unassigned: number };
}

export interface ServiceItem {
  id: string; name: string; description: string | null;
  price: number; duration: number; bufferTime: number;
  status: 'ACTIVE' | 'HIDDEN'; imageUrl: string | null;
  categoryId: string | null; category: string | null;
  staffCount: number; staffNames: string[];
  bookingCount: number; revenue: number;
  rating: number | null; reviewCount: number;
}

export interface CategoryItem {
  id: string; name: string; description: string | null;
  serviceCount: number; totalPrice: number;
}

export interface StaffItem {
  id: string; name: string; email: string | null; phone: string;
  avatarUrl: string | null; specialty: string | null;
  experienceYears: number; worksToday: boolean;
  bookingCount: number; completedCount: number; revenue: number;
  serviceCount: number; serviceNames: string[];
  rating: number | null; reviewCount: number;
}

export interface CustomerItem {
  id: string; name: string; phone: string; email: string | null;
  avatarUrl: string | null; address: string | null;
  totalSpending: number; noShowCount: number; bookingCount: number;
  lastVisit: string | null; rating: number | null; reviewCount: number;
}

export interface ShiftItem {
  staffId: string; staffName: string; avatarUrl: string | null;
  workDate: string; startTime: string; endTime: string;
  status: 'AVAILABLE' | 'OFF'; bookingCount: number;
}

export interface LeaveItem {
  id: string; workDate: string; startTime: string; endTime: string;
  staffName: string; specialty: string | null; affectedBookings: number;
}

export interface ReviewItem {
  id: string; rating: number; comment: string | null; createdAt: string;
  customerName: string; customerAvatarUrl: string | null;
  staffName: string | null; serviceName: string;
}

export interface PaymentItem {
  id: string; amount: number; paymentMethod: string; paymentStatus: string;
  paymentDate: string | null; bookingId: string; startsAt: string;
  serviceName: string; customerName: string; staffName: string | null;
  methodText: string; statusText: string;
}

export interface Reports {
  byService: { name: string; category: string; bookings: number; revenue: number }[];
  byStaff: { name: string; specialty: string | null; bookings: number; revenue: number }[];
  byCustomer: { name: string; phone: string; bookings: number; spending: number }[];
  totals: { bookings: number; completed: number; cancelled: number; noShow: number; avgMinutes: number };
}

export interface AdminState {
  user: AuthUser | null;
  role: Role;
  view: ViewName;
  loading: boolean;
  feedback: string;
  overview: Overview | null;
  services: ServiceItem[];
  categories: CategoryItem[];
  bookings: Booking[];
  bookingCounts: BookingCounts;
  bookingQuery: BookingQuery;
  staff: StaffItem[];
  customers: CustomerItem[];
  shifts: ShiftItem[];
  leave: LeaveItem[];
  reviews: ReviewItem[];
  reviewStats: { total: number; average: number | null; five: number; four: number; low: number };
  payments: PaymentItem[];
  paymentMonths: { month: string; paidCount: number; paidAmount: number; totalAmount: number }[];
  paymentTotals: { all: number; paid: number; deposit: number; unpaid: number };
  reports: Reports | null;
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
  bookingCounts: { ALL: 0 },
  bookingQuery: {
    scope: 'today', day: '', status: '', payment: '', source: '',
    staffId: '', serviceId: '', q: '',
  },
  staff: [],
  customers: [],
  shifts: [],
  leave: [],
  reviews: [],
  reviewStats: { total: 0, average: null, five: 0, four: 0, low: 0 },
  payments: [],
  paymentMonths: [],
  paymentTotals: { all: 0, paid: 0, deposit: 0, unpaid: 0 },
  reports: null,
  reloadToken: 0,
};

export type Action =
  | { type: 'login'; user: AuthUser }
  | { type: 'logout' }
  | { type: 'view'; view: ViewName }
  | { type: 'loadStart' }
  | { type: 'loadError'; message: string }
  | { type: 'loaded'; payload: Partial<AdminState> }
  | { type: 'bookingQuery'; patch: Partial<BookingQuery> }
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

    case 'bookingQuery':
      return { ...state, bookingQuery: { ...state.bookingQuery, ...action.patch } };

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
  anchorDate: string;
  setAnchorDate: (value: string) => void;
  chartRange: ChartRange;
  setChartRange: (value: ChartRange) => void;
  /** Đổi bộ lọc lịch hẹn; chỉ tải lại danh sách lịch và số đếm. */
  setBookingQuery: (patch: Partial<BookingQuery>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [anchorDate, setAnchorDate] = useState(today);
  const [chartRange, setChartRange] = useState<ChartRange>('7');

  useEffect(() => {
    document.title = 'NailHouse · Quản trị';
  }, []);

  const { reloadToken, user } = state;

  /* Vòng tải chính: mọi nhóm dữ liệu dùng chung cho các trang. */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const week = weekAround(anchorDate);
    dispatch({ type: 'loadStart' });

    (async () => {
      try {
        const [services, staff, customers, shifts, leave, reviews, payments, reports] =
          await Promise.all([
            getJson<{ data: ServiceItem[]; meta: { categories: CategoryItem[] } }>('/services'),
            getJson<{ data: StaffItem[] }>('/staff'),
            getJson<{ data: CustomerItem[] }>('/customers'),
            getJson<{ data: ShiftItem[] }>(`/schedule?from=${week[0]}&to=${week[6]}`),
            getJson<{ data: LeaveItem[] }>('/leave'),
            getJson<{ data: ReviewItem[]; meta: AdminState['reviewStats'] }>('/reviews'),
            getJson<{
              data: PaymentItem[];
              meta: { months: AdminState['paymentMonths']; totals: AdminState['paymentTotals'] };
            }>('/payments'),
            getJson<{ data: Reports }>('/reports'),
          ]);

        if (cancelled) return;
        dispatch({
          type: 'loaded',
          payload: {
            services: services.data,
            categories: services.meta.categories,
            staff: staff.data,
            customers: customers.data,
            shifts: shifts.data,
            leave: leave.data,
            reviews: reviews.data,
            reviewStats: reviews.meta,
            payments: payments.data,
            paymentMonths: payments.meta.months,
            paymentTotals: payments.meta.totals,
            reports: reports.data,
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

  /* Biểu đồ doanh thu tải riêng vì đổi khoảng thời gian không cần tải lại
     cả cửa hàng. */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getJson<{ data: Overview }>(`/overview?range=${chartRange}`)
      .then((result) => {
        if (!cancelled) dispatch({ type: 'loaded', payload: { overview: result.data } });
      })
      .catch(() => { /* lần tải chính sẽ báo lỗi nếu cả API hỏng */ });

    return () => { cancelled = true; };
  }, [reloadToken, user, chartRange]);

  /* Danh sách lịch hẹn tải riêng khỏi phần còn lại: đổi bộ lọc chỉ gọi
     lại đúng hai endpoint này, các trang khác không phải chờ. */
  const { bookingQuery } = state;
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const params = new URLSearchParams();
    if (bookingQuery.scope !== 'all') params.set('scope', bookingQuery.scope);
    if (bookingQuery.day) { params.set('scope', 'all'); params.set('day', bookingQuery.day); }
    for (const [key, value] of Object.entries({
      status: bookingQuery.status,
      payment: bookingQuery.payment,
      source: bookingQuery.source,
      staffId: bookingQuery.staffId,
      serviceId: bookingQuery.serviceId,
      q: bookingQuery.q,
    })) {
      if (value) params.set(key, value);
    }
    const query = params.toString();

    /* Số đếm chỉ đổi theo khoảng thời gian, không đổi theo các bộ lọc còn lại —
       nhờ đó con số trên tab luôn là tổng của khoảng đang xem. Khi chọn một
       ngày cụ thể thì ngày đó thay cho khoảng, nếu không tab sẽ hiện số của
       toàn hệ thống trong khi bảng chỉ có lịch của một ngày. */
    const countParams = new URLSearchParams();
    if (bookingQuery.day) countParams.set('day', bookingQuery.day);
    else countParams.set('scope', bookingQuery.scope);

    Promise.all([
      getJson<{ data: Booking[] }>(`/bookings${query ? `?${query}` : ''}`),
      getJson<{ data: BookingCounts }>(`/bookings/counts?${countParams}`),
    ]).then(([list, counts]) => {
      if (cancelled) return;
      dispatch({ type: 'loaded', payload: { bookings: list.data, bookingCounts: counts.data } });
    }).catch(() => { /* giữ danh sách cũ, lần làm mới sẽ báo nếu cả API hỏng */ });

    return () => { cancelled = true; };
  }, [reloadToken, user, bookingQuery]);

  const reload = useCallback(() => dispatch({ type: 'refresh' }), []);

  const setBookingQuery = useCallback((patch: Partial<BookingQuery>) => {
    dispatch({ type: 'bookingQuery', patch });
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    state,
    dispatch,
    activeNav: state.view,
    reload,
    anchorDate,
    setAnchorDate,
    chartRange,
    setChartRange,
    setBookingQuery,
  }), [state, reload, anchorDate, chartRange, setBookingQuery]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong AppProvider');
  return ctx;
}
