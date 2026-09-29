import { fmtNum } from '../lib/utils';
import type { PageInfo } from '../hooks/usePager';

/* Số trang dạng "1 … 4 5 6 … 12", tối đa 5 số quanh trang hiện tại. */
export function pageNumbers(pages: number, page: number, size = 5): number[] {
  let from = Math.max(1, Math.min(page - 2, pages - size + 1));
  const to = Math.min(pages, from + size - 1);
  from = Math.max(1, Math.min(from, to - size + 1));
  const numbers: number[] = [];
  if (from > 1) numbers.push(1);
  for (let i = from; i <= to; i += 1) numbers.push(i);
  if (to < pages) numbers.push(pages);
  return numbers;
}

export function PageBar<T>({
  info, onChange, unit,
}: {
  info: PageInfo<T>;
  onChange: (page: number) => void;
  unit: string;
}) {
  if (info.pages < 2) return null;
  const { page, pages, start, end, total } = info;
  const numbers = pageNumbers(pages, page);
  return (
    <div className="pager-bar">
      <span className="pager-info">
        {fmtNum(start + 1)}–{fmtNum(end)} / {fmtNum(total)} {unit}
      </span>
      <div className="pager-nav">
        <button
          type="button"
          className="pager-step"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
        >
          ‹
        </button>
        {numbers.map((n, i) => (
          <span key={n} style={{ display: 'contents' }}>
            {i > 0 && n - numbers[i - 1] > 1 && <span className="pager-gap" aria-hidden="true">…</span>}
            <button
              type="button"
              className={`pager-num${n === page ? ' active' : ''}`}
              onClick={() => onChange(n)}
              aria-label={`Trang ${n}`}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          </span>
        ))}
        <button
          type="button"
          className="pager-step"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}
