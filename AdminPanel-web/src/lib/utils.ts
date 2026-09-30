/* ===== Tiện ích dùng chung cho khu vực quản trị =====
   Chỉ giữ những gì các trang Admin thật sự dùng. */

export function fmtNum(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('vi-VN').format(n) : '—';
}

export function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

/** Rút gọn: 5.200.000 ₫ -> "5,2 tr" cho nơi chật chỗ như nhãn thẻ số liệu. */
export function moneyShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} triệu`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return fmtNum(value);
}

export const formatVND = (value: number): string => money(value).replace(/\s/g, ' ');

/** Chỉ nhận ảnh http(s) hoặc đường dẫn /uploads/ — tránh javascript: và nguồn lạ. */
export function safeImage(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return /^https?:\//i.test(value) || /^\/uploads\//.test(value) ? value : '';
}

/** Điểm đánh giá theo kiểu Việt: 4.5 -> "4,5". */
export function fmtRating(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toFixed(1).replace('.', ',');
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0] ?? '').join('');
}

/* ---------- Ngày giờ ---------- */

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** "2026-09-30" -> "T4". */
export function weekdayShort(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : WEEKDAYS[date.getDay()];
}

/** "2026-09-30" -> "30/09/2026". */
export function fmtDay(day: string): string {
  const [year, month, date] = day.split('-');
  return year ? `${date}/${month}/${year}` : day;
}

/** "2026-09-28" -> "28 thg 9". */
export function fmtDayShort(day: string): string {
  const [, month, date] = day.split('-');
  return month ? `${date} thg ${Number(month)}` : day;
}

/** ISO -> "09:30". */
export function fmtTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** ISO -> "30/09/2026". */
export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

/** Số phút kể từ 00:00 của một mốc ISO, theo giờ địa phương.
    Dùng cho lưới lịch: cắt chuỗi ISO sẽ ra giờ UTC nên khối lịch sẽ lệch
    so với cột giờ vẽ bên cạnh. */
export function minutesOfDay(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getHours() * 60 + date.getMinutes();
}

/** Số phút kể từ 00:00 của chuỗi "HH:mm" hoặc "HH:mm:ss". */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

/** "HH:mm" từ số phút kể từ 00:00. */
export function minutesToTime(total: number): string {
  const safe = Math.max(0, total);
  return `${String(Math.floor(safe / 60) % 24).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
