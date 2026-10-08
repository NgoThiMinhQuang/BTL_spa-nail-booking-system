/* ===== Bảng lịch hẹn dùng chung cho trang chủ và trang lịch làm việc ===== */

import { Avatar } from './Avatar';
import { Badge, EmptyState } from './Primitives';
import { PageBar } from './PageBar';
import { usePager } from '../hooks/usePager';
import { fmtNum } from '../lib/utils';
import type { Booking } from '../types';

interface Props {
  rows: Booking[];
  selected: string | null;
  pagerKey: string;
  size: number;
  hasFilter: boolean;
  /** Chế độ lịch: hiện giờ kết thúc, dùng nút chữ thay vì mũi tên. */
  detailed?: boolean;
  onOpen: (id: string) => void;
}

export function BookingTable({
  rows, selected, pagerKey, size, hasFilter, detailed = false, onOpen,
}: Props) {
  const info = usePager(pagerKey, rows, size);

  if (!rows.length) {
    return (
      <EmptyState
        title="Chưa có lịch hẹn phù hợp"
        detail={hasFilter
          ? 'Thử thay đổi tìm kiếm hoặc bộ lọc trạng thái.'
          : 'Ngày này chưa có lịch hẹn. Chọn ngày khác để xem lịch của bạn.'}
      />
    );
  }

  return (
    <>
      <div className="schedule-table-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="col-stt">STT</th>
              <th>Thời gian</th>
              <th>Khách hàng</th>
              <th>Dịch vụ</th>
              <th>Thời lượng</th>
              <th>Trạng thái</th>
              <th>{detailed ? 'Hành động' : <span className="sr-only">Chi tiết</span>}</th>
            </tr>
          </thead>
          <tbody>
            {info.rows.map((b, index) => {
              const isSelected = String(b.id) === String(selected);
              return (
                <tr
                  key={b.id}
                  className={isSelected ? 'is-selected' : ''}
                  data-status={detailed ? b.status.toLowerCase() : undefined}
                >
                  <td className="col-stt">{index + 1}</td>
                  <td>
                    <strong>{b.startsAt.slice(11)}</strong>
                    {detailed && <small>{b.endsAt.slice(11)}</small>}
                  </td>
                  <td>
                    <div className="schedule-person">
                      <Avatar name={b.customerName} url={b.avatar} />
                      <div>
                        <strong>{b.customerName}</strong>
                        <a href={`tel:${b.phone}`}>{b.phone}</a>
                      </div>
                    </div>
                  </td>
                  <td className="schedule-service">{b.serviceName}</td>
                  <td><span className="duration">◷ {b.duration} phút</span></td>
                  <td><Badge status={b.status} /></td>
                  <td>
                    <button
                      type="button"
                      className="select-booking"
                      onClick={() => onOpen(String(b.id))}
                      aria-label={`Chi tiết lịch hẹn ${b.customerName} lúc ${b.startsAt.slice(11)}`}
                      aria-pressed={isSelected}
                    >
                      {detailed ? 'Xem chi tiết' : '›'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PageBar info={info} onChange={info.goTo} unit="lịch hẹn" />
    </>
  );
}

export function bookingCountLabel(visible: number, total: number): string {
  return visible === total
    ? `${fmtNum(visible)} lịch hẹn`
    : `Hiển thị ${fmtNum(visible)} / ${fmtNum(total)} lịch hẹn`;
}
