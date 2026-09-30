/* ===== Lịch tuần dạng lưới: ngang là các ngày, dọc là giờ =====
   Mở lên thấy ngay "tuần này ngày nào mình làm, ca nào, có khách gì lúc mấy giờ".
   Mỗi cột là một ngày; dải màu nhạt là ca làm việc, khối là lịch hẹn. */

import { useMemo } from 'react';
import { Icon } from './Icon';
import { EmptyState } from './Primitives';
import { localDate, STATUS_LABELS } from '../lib/utils';
import type { Booking, Shift } from '../types';

/* 44px/giờ: một ca 09:00–18:00 (9 giờ) chỉ cao ~400px, cộng header ~64px
   nên vừa trọn trong một màn hình mà không phải cuộn dọc. */
const HOUR_H = 44;
const MIN_BLOCK = 22;     /* khối thấp nhất để vẫn đọc được tên */
/* Ngưỡng chiều cao để bớt dòng thay vì để chữ bị cắt:
   ≥ 40px hiện đủ 2 dòng (tên · giờ) · thấp hơn chỉ còn tên. */
const H_FULL = 40;
const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minutesOf(stamp: string) {
  return toMin(stamp.split(' ')[1] ?? '00:00');
}
function overlaps(a: { s: number; e: number }, b: { s: number; e: number }) {
  return a.s < b.e && b.s < a.e;
}

interface Block { b: Booking; s: number; e: number; lane: number; lanes: number }

function layout(books: Booking[], from: number): Block[] {
  const list: Block[] = books.map((b) => {
    const s = Math.max(minutesOf(b.startsAt), from);
    const e = Math.max(minutesOf(b.endsAt), s + 15);
    return { b, s, e, lane: 0, lanes: 1 };
  }).sort((x, y) => x.s - y.s || x.e - y.e);

  const placed: Block[] = [];
  for (const cur of list) {
    let lane = 0;
    while (placed.some((p) => p.lane === lane && overlaps(p, cur))) lane += 1;
    cur.lane = lane;
    placed.push(cur);
  }
  for (const cur of placed) {
    const peers = placed.filter((o) => overlaps(o, cur));
    const n = Math.max(...peers.map((p) => p.lane)) + 1;
    for (const p of peers) p.lanes = n;
  }
  return placed;
}

