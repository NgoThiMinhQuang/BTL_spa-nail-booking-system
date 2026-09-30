/* ===== Trang Lịch hẹn của quản trị =====
   Đọc từ GET /api/admin/bookings. Mặc định chỉ hiện lịch sắp tới và trong ngày
   hôm nay; nút Duyệt/Hoàn thành/Hủy gọi PATCH /api/admin/bookings/:id nên số
   liệu trên trang khác cũng được làm mới theo. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile, StatusBadge } from '../components/Primitives';
import { useApp, today, type AdminBooking } from '../store';
import { fmtDate, fmtTime, formatVND, moneyShort } from '../lib/utils';

type Scope = 'today' | 'upcoming' | 'all';

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'all', label: 'Tất cả' },
];

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

/** Bước trạng thái tiếp theo của một lịch, theo luồng nghiệp vụ của tiệm. */
function nextAction(status: string): { to: string; label: string } | null {
  if (status === 'PENDING') return { to: 'CONFIRMED', label: 'Duyệt' };
  if (status === 'CONFIRMED') return { to: 'PROCESSING', label: 'Bắt đầu' };
  if (status === 'PROCESSING') return { to: 'COMPLETED', label: 'Xong' };
  return null;
}

export function AdminBookingsPage() {
  const { state, reload } = useApp();
  const { bookings } = state;

  const [scope, setScope] = useState<Scope>('today');
  const [status, setStatus] = useState('');
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const day = today();
  const now = Date.now();

  const rows = bookings
    .filter((booking) => {
      const time = new Date(booking.startsAt).getTime();
      if (scope === 'today') return booking.startsAt.slice(0, 10) === day;
      if (scope === 'upcoming') return time >= now && booking.status !== 'CANCELLED';
      return true;
    })
    .filter((booking) => !status || booking.status === status)
    .filter((booking) => {
      if (!term) return true;
      const key = term.toLowerCase();
      return booking.customerName.toLowerCase().includes(key)
        || booking.serviceName.toLowerCase().includes(key)
        || (booking.staffName ?? '').toLowerCase().includes(key)
        || booking.customerPhone.includes(key);
    });

  const revenue = rows.reduce((sum, booking) => sum + booking.price, 0);
  const pendingCount = bookings.filter((booking) => booking.status === 'PENDING').length;
  const todayCount = bookings.filter((booking) => booking.startsAt.slice(0, 10) === day).length;

  async function changeStatus(booking: AdminBooking, to: string) {
    setBusy(booking.id);
    try {
      await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="schedule" label="Lịch hẹn hôm nay" value={todayCount} note="theo giờ bắt đầu" />
        <StatTile tone="gold" icon="clock" label="Chờ xác nhận" value={pendingCount} note="cần duyệt" />
        <StatTile tone="sage" icon="done" label="Tổng số lịch" value={bookings.length} note="toàn bộ lịch sử" />
        <StatTile tone="lavender" icon="dollar" label="Giá trị danh sách" value={moneyShort(revenue)}
          note={`${rows.length} lịch đang xem`} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="schedule" />}
          title="Lịch hẹn cửa hàng"
          subtitle={`${rows.length} lịch · ${formatVND(revenue)}`}
        />

        <div className="adm-tools">
          <div className="mode-tabs">
            {SCOPES.map((item) => (
              <button key={item.key} className={scope === item.key ? 'active' : ''}
                onClick={() => setScope(item.key)}>{item.label}</button>
            ))}
          </div>
          <select aria-label="Lọc theo trạng thái" value={status}
            onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="adm-tools" style={{ paddingTop: 0 }}>
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm lịch hẹn"
              placeholder="Tìm khách hàng, dịch vụ, nhân viên…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Không có lịch hẹn phù hợp"
            detail="Đổi khoảng thời gian, trạng thái hoặc từ khoá tìm kiếm."
          />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th>Giờ</th>
                  <th>Khách hàng</th>
                  <th>Dịch vụ</th>
                  <th>Nhân viên</th>
                  <th>Giá</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => {
                  const action = nextAction(booking.status);
                  return (
                    <tr key={booking.id}>
                      <td>
                        <strong>{fmtTime(booking.startsAt)}</strong>
                        <small>{fmtDate(booking.startsAt)}</small>
                      </td>
                      <td>
                        <strong>{booking.customerName}</strong>
                        <small>{booking.customerPhone}</small>
                      </td>
                      <td>
                        <strong>{booking.serviceName}</strong>
                        <small>{booking.duration} phút</small>
                      </td>
                      <td>{booking.staffName ?? <span className="adm-none">Chưa phân công</span>}</td>
                      <td><strong>{formatVND(booking.price)}</strong></td>
                      <td>
                        {booking.paymentText
                          ? <span className={`badge ${booking.paymentStatus === 'PAID' ? 'completed'
                            : booking.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                            <i />{booking.paymentText}
                          </span>
                          : <span className="adm-none">Chưa ghi nhận</span>}
                        {booking.methodText && <small>{booking.methodText}</small>}
                      </td>
                      <td><StatusBadge status={booking.status} /></td>
                      <td>
                        <span className="adm-row-actions">
                          {action && (
                            <button className="adm-text-btn" disabled={busy === booking.id}
                              onClick={() => changeStatus(booking, action.to)}>
                              {busy === booking.id ? '…' : action.label}
                            </button>
                          )}
                          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                            <button className="adm-icon-btn" aria-label="Hủy lịch hẹn"
                              disabled={busy === booking.id}
                              onClick={() => changeStatus(booking, 'CANCELLED')}>
                              <Icon name="ban" />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}