/* ===== Lớp trạng thái của KHU VỰC QUẢN TRỊ =====
   Cố tình tách khỏi store nhân viên: hai app chạy ở hai cổng khác nhau và
   dùng hai khoá localStorage khác nhau, nên đăng nhập bên này không ảnh
   hưởng bên kia. */

import {
  createContext, useContext, useEffect, useMemo, useReducer, type ReactNode, type Dispatch,
} from 'react';
import type { Role, AuthUser } from './types';

export type ViewName =
  | 'admin-dashboard' | 'admin-staff' | 'admin-services' | 'admin-bookings'
  | 'admin-customers' | 'admin-work-schedule'
  /* Ba mục trong menu chưa có trang riêng — bấm vào sẽ rơi về Bảng điều khiển. */
  | 'admin-payments' | 'admin-reviews' | 'admin-settings';

/* Khoá riêng của khu vực quản trị, KHÔNG dùng chung với app nhân viên. */
const STORAGE_KEY = 'nailhouse_admin_user';

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialUser = getStoredUser();

/** Lịch hẹn rút gọn — bảng điều khiển chỉ cần trạng thái và giá. */
export interface AdminBooking {
  id: number | string;
  status: string;
  price?: number;
}

export interface AppState {
  user: AuthUser | null;
  role: Role;
  view: ViewName;
  /** Danh sách lịch hẹn dùng để tính tổng quan; rỗng cho tới khi nối API. */
  rangeBookings: AdminBooking[];
  feedback: string;
  loading: boolean;
  /** Tăng mỗi lần làm mới để kích hoạt lại vòng tải. */
  reloadToken: number;
}

export const initialState: AppState = {
  user: initialUser,
  role: 'admin',
  view: 'admin-dashboard',
  rangeBookings: [],
  feedback: '',
  loading: false,
  reloadToken: 0,
};

export type Action =
  | { type: 'login'; user: AuthUser }
  | { type: 'logout' }
  | { type: 'view'; view: ViewName }
  | { type: 'feedback'; message: string }
  | { type: 'loadStart' }
  | { type: 'refresh' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'login':
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(action.user));
      } catch { /* trình duyệt chặn lưu trữ — phiên vẫn dùng được */ }
      return { ...state, user: action.user, role: 'admin', view: 'admin-dashboard' };

    case 'logout':
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch { /* bỏ qua */ }
      return { ...state, user: null, view: 'admin-dashboard' };

    case 'view':
      return { ...state, view: action.view };

    case 'feedback':
      return { ...state, feedback: action.message };

    case 'loadStart':
      return { ...state, loading: true };

    case 'refresh':
      return { ...state, loading: true, reloadToken: state.reloadToken + 1 };

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  activeNav: ViewName;
  reload: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    document.title = 'NailHouse · Quản trị';
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    state,
    dispatch,
    activeNav: state.view,
    reload: () => dispatch({ type: 'refresh' }),
  }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong AppProvider');
  return ctx;
}