export function WeekGrid({
  rows, shifts, dates, selected, onOpen, onPickDate,
}: {
  rows: Booking[];
  shifts: Shift[];
  dates: string[];
  selected: string | number | null;
  onOpen: (id: string) => void;
  onPickDate: (date: string) => void;
}) {
  const { from, to } = useMemo(() => {
    const starts = rows.map((b) => minutesOf(b.startsAt));
    const ends = rows.map((b) => minutesOf(b.endsAt));
    const shiftMins = shifts.flatMap((s) => [toMin(s.start), toMin(s.end)]);
    const lo = Math.min(...shiftMins, ...starts, 8 * 60);
    /* Mốc cuối lấy đúng ca thật, chỉ chặn dưới 18:00 — trước đây ép tối
       thiểu 19:00 nên ca 09–18 vẫn thừa một hàng trống. */
    const hi = Math.max(...shiftMins, ...ends, 18 * 60);
    return { from: Math.floor(lo / 60) * 60, to: Math.ceil(hi / 60) * 60 };
  }, [rows, shifts]);

  const hours = Math.max(Math.ceil((to - from) / 60), 6);
  const canvasH = hours * HOUR_H;
  const y = (min: number) => ((min - from) / 60) * HOUR_H;

  const today = localDate();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMin >= from && nowMin <= to;

  const byDay = useMemo(
    () => dates.map((d) => ({ date: d, blocks: layout(rows.filter((b) => b.startsAt.startsWith(d)), from) })),
    [rows, dates, from, to],
  );

  /* Bề rộng mỗi cột = số làn tối đa trong ngày đó, nhân 88px cho gọn.
     Ngày chỉ 1–2 lịch vẫn đủ rộng để đọc tên; ngày nhiều lịch chồng nhau
     (dữ liệu nhập tay) tự nới theo số làn. */
  const colsCss = byDay
    .map(({ blocks }) => `${Math.max(96, (Math.max(0, ...blocks.map((b) => b.lanes)) || 1) * 88)}px`)
    .join(' ');

  if (rows.length === 0 && shifts.every((s) => !dates.includes(s.date))) {
    return <EmptyState title="Tuần này chưa có lịch" detail="Chọn tuần khác bằng mũi tên ‹ ›, hoặc bấm «Hôm nay»." />;
  }

  return (
    <div className="wk">
      {/* Cột giờ bên trái. Nhãn nằm trong .wk-hours nên bắt đầu đúng ngang
          hàng tiêu đề ngày, không lệch lên trên. */}
      <div className="wk-gutter" aria-hidden="true">
        <div className="wk-hours" style={{ height: canvasH }}>
          {Array.from({ length: hours + 1 }, (_, i) => (
            <span key={i} style={{ top: i * HOUR_H }}>{String((from / 60 + i) % 24).padStart(2, '0')}:00</span>
          ))}
        </div>
      </div>

      <div className="wk-scroll">
        <div className="wk-head" style={{ gridTemplateColumns: colsCss }}>
          {dates.map((d, i) => {
            const dayShift = shifts.find((s) => s.date === d && s.status !== 'CANCELLED');
            const count = rows.filter((b) => b.startsAt.startsWith(d)).length;
            return (
              <button
                key={d}
                className={`wk-day${d === today ? ' is-today' : ''}`}
                onClick={() => onPickDate(d)}
              >
                <span>{DAY_NAMES[i]}</span>
                <strong>{Number(d.slice(8))}</strong>
                {dayShift
                  ? <em className="wk-shift">{dayShift.start}–{dayShift.end}</em>
                  : <em className="wk-shift is-off">Nghỉ</em>}
                <em className="wk-count">{count ? `${count} lịch hẹn` : 'Trống'}</em>
              </button>
            );
          })}
        </div>

        <div className="wk-grid" style={{ height: canvasH, gridTemplateColumns: colsCss }}>
          {Array.from({ length: hours }, (_, i) => (
            <div key={i} className="wk-line" style={{ top: i * HOUR_H }} aria-hidden="true" />
          ))}
          {showNow && <div className="wk-now" style={{ top: y(nowMin) }} aria-hidden="true" />}

          {byDay.map(({ date, blocks }) => {
            const dayShift = shifts.find((s) => s.date === date && s.status !== 'CANCELLED');
            return (
              <div key={date} className={`wk-col${date === today ? ' is-today' : ''}`}>
                {dayShift && (
                  <div
                    className="wk-band"
                    style={{ top: y(toMin(dayShift.start)), height: Math.max(y(toMin(dayShift.end)) - y(toMin(dayShift.start)), 3) }}
                    title={`Ca làm việc ${dayShift.start} – ${dayShift.end}`}
                  />
                )}
                {blocks.map(({ b, s, e, lane, lanes }) => {
                  const w = 100 / lanes;
                  const h = Math.max(y(e) - y(s), MIN_BLOCK);
                  /* Khối thấp không đủ chỗ cho ba dòng: bớt dòng thay vì cắt chữ. */
                  const size = h >= H_FULL ? '' : ' is-mini';
                  return (
                    <button
                      key={b.id}
                      className={`wk-block ${b.status.toLowerCase()}${size}${String(b.id) === String(selected) ? ' is-selected' : ''}`}
                      style={{ top: y(s), height: h, left: `calc(${lane * w}% + 3px)`, width: `calc(${w}% - 6px)` }}
                      onClick={() => onOpen(String(b.id))}
                      title={`${b.startsAt.slice(11)} – ${b.endsAt.slice(11)} · ${b.customerName} · ${b.serviceName}`}
                    >
                      <strong>{b.customerName}</strong>
                      <em>{b.startsAt.slice(11)}</em>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chú thích màu trạng thái */}
      <div className="wk-legend">
        {(['CONFIRMED', 'PROCESSING', 'COMPLETED', 'PENDING', 'CANCELLED'] as const).map((s) => (
          <span key={s} className={`wk-dot ${s.toLowerCase()}`}><Icon name="schedule" />{STATUS_LABELS[s]}</span>
        ))}
      </div>
    </div>
  );
}
