/* ===== Tiện ích dùng chung cho khu vực quản trị =====
   Chỉ giữ những gì các trang Admin thật sự dùng. */

export function fmtNum(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('vi-VN').format(n) : '—';
}

export function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

export const formatVND = (value: number): string => money(value).replace(/\s/g, ' ');

/** Chỉ nhận ảnh http(s) hoặc đường dẫn /uploads/ — tránh javascript: và nguồn lạ. */
export function safeImage(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return /^https?:\//i.test(value) || /^\/uploads\//.test(value) ? value : '';
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0] ?? '').join('');
}
