/* ===== Trang dịch vụ: lọc, thống kê, nhãn trạng thái ===== */

import { useMemo } from 'react';
import { fmtNum, money } from './utils';
import type { ServiceItem, ServiceStatus } from '../types';

export const UNGROUPED = 'Khác';

export const STATUS_META: { key: ServiceStatus | ''; label: string }[] = [
  { key: '', label: 'Tất cả' },
  { key: 'ACTIVE', label: 'Đang cung cấp' },
  { key: 'HIDDEN', label: 'Tạm ngưng' },
];

export const statusLabel = (status: ServiceStatus | string): string =>
  STATUS_META.find((s) => s.key === status)?.label ?? 'Đang cung cấp';

/** Mã hiển thị trên thẻ: DV001, DV002… */
export const serviceCode = (id: number): string => `DV${String(id).padStart(3, '0')}`;

/** Dịch vụ chưa gán danh mục gom chung một mục "Khác". */
export const categoryOf = (s: ServiceItem): string => s.category?.trim() || UNGROUPED;

export function servicesFiltered(
  all: ServiceItem[],
  { query, category, status }: { query: string; category: string; status: string },
): ServiceItem[] {
  const q = query.trim().toLocaleLowerCase('vi');
  return all.filter((s) => {
    if (status && s.status !== status) return false;
    if (category && categoryOf(s) !== category) return false;
    if (!q) return true;
    return `${s.name} ${s.description ?? ''} ${categoryOf(s)}`.toLocaleLowerCase('vi').includes(q);
  });
}

export interface ServiceStats {
  total: number;
  active: number;
  hidden: number;
  avgPrice: string;
}

export function serviceStats(all: ServiceItem[]): ServiceStats {
  const active = all.filter((s) => s.status === 'ACTIVE').length;
  const avg = all.length
    ? all.reduce((sum, s) => sum + Number(s.price ?? 0), 0) / all.length
    : 0;
  return {
    total: all.length,
    active,
    hidden: all.length - active,
    avgPrice: all.length ? money(Math.round(avg)) : '—',
  };
}

/** Danh mục kèm số lượng, nhiều dịch vụ nhất lên đầu. */
export function serviceCategories(all: ServiceItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  all.forEach((s) => {
    const key = categoryOf(s);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

export const useServiceStats = (all: ServiceItem[]): ServiceStats => useMemo(() => serviceStats(all), [all]);
export const useServiceCategories = (all: ServiceItem[]) => useMemo(() => serviceCategories(all), [all]);

export { fmtNum };
