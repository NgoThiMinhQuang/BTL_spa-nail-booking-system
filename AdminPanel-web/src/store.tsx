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

/* ---- Đường dẫn của trang chi tiết lịch hẹn ----
   Dự án không dùng thư viện định tuyến nên điều hướng bằng hash: URL có dạng
   #/bookings/125, copy lại là mở đúng lịch đó, và nút Back của trình duyệt
   hoạt động như bình thường. */

export const bookingHash = (id: string) => `#/bookings/${id}`;
export const customerHash = (id: string) => `#/customers/${id}`;

/** Đọc mã lịch từ hash, trả về null nếu không ở trang chi tiết. */
export function bookingIdFromHash(hash: string): string | null {
  const match = /^#\/bookings\/(\d+)/.exec(hash);
  return match ? match[1] : null;
}

/** Đọc mã khách hàng từ hash. */
export function customerIdFromHash(hash: string): string | null {
  const match = /^#\/customers\/(\d+)/.exec(hash);
  return match ? match[1] : null;
}

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

/* Token đăng nhập. Key riêng của khu quản trị — xem giải thích ở
   Admin-web/src/lib/auth-fetch.ts: chung key với web nhân viên thì hai
   bên ghi đè nhau vì cùng origin. */
const TOKEN_KEY = 'nailhouse_admin_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* trình duyệt chặn lưu trữ — phiên vẫn dùng được */ }
}

/** Gọi API, tự kèm token và hiện đúng thông báo lỗi của backend. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  /* 401 = token hết hạn hoặc sai vai trò. Xoá token rồi báo sự kiện để giao
     diện đưa người dùng về màn đăng nhập, thay vì để màn hình trắng. */
  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('nailhouse:unauthorized'));
  }

  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? `Máy chủ trả về ${response.status}`);
  return payload as T;
}

function getJson<T>(path: string): Promise<T> {
  return request<T>(path);
}

/** Gọi API ghi dữ liệu (POST/PATCH/DELETE) kèm token. */
export function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
  status: 'ACTIVE' | 'INACTIVE'; imageUrl: string | null;
  categoryId: string | null; category: string | null;
  staffCount: number; staffNames: string[];
  bookingCount: number; revenue: number;
  rating: number | null; reviewCount: number;
}

