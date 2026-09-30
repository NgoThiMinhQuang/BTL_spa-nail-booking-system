/* ===== Lịch trong ngày dạng dải thời gian =====
   Thay bảng danh sách: cột giờ bên trái, lịch hẹn xếp theo giờ bắt đầu và kéo
   dài đúng thời lượng. Nhân viên nhìn là thấy "hôm nay mình làm gì, mấy giờ".
   Nếu có lịch hẹn chồng nhau (dữ liệu nhập tay) thì tự tách sang làn bên cạnh
   để không đè lên nhau. */

import { useMemo } from 'react';
import { Icon } from './Icon';
import { EmptyState } from './Primitives';
import { localDate, STATUS_LABELS } from '../lib/utils';
import type { Booking, Shift } from '../types';

/* 68px cho một giờ: khối 60 phút (hầu hết dịch vụ) đủ chỗ cho cả ba dòng
   tên · dịch vụ · giờ, không bị cắt chữ. */
const HOUR_H = 68;
const MIN_BLOCK = 30;     /* khối thấp nhất để vẫn đọc được tên */
/* Ngưỡng chiều cao để bớt dòng thay vì để chữ bị cắt:
   ≥ 67px hiện đủ 3 dòng (cần ~66px) · ≥ 49px bỏ dịch vụ (cần ~48px)
   · thấp hơn chỉ còn tên. */
const H_FULL = 67;
const H_SHORT = 49;

function toMin(hhmmText: string) {
  const [h, m] = hhmmText.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesOf(stamp: string) {
  return toMin(stamp.split(' ')[1] ?? '00:00');
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

interface Block {
  b: Booking;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** Chia các khối theo giờ, gán làn sao cho không khối nào chồng khối khác. */
function layout(books: Booking[], from: number): Block[] {
  const blocks: Block[] = books.map((b) => {
    const start = Math.max(minutesOf(b.startsAt), from);
    const end = Math.max(minutesOf(b.endsAt), start + 15);
    return { b, start, end, lane: 0, lanes: 1 };
  }).sort((x, y) => x.start - y.start || x.end - y.end);

  const placed: Block[] = [];
  for (const cur of blocks) {
    let lane = 0;
    while (placed.some((p) => p.lane === lane && overlaps(p, cur))) lane += 1;
    cur.lane = lane;
    placed.push(cur);
  }
  /* Các khối chồng nhau phải dùng chung số làn để bề rộng đồng đều. */
  for (const cur of placed) {
    const peers = placed.filter((o) => overlaps(o, cur));
    const n = Math.max(...peers.map((p) => p.lane)) + 1;
    for (const p of peers) p.lanes = n;
  }
  return placed;
}

export function DayTimeline({
  rows, shifts, date, selected, onOpen,
}: {
  rows: Booking[];
  shifts: Shift[];
  date: string;
  selected: string | number | null;
  onOpen: (id: string) => void;
}) {
  /* Khung giờ: lấy theo ca làm việc nếu có, nếu không thì theo lịch hẹn trong ngày. */
  const { from, to } = useMemo(() => {
    const shift = shifts.find((s) => s.date === date && s.status !== 'CANCELLED');
    const starts = rows.map((b) => minutesOf(b.startsAt));
    const ends = rows.map((b) => minutesOf(b.endsAt));
    const lo = shift ? toMin(shift.start) : (starts.length ? Math.min(...starts) : 8 * 60);
    const hi = shift ? toMin(shift.end) : (ends.length ? Math.max(...ends) : 18 * 60);
    return {
      from: Math.min(Math.floor(lo / 60) * 60, ...(starts.length ? starts : [8 * 60])),
      to: Math.max(Math.ceil(hi / 60) * 60, ...(ends.length ? ends : [17 * 60])),
    };
  }, [rows, shifts, date]);

  const blocks = useMemo(() => layout(rows, from), [rows, from]);
  const span = Math.max(to - from, 60);
  const hours = Math.ceil(span / 60) + 1;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = localDate(now) === date && nowMin >= from && nowMin <= to;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Chưa có lịch hẹn trong ngày"
        detail="Chọn ngày khác, hoặc bấm «Hôm nay» để xem lịch đang làm."
      />
    );
  }

  return (
    <div className="tl">
      {/* Cột giờ bên trái */}
      <div className="tl-gutter" aria-hidden="true">
        {Array.from({ length: hours }, (_, i) => {
          const m = from + i * 60;
          return <span key={m} style={{ top: (i * HOUR_H) }}>{String(Math.floor(m / 60)).padStart(2, '0')}:00</span>;
        })}
      </div>

      {/* Vùng đặt khối lịch hẹn */}
      <div className="tl-canvas" style={{ height: hours * HOUR_H }}>
        {Array.from({ length: hours }, (_, i) => (
          <div key={i} className="tl-line" style={{ top: i * HOUR_H }} />
        ))}
        {showNow && <div className="tl-now" style={{ top: ((nowMin - from) / 60) * HOUR_H }}><i /></div>}

        {blocks.map(({ b, start, end, lane, lanes }) => {
          const top = ((start - from) / 60) * HOUR_H;
          const h = Math.max(((end - start) / 60) * HOUR_H, MIN_BLOCK);
          const w = 100 / lanes;
          /* Khối thấp không đủ chỗ cho ba dòng: bớt dòng thay vì cắt chữ. */
          const size = h >= H_FULL ? '' : h >= H_SHORT ? ' is-short' : ' is-mini';
          return (
            <button
              key={b.id}
              className={`tl-block ${b.status.toLowerCase()}${size}${String(b.id) === String(selected) ? ' is-selected' : ''}`}
              style={{ top, height: h, left: `calc(${lane * w}% + 4px)`, width: `calc(${w}% - 8px)` }}
              title={`${b.startsAt.slice(11)} – ${b.endsAt.slice(11)} · ${b.customerName} · ${b.serviceName}`}
              onClick={() => onOpen(String(b.id))}
            >
              <strong className="tl-name">{b.customerName}</strong>
              <span className="tl-service">{b.serviceName}</span>
              <span className="tl-foot">
                <Icon name="clock" />
                <span className="tl-time">{b.startsAt.slice(11)} – {b.endsAt.slice(11)}</span>
                <em className="tl-badge">{STATUS_LABELS[b.status]}</em>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
