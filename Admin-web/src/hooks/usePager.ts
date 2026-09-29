/* ===== Phân trang dùng chung =====
   Mỗi danh sách dài dùng một khoá riêng. Vị trí trang nằm trong store ngoài
   React để giữ được khi người dùng chuyển qua lại menu. */

import { useCallback, useSyncExternalStore } from 'react';

type PageMap = Record<string, number>;

let store: PageMap = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

/** Báo cho subscriber sau khi render xong — tránh setState giữa lúc render. */
function emitSoon() {
  queueMicrotask(() => listeners.forEach((fn) => fn()));
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function getSnapshot(): PageMap {
  return store;
}

function setPage(key: string, page: number) {
  store = { ...store, [key]: page };
  emit();
}

/** Đưa một hoàn nhiều khoá về trang 1 (khi đổi bộ lọc, tìm kiếm, ngày…).
    Được gọi từ trong reducer, nên chỉ ghi store và báo lại ở microtask kế. */
export function resetPages(...keys: string[]) {
  if (keys.length === 0) { store = {}; emitSoon(); return; }
  const next = { ...store };
  keys.forEach((key) => { next[key] = 1; });
  if (keys.some((key) => store[key] !== 1)) { store = next; emitSoon(); }
}

export interface PageInfo<T> {
  rows: T[];
  page: number;
  pages: number;
  start: number;
  end: number;
  total: number;
}

export function usePager<T>(key: string, rows: T[], size: number): PageInfo<T> & { goTo: (n: number) => void } {
  const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(Number(map[key]) || 1, 1), pages);
  const start = (page - 1) * size;
  const goTo = useCallback((n: number) => setPage(key, n), [key]);
  return {
    rows: rows.slice(start, start + size),
    page,
    pages,
    start,
    total: rows.length,
    end: start + Math.min(size, Math.max(0, rows.length - start)),
    goTo,
  };
}
