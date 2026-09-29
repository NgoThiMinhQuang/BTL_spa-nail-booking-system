/* ===== Tiện ích dùng chung (chuyển từ app.js sang) ===== */

import type { BookingStatus } from '../types';

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không đến',
};

export const STATUS_ORDER: BookingStatus[] = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
];

/** Ngày hôm nay theo giờ địa phương, dạng 'YYYY-MM-DD'. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

export const formatVND = money;

export function fmtNum(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('vi-VN').format(n) : '—';
}

export function longDate(date: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

/** Chỉ nhận ảnh http(s) hoặc đường dẫn /uploads/ — tránh javascript: và nguồn lạ. */
export function safeImage(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return /^https?:\//i.test(value) || /^\/uploads\//.test(value) ? value : '';
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0] ?? '').join('');
}

export function statusClass(status: BookingStatus): string {
  return `badge ${status.toLowerCase()}`;
}

/** 'DD/MM/YYYY' -> 'YYYYMMDD' để so sánh ngày dạng chuỗi. */
export function vnDateToSortable(value: string): string {
  const parts = value.split('/');
  return parts.length === 3 ? `${parts[2]}${parts[1]}${parts[0]}` : '';
}

/** Tải file CSV, có BOM để Excel đọc đúng tiếng Việt. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const body = rows.map((row) => row.map((cell) => {
    const text = String(cell ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
