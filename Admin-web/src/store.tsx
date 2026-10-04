/* ===== Lớp trạng thái toàn cục của ứng dụng nhân viên =====
   Thay cho đối tượng `state` toàn cục của bản vanilla. Mọi việc gọi API
   tập trung ở AppProvider để chỉ có đúng MỘT vòng tải dữ liệu chạy. */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer,
  useRef, type ReactNode, type Dispatch,
} from 'react';
import type { Dashboard, ServiceItem, Role, AuthUser } from './types';
import { localDate } from './lib/utils';
import { resetPages } from './hooks/usePager';

export type ViewName = 'home' | 'schedule' | 'customers' | 'services' | 'profile' | 'booking';
export type CalendarMode = 'day' | 'week' | 'month';

/* Khoá riêng của app nhân viên, KHÔNG dùng chung với khu vực quản trị —
   đây là nguyên nhân khiến hai app nhảy sang trang của nhau khi tải lại. */
const STORAGE_KEY = 'nailhouse_staff_user';

function getInitialUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialUser = getInitialUser();

export interface AppState {
  user: AuthUser | null;
  role: Role;
  view: ViewName;
  calendarMode: CalendarMode;
  rangeBookings: Dashboard['bookings'];
  date: string;
  staffId: string;
  data: Dashboard | null;
  selected: string | null;
  query: string;
  status: string;
  /** Trang dịch vụ: '' = tất cả. */
  serviceCategory: string;
  serviceStatus: string;
  homeMonth: string;
  customerFilter: string;
  customerSort: string;
  customerId: string | null;
  feedback: string;
  loading: boolean;
  /** Tăng mỗi lần bấm nút làm mới để kích hoạt lại vòng tải. */
  reloadToken: number;
}

export const initialState: AppState = {
  user: initialUser,
  /* App này chỉ dành cho nhân viên; vai trò quản trị thuộc project khác. */
  role: 'staff',
  view: location.hash === '#schedule' ? 'schedule' : 'home',
  calendarMode: 'week',
  rangeBookings: [],
  date: localDate(),
  staffId: initialUser?.id ?? '',
  data: null,
  selected: null,
  query: '',
  status: '',
  serviceCategory: '',
  serviceStatus: '',
  homeMonth: localDate().slice(0, 7),
  customerFilter: 'all',
  customerSort: 'recent',
  customerId: null,
  feedback: '',
  loading: true,
  reloadToken: 0,
};

export type Action =
  | { type: 'login'; user: AuthUser }
  | { type: 'logout' }
  | { type: 'loadStart' }
  | { type: 'loadDone'; data: Dashboard; rangeBookings: Dashboard['bookings']; selected: string | null }
  | { type: 'loadError'; message: string }
  | { type: 'initError'; message: string }
  | { type: 'view'; view: ViewName }
  /** Mở trang lịch và lọc theo trạng thái — dùng bởi mục "Cần chú ý". */
  | { type: 'stat'; status: string }
  | { type: 'booking'; id: string; date: string | null }
  | { type: 'date'; date: string }
  | { type: 'dateField'; date: string }
  | { type: 'today' }
  | { type: 'mode'; mode: CalendarMode }
  | { type: 'homeMonth'; month: string }
  | { type: 'query'; query: string }
  | { type: 'status'; status: string }
  | { type: 'serviceCategory'; value: string }
  | { type: 'serviceStatus'; value: string }
  /** Thêm/sửa xong thì cập nhật tại chỗ, không phải tải lại cả dashboard. */
  | { type: 'serviceSaved'; service: ServiceItem }
  | { type: 'serviceRemoved'; id: number }
  | { type: 'customerFilter'; value: string }
  | { type: 'customerSort'; value: string }
  | { type: 'customerOpen'; id: string | null }
  | { type: 'customerNote'; id: string; note: string | null }
  | { type: 'refresh' };

const ACTIVE_NAV: Record<ViewName, ViewName> = {
  booking: 'schedule', home: 'home', schedule: 'schedule',
  customers: 'customers', services: 'services', profile: 'profile',
};