export interface CategoryItem {
  id: string; name: string; description: string | null;
  serviceCount: number; totalPrice: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface StaffItem {
  id: string; name: string; email: string | null; phone: string;
  avatarUrl: string | null; specialty: string | null;
  experienceYears: number; worksToday: boolean;
  bookingCount: number; completedCount: number; revenue: number;
  serviceCount: number; serviceNames: string[];
  rating: number | null; reviewCount: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CustomerItem {
  id: string;
  /** Mã hiển thị dựng từ id, ví dụ CUS0010. */
  code: string;
  name: string; phone: string; email: string | null;
  avatarUrl: string | null; address: string | null; birthday: string | null;
  /** ACTIVE | INACTIVE — trạng thái tài khoản, khác hẳn trạng thái lịch hẹn. */
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  /* Các chỉ số đều tính trực tiếp từ booking và payment:
     totalSpending chỉ cộng payment có PAID, không đọc cột cache. */
  totalSpending: number; paidCount: number;
  bookingCount: number; completedCount: number;
  cancelledCount: number; noShowCount: number;
  lastVisit: string | null;
}

/** Tổng số liệu của cả danh sách khách, trả về kèm từ API khách hàng. */
export interface CustomerStats {
  total: number; totalSpending: number; noShowCount: number; completedCount: number;
}

export interface ShiftItem {
  id: string;
  staffId: string; staffName: string; avatarUrl: string | null;
  workDate: string; startTime: string; endTime: string;
  status: 'AVAILABLE' | 'OFF'; bookingCount: number;
}

export interface LeaveItem {
  id: string; staffId: string; staffName: string; specialty: string | null;
  startDatetime: string; endDatetime: string; reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null; reviewerName: string | null;
  affectedBookings: number;
  affectedList: {
    id: string; startsAt: string; endsAt: string;
    serviceName: string; customerName: string;
  }[];
}

export interface ScheduleRequestItem {
  id: string; staffId: string; staffName: string; specialty: string | null;
  workDate: string; startTime: string; endTime: string;
  action: 'ADD' | 'UPDATE' | 'REMOVE'; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  affectedBookings: number;
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
  /** Mã lịch đang mở trang chi tiết; null nghĩa là đang ở trang danh sách. */
  bookingDetailId: string | null;
  /** Mã khách đang mở trang chi tiết; null nghĩa là đang ở trang danh sách. */
  customerDetailId: string | null;
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
  /** Tổng số liệu toàn danh sách, để bốn thẻ thống kê không phải cộng lại. */
  customerStats: CustomerStats;
  shifts: ShiftItem[];
  leave: LeaveItem[];
  scheduleRequests: ScheduleRequestItem[];
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

/* Chỉ coi là đã đăng nhập khi còn token. Trước đây chỉ kiểm tra đối tượng
   user trong localStorage — xoá khoá đó là vào được màn hình, dù backend
   đã từ chối hết mọi yêu cầu. */
const initialUser = getToken() ? getStoredUser() : null;
const initialBookingId = bookingIdFromHash(window.location.hash);
const initialCustomerId = customerIdFromHash(window.location.hash);

export const initialState: AdminState = {
  user: initialUser,
  role: 'admin',
  /* Mở thẳng một URL dạng #/bookings/125 thì phải đứng ở mục Lịch hẹn ngay từ
     đầu, không phải Tổng quan — nếu không sidebar và breadcrumb sẽ chỉ sai. */
  bookingDetailId: initialBookingId,
  customerDetailId: initialCustomerId,
  view: initialBookingId ? 'admin-bookings' : initialCustomerId ? 'admin-customers' : 'admin-dashboard',
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
  customerStats: { total: 0, totalSpending: 0, noShowCount: 0, completedCount: 0 },
  shifts: [],
  leave: [],
  scheduleRequests: [],
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
  | { type: 'bookingDetail'; id: string | null }
  | { type: 'customerDetail'; id: string | null }
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
      /* Xoá cả token, nếu không người sau mở lại vẫn dùng phiên cũ. */
      clearToken();
      return { ...initialState };

    case 'view':
      /* Chuyển sang trang khác thì đóng các trang chi tiết đang mở. */
      return { ...state, view: action.view, bookingDetailId: null, customerDetailId: null };

    case 'bookingDetail':
      return {
        ...state,
        bookingDetailId: action.id,
        customerDetailId: null,
        /* Mở chi tiết thì chuyển sang trang lịch hẹn để sidebar và breadcrumb
           khớp với nơi đang xem. */
        view: action.id ? 'admin-bookings' : state.view,
      };

    case 'customerDetail':
      return {
        ...state,
        customerDetailId: action.id,
        bookingDetailId: null,
        view: action.id ? 'admin-customers' : state.view,
      };

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
  /** Mở / đóng trang chi tiết một lịch hẹn; đồng bộ với hash của trình duyệt. */
  openBookingDetail: (id: string) => void;
  closeBookingDetail: () => void;
  /** Mở / đóng trang chi tiết một khách hàng. */
  openCustomerDetail: (id: string) => void;
  closeCustomerDetail: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [anchorDate, setAnchorDate] = useState(today);
  const [chartRange, setChartRange] = useState<ChartRange>('7');

  useEffect(() => {
    document.title = 'NailHouse · Quản trị';
  }, []);

  /* Token chết (request() đã xoá token và bắn sự kiện) → logout state để
     về màn đăng nhập, thay vì kẹt ở trang trắng không dữ liệu. */
  useEffect(() => {
    const onUnauthorized = () => dispatch({ type: 'logout' });
    window.addEventListener('nailhouse:unauthorized', onUnauthorized);
    return () => window.removeEventListener('nailhouse:unauthorized', onUnauthorized);
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
        const [services, staff, customers, shifts, leave, scheduleRequests, reviews, payments, reports] =
          await Promise.all([
            /* Danh mục nằm ở /catalog/services (xem admin.routes.js). Trước đây
         gọi /services không tồn tại nên trang Dịch vụ của Admin trắng. */
      getJson<{ data: ServiceItem[]; meta: { categories: CategoryItem[] } }>('/catalog/services'),
            getJson<{ data: StaffItem[] }>('/staff'),
            getJson<{ data: CustomerItem[]; meta: CustomerStats }>('/customers'),
            getJson<{ data: ShiftItem[] }>(`/schedule?from=${week[0]}&to=${week[6]}`),
            getJson<{ data: LeaveItem[] }>('/leave'),
            getJson<{ data: ScheduleRequestItem[] }>('/schedule-requests'),
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
      customerStats: customers.meta,
            shifts: shifts.data,
            leave: leave.data,
            scheduleRequests: scheduleRequests.data,
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

  /* Đồng bộ hai chiều giữa hash và trạng thái: bấm vào lịch thì hash đổi,
     người dùng bấm nút Back hoặc dán URL thì trang mở đúng lịch đó. */
  const openBookingDetail = useCallback((id: string) => {
    window.location.hash = bookingHash(id);
  }, []);

  const closeBookingDetail = useCallback(() => {
    window.location.hash = '#/bookings';
  }, []);

  const openCustomerDetail = useCallback((id: string) => {
    window.location.hash = customerHash(id);
  }, []);

  const closeCustomerDetail = useCallback(() => {
    window.location.hash = '#/customers';
  }, []);

  /* Đồng bộ hai chiều giữa hash và trạng thái: bấm vào khách thì hash đổi,
     người dùng bấm nút Back hoặc dán URL thì trang mở đúng khách đó. */
  useEffect(() => {
    const sync = () => {
      const bookingId = bookingIdFromHash(window.location.hash);
      if (bookingId) {
        dispatch({ type: 'bookingDetail', id: bookingId });
      } else {
        dispatch({ type: 'bookingDetail', id: null });
        const customerId = customerIdFromHash(window.location.hash);
        dispatch({ type: 'customerDetail', id: customerId });
      }
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
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
    openBookingDetail,
    closeBookingDetail,
    openCustomerDetail,
    closeCustomerDetail,
  }), [state, reload, anchorDate, chartRange, setBookingQuery,
    openBookingDetail, closeBookingDetail, openCustomerDetail, closeCustomerDetail]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong AppProvider');
  return ctx;
}
