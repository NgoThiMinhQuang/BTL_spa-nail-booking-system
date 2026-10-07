/* ===== Hai biểu đồ thống kê cho Dashboard =====

   Vẽ bằng SVG thuần, không dùng thư viện biểu đồ nào. Lý do: dự án này
   phải chạy được khi thầy chấm không có mạng, và thêm thư viện chỉ để vẽ hai
   biểu đồ thì không đáng.

   Chiều rộng được đo bằng ResizeObserver rồi vẽ đúng số pixel thật, nhờ vậy
   chữ luôn đúng cỡ ở mọi kích thước màn hình (nếu dùng viewBox co giãn thì
   chữ sẽ bị méo theo bề rộng). */

import { useEffect, useRef, useState } from 'react';

/** Đo bề rộng khung chứa, có cập nhật khi đổi kích thước cửa sổ. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    setWidth(Math.round(node.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/** Làm tròn trục tung lên bậc đẹp: 1, 2, 2,5 hay 5 × 10^n. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

/* ================================================================
   Biểu đồ đường — dùng cho doanh thu theo ngày
   ================================================================ */
export interface LinePoint {
  /** Nhãn trên trục hoành, ví dụ "T2" hoặc "01/09". */
  label: string;
  value: number;
  /** Chuỗi hiện khi rê chuột, ví dụ "01/09/2026 · 12 lịch". */
  hint: string;
}

export function LineChart({
  data, height = 186, unit = 'tr',
}: {
  data: LinePoint[];
  /** Đơn vị rút gọn cho nhãn trục tung: "tr" = triệu, "ng" = nghìn. */
  unit?: 'tr' | 'ng' | null;
  height?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const pad = { top: 16, right: 14, bottom: 26, left: unit ? 48 : 16 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const max = Math.max(...data.map((d) => d.value), 0);
  const top = niceCeiling(max);

  const x = (index: number) =>
    data.length <= 1 ? pad.left + innerW / 2 : pad.left + (innerW * index) / (data.length - 1);
  const y = (value: number) => pad.top + innerH - (top === 0 ? 0 : (value / top) * innerH);

  /* Bốn mốc ngang, giá trị làm tròn cho dễ đọc. */
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => top * ratio);

  const divisor = unit === 'tr' ? 1_000_000 : 1_000;
  const axisLabel = (value: number) => {
    const scaled = value / divisor;
    if (value === 0) return '0';
    return unit === 'tr'
      ? `${scaled.toFixed(scaled < 10 ? 1 : 0)}M`
      : `${Math.round(scaled)}`;
  };

  if (!width) return <div ref={ref} style={{ height }} />;

  if (data.length === 0 || max === 0) {
    return (
      <div ref={ref} className="adm-chart-empty">
        <p>Chưa có doanh thu trong khoảng này.</p>
        <small>Biểu đồ sẽ có dữ liệu khi phát sinh lịch hoàn thành.</small>
      </div>
    );
  }

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.value)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;
  const active = hover == null ? null : data[hover];

  return (
    <div ref={ref} className="adm-linechart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Biểu đồ doanh thu theo ngày"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const offset = event.clientX - box.left - pad.left;
          const step = data.length <= 1 ? innerW : innerW / (data.length - 1);
          const index = Math.round(offset / step);
          setHover(index >= 0 && index < data.length ? index : null);
        }}
      >
        {/* Đường kẻ ngang + nhãn trục tung */}
        {unit && ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left} x2={pad.left + innerW}
              y1={y(tick)} y2={y(tick)}
              stroke={tick === 0 ? '#E7D8DE' : '#F1E6EA'}
              strokeDasharray={tick === 0 ? undefined : '3 3'}
            />
            <text x={pad.left - 9} y={y(tick) + 3.5} className="adm-axis-text" textAnchor="end">
              {axisLabel(tick)}
            </text>
          </g>
        ))}

        {/* Vùng tô và đường chính */}
        <path d={area} fill="url(#adm-area)" />
        <path d={line} fill="none" stroke="var(--nh-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="adm-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D56B81" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#D56B81" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Điểm dữ liệu + nhãn ngày */}
        {data.map((d, i) => (
          <g key={`${d.label}-${i}`}>
            <circle
              cx={x(i)} cy={y(d.value)} r={hover === i ? 4.5 : 2.6}
              fill="#fff" stroke="var(--nh-primary)" strokeWidth="2"
            />
            <text x={x(i)} y={height - 8} className="adm-axis-text" textAnchor="middle">
              {d.label}
            </text>
          </g>
        ))}

        {/* Đường dọc báo điểm đang rê */}
        {hover != null && (
          <line
            x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH}
            stroke="#D56B81" strokeWidth="1" strokeDasharray="2 3" opacity=".55"
          />
        )}
      </svg>

      {active && (
        <div
          className="adm-tooltip"
          style={{
            left: `${Math.min(Math.max(x(hover!) - 62, 0), Math.max(width - 132, 0))}px`,
            top: `${Math.max(y(active.value) - 52, 0)}px`,
          }}
        >
          <strong>{active.hint}</strong>
          <span>{new Intl.NumberFormat('vi-VN').format(active.value)} ₫</span>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Biểu đồ tròn — dùng cho cơ cấu trạng thái lịch hẹn
   ================================================================ */
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices, size = 148, centerLabel = 'lịch hôm nay',
}: {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = size / 2 - 13;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="adm-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label="Cơ cấu trạng thái lịch hẹn">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {/* Vòng nền */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke="#F5EFF2" strokeWidth="17" />
          {total > 0 && slices.filter((s) => s.value > 0).map((slice) => {
            const length = (slice.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const node = (
              <circle
                key={slice.label}
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={slice.color} strokeWidth="17"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return node;
          })}
        </g>
      </svg>

      <div className="adm-donut-center">
        <strong>{total}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}