/** Chọn lịch hẹn hợp lệ đầu tiên (ưu tiên lịch đang thực hiện). */
function pickSelected(bookings: Dashboard['bookings'], current: string | null): string | null {
  const still = bookings.find((b) => String(b.id) === String(current));
  if (still) return String(still.id);
  const running = bookings.find((b) => b.status === 'PROCESSING');
  const fallback = running?.id ?? bookings[0]?.id;
  return fallback === undefined ? null : String(fallback);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'login':
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(action.user));
      } catch {}
      resetPages();
      return {
        ...state,
        user: action.user,
        role: 'staff',
        view: 'home',
        staffId: action.user.id,
      };

    case 'logout':
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      resetPages();
      return {
        ...state,
        user: null,
        view: 'home',
      };

    case 'loadStart':
      return { ...state, loading: true, feedback: '' };

    case 'loadDone':
      return {
        ...state, loading: false, feedback: '',
        data: action.data, rangeBookings: action.rangeBookings, selected: action.selected,
      };

    case 'loadError':
      return { ...state, loading: false, data: null, feedback: action.message };

    case 'initError':
      return { ...state, loading: false, feedback: action.message };

    case 'view':
      resetPages();
      return {
        ...state, view: action.view, query: '', status: '',
        serviceCategory: '', serviceStatus: '',
        customerFilter: 'all', customerSort: 'recent', customerId: null,
      };

    case 'stat':
      resetPages();
      return { ...state, view: 'schedule', calendarMode: 'week', status: action.status, query: '' };

    case 'booking':
      resetPages();
      return { ...state, view: 'booking', selected: String(action.id), date: action.date ?? state.date };

    case 'date':
      resetPages(`schedule-${state.calendarMode}`);
      return { ...state, date: action.date, homeMonth: action.date.slice(0, 7) };

    case 'dateField':
      resetPages(`schedule-${state.calendarMode}`);
      return { ...state, date: action.date, homeMonth: action.date.slice(0, 7) };

    case 'today':
      resetPages(`schedule-${state.calendarMode}`);
      return { ...state, date: localDate(), homeMonth: localDate().slice(0, 7) };

    case 'mode':
      resetPages(`schedule-${action.mode}`);
      return { ...state, calendarMode: action.mode, selected: null };

    case 'homeMonth':
      return { ...state, homeMonth: action.month };

    case 'query':
      resetPages('home', `schedule-${state.calendarMode}`, 'customers', 'services');
      return { ...state, query: action.query };

    case 'status':
      resetPages('home', `schedule-${state.calendarMode}`);
      return { ...state, status: action.status };

    case 'serviceCategory':
      resetPages('services');
      return { ...state, serviceCategory: action.value };

    case 'serviceStatus':
      resetPages('services');
      return { ...state, serviceStatus: action.value };

    case 'serviceSaved': {
      if (!state.data) return state;
      const rest = state.data.services.filter((s) => Number(s.id) !== Number(action.service.id));
      /* ACTIVE xếp trước HIDDEN, cùng thứ tự tên như API trả về. */
      const services = [...rest, action.service]
        .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name, 'vi') : a.status === 'ACTIVE' ? -1 : 1));
      return { ...state, data: { ...state.data, services } };
    }

    case 'serviceRemoved': {
      if (!state.data) return state;
      return {
        ...state,
        data: {
          ...state.data,
          services: state.data.services.filter((s) => Number(s.id) !== Number(action.id)),
        },
      };
    }

    case 'customerFilter':
      resetPages('customers');
      return { ...state, customerFilter: action.value };

    case 'customerSort':
      resetPages('customers');
      return { ...state, customerSort: action.value };

    case 'customerOpen':
      return { ...state, customerId: action.id === null ? null : String(action.id) };

    case 'customerNote': {
      if (!state.data) return state;
      return {
        ...state,
        data: {
          ...state.data,
          customers: state.data.customers.map((c) => (
            String(c.id) === String(action.id) ? { ...c, note: action.note } : c
          )),
        },
      };
    }

    case 'refresh':
      return { ...state, loading: true, feedback: '', reloadToken: state.reloadToken + 1 };

    default:
      return state;
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    signal: options.signal ?? AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => null) as
    { message?: string; data?: T } | null;

  /* 401 = token hết hạn hoặc sai vai trò. Báo rõ để giao diện đưa người
     dùng về màn đăng nhập, thay vì hiện thông báo chung chung. */
  if (response.status === 401) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (!response.ok) throw new Error(payload?.message || 'Không thể tải dữ liệu.');
  return payload?.data as T;
}

/** Các ngày cần gọi API theo chế độ xem lịch. */
export function scheduleDates(anchorDate: string, mode: CalendarMode): string[] {
  const anchor = new Date(`${anchorDate}T12:00:00`);
  let count = 1;
  if (mode === 'week') {
    anchor.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
    count = 7;
  }
  if (mode === 'month') {
    anchor.setDate(1);
    count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  }
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + index);
    return localDate(d);
  });
}

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
  activeNav: ViewName;
  /** Tải lại ngay (không chờ effect). */
  reload: () => void;
}

const AppContext = createContext<Store | null>(null);

/* Nhân viên đang đăng nhập lấy từ token, không phải từ danh sách nhân viên.

   Trước đây vòng tải này gọi GET /api/staff rồi chọn `staff[0].id` — tức là
   người đầu tiên trong danh sách chứ không phải người đã đăng nhập. Nhân viên
   đăng nhập thì thấy tên và lịch của đồng nghiệp khác. Nay không cần danh
   sách này nữa: backend tự xác định ai đang gọi, nên danh tính lấy thẳng từ
   token đã lưu. */
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const seq = useRef(0);

  /* Dashboard: một vòng tải duy nhất, chạy khi đổi nhân viên / ngày / chế độ. */
  const { staffId, date, calendarMode, reloadToken, selected } = state;
  useEffect(() => {
    if (!staffId) return;
    const id = ++seq.current;
    dispatch({ type: 'loadStart' });
    (async () => {
      try {
        const first = await apiRequest<Dashboard>(
          `/api/staff/dashboard?date=${date}`,
        );
        let range = first.bookings;
        if (calendarMode !== 'day') {
          const dates = scheduleDates(date, calendarMode);
          const results: Dashboard[] = [];
          for (let i = 0; i < dates.length; i += 4) {
            results.push(...await Promise.all(
              dates.slice(i, i + 4).map((d) => (
                d === first.date
                  ? Promise.resolve(first)
                  : apiRequest<Dashboard>(
                    `/api/staff/dashboard?date=${d}`,
                  )
              )),
            ));
          }
          range = results
            .flatMap((item) => item.bookings)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        }
        if (id !== seq.current) return;
        dispatch({
          type: 'loadDone',
          data: first,
          rangeBookings: range,
          selected: pickSelected(first.bookings, selected),
        });
      } catch (error) {
        if (id !== seq.current) return;
        dispatch({ type: 'loadError', message: (error as Error).message });
      }
    })();
  }, [staffId, date, calendarMode, reloadToken, selected]);

  const reload = useCallback(() => { dispatch({ type: 'refresh' }); }, []);

  const value = useMemo<Store>(
    () => ({ state, dispatch, activeNav: ACTIVE_NAV[state.view], reload }),
    [state, reload],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong AppProvider');
  return ctx;
}

export { pickSelected };
