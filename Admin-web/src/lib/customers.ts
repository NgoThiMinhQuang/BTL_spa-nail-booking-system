/* ===== Ngân kê khách hàng: lọc, sắp xếp, xuất CSV ===== */

import { useMemo } from 'react';
import { fmtNum, vnDateToSortable } from '../lib/utils';
import type { CustomerSummary } from '../types';

export const LOYAL_VISITS = 5;
export const RETURNING_VISITS = 2;

export const SEGMENTS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'loyal', label: 'Thân thiết' },
  { key: 'returning', label: 'Quay lại' },
  { key: 'new', label: 'Mới' },
];

export const SORTS = [
  { key: 'recent', label: 'Mới nhất' },
  { key: 'visits', label: 'Nhiều lượt nhất' },
  { key: 'rating', label: 'Đánh giá cao nhất' },
  { key: 'name', label: 'Tên A–Z' },
];

/* Danh sách dùng `visits` (lượt của nhân viên đang xem), hồ sơ trong drawer
   dùng `totalVisits` (tất cả) — nên ưu tiên totalVisits khi có. */
export const visitCount = (c: CustomerSummary | { totalVisits?: number; visits?: number }) =>
  Number((c as { totalVisits?: number }).totalVisits ?? (c as { visits?: number }).visits) || 0;

export const isLoyal = (c: CustomerSummary) => visitCount(c) >= LOYAL_VISITS;

export type Tier = { key: 'loyal' | 'returning' | 'new'; label: string };

export function customerTier(c: CustomerSummary | { totalVisits?: number; visits?: number }): Tier {
  const n = visitCount(c);
  if (n >= LOYAL_VISITS) return { key: 'loyal', label: 'Thân thiết' };
  if (n >= RETURNING_VISITS) return { key: 'returning', label: 'Quay lại' };
  return { key: 'new', label: 'Khách mới' };
}

/* Chỉ so với phần trước "@" của email để "mai" trong "gmail.com"
   không khớp oan mọi khách. Câu tìm cũng được cắt tương ứng. */
const emailLocal = (value: string | null | undefined) =>
  String(value ?? '').split('@')[0].trim().toLocaleLowerCase('vi');

export function customersFiltered(
  all: CustomerSummary[],
  { query, filter, sort }: { query: string; filter: string; sort: string },
): CustomerSummary[] {
  const q = query.includes('@') ? emailLocal(query) : query.trim().toLocaleLowerCase('vi');
  let rows = q
    ? all.filter((c) => `${c.name} ${c.phone} ${emailLocal(c.email)}`.toLocaleLowerCase('vi').includes(q))
    : [...all];

  if (filter === 'loyal') rows = rows.filter(isLoyal);
  if (filter === 'returning') rows = rows.filter((c) => visitCount(c) >= RETURNING_VISITS && !isLoyal(c));
  if (filter === 'new') rows = rows.filter((c) => visitCount(c) < RETURNING_VISITS);

  const byRecent = (a: CustomerSummary, b: CustomerSummary) =>
    vnDateToSortable(b.lastVisit).localeCompare(vnDateToSortable(a.lastVisit));

  if (sort === 'visits') return rows.sort((a, b) => b.visits - a.visits || byRecent(a, b));
  if (sort === 'rating') return rows.sort((a, b) => (b.rating - a.rating) || (b.visits - a.visits));
  if (sort === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return rows.sort(byRecent);
}

export interface CustomerStats {
  total: number;
  loyal: number;
  returning: number;
  avgRating: string;
  reviewTotal: number;
}

export function customerStats(all: CustomerSummary[]): CustomerStats {
  const rated = all.filter((c) => c.rating > 0);
  const avg = rated.length
    ? (rated.reduce((sum, c) => sum + c.rating, 0) / rated.length).toFixed(1)
    : '—';
  return {
    total: all.length,
    loyal: all.filter(isLoyal).length,
    returning: all.filter((c) => c.visits >= RETURNING_VISITS).length,
    avgRating: avg,
    reviewTotal: rated.reduce((sum, c) => sum + c.reviewCount, 0),
  };
}

/* Thống kê dùng useMemo trong trang để không tính lại mỗi lần render con. */
export function useCustomerStats(all: CustomerSummary[]): CustomerStats {
  return useMemo(() => customerStats(all), [all]);
}

export { fmtNum };
