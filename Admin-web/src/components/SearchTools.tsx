/* ===== Ô tìm kiếm + bộ lọc trạng thái (dùng chung) ===== */

import { STATUS_LABELS, STATUS_ORDER } from '../lib/utils';
import type { BookingStatus } from '../types';

interface Props {
  query: string;
  onQuery: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  placeholder: string;
  /** Trang dịch vụ chỉ tìm theo tên nên không có bộ lọc trạng thái. */
  withStatus?: boolean;
}

export function SearchTools({
  query, onQuery, status, onStatus, placeholder, withStatus = true,
}: Props) {
  return (
    <div className={withStatus ? 'table-tools' : 'home-table-tools'}>
      <label className="search">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          aria-label={placeholder}
          placeholder={placeholder}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
      {withStatus && (
        <select
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_ORDER.map((key) => (
            <option key={key} value={key}>{STATUS_LABELS[key as BookingStatus]}</option>
          ))}
        </select>
      )}
    </div>
  );
}
