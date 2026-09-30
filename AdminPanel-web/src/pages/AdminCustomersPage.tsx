/* ===== Trang Khách hàng của quản trị =====
   Danh sách khách thật kèm lịch sử: số lần đặt, tổng chi tiêu, số lần vắng mặt
   và lần ghé gần nhất. Bấm một dòng để xem các dịch vụ khách đó đã dùng. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile, StatusBadge } from '../components/Primitives';
import { useApp } from '../store';
import { fmtDate, fmtNum, fmtRating, formatVND, moneyShort } from '../lib/utils';

type SortKey = 'visits' | 'spend' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'visits', label: 'Nhiều lượt nhất' },
  { key: 'spend', label: 'Chi nhiều nhất' },
  { key: 'name', label: 'Tên A → Z' },
];

export function AdminCustomersPage() {
  const { state } = useApp();
  const { customers, bookings } = state;

  const [term, setTerm] = useState('');
  const [sort, setSort] = useState<SortKey>('visits');
  const [detailId, setDetailId] = useState<string | null>(null);

  const rows = customers
    .filter((customer) =>
      customer.name.toLowerCase().includes(term.toLowerCase())
      || customer.phone.includes(term))
    .sort((a, b) => {
      if (sort === 'spend') return b.totalSpending - a.totalSpending;
      if (sort === 'name') return a.name.localeCompare(b.name, 'vi');
      return b.bookingCount - a.bookingCount;
    });

  const totalSpending = customers.reduce((sum, customer) => sum + customer.totalSpending, 0);
  const totalNoShow = customers.reduce((sum, customer) => sum + customer.noShowCount, 0);
  const loyal = customers.filter((customer) => customer.noShowCount === 0).length;
  const avgVisits = customers.length
    ? fmtRating(customers.reduce((sum, customer) => sum + customer.bookingCount, 0) / customers.length)
    : '0';

  const detail = customers.find((customer) => customer.id === detailId);
  const detailBookings = detail
    ? bookings
        .filter((booking) => booking.customerId === detail.id)
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
        .slice(0, 8)
    : [];

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="customers" label="Khách hàng" value={customers.length} note="đang phục vụ" />
        <StatTile tone="sage" icon="card" label="Tổng chi tiêu" value={moneyShort(totalSpending)} note="tích luỹ toàn hệ thống" />
        <StatTile tone="gold" icon="ban" label="Lượt vắng mặt" value={totalNoShow} note="cần nhắc nhở" />
        <StatTile tone="lavender" icon="schedule" label="Lượt ghé TB" value={avgVisits}
          note={`${loyal} khách chưa vắng`} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="customers" />}
          title="Danh sách khách hàng"
          subtitle={`${rows.length} trong ${customers.length} khách hàng`}
        />

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm khách hàng"
              placeholder="Tìm theo tên hoặc số điện thoại…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy khách hàng" detail="Thử một từ khoá khác." />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Số điện thoại</th>
                  <th>Lượt ghé</th>
                  <th>Lần cuối</th>
                  <th>Vắng mặt</th>
                  <th>Tổng chi tiêu</th>
                  <th>Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id} style={{ cursor: 'pointer' }}
                    onClick={() => setDetailId(customer.id)}>
                    <td>
                      <span className="adm-cell-name">
                        <Avatar name={customer.name} url={customer.avatarUrl} size={34} />
                        <span style={{ minWidth: 0 }}>
                          <strong>{customer.name}</strong>
                          {customer.address && <small>{customer.address}</small>}
                        </span>
                      </span>
                    </td>
                    <td>{customer.phone}</td>
                    <td><strong>{fmtNum(customer.bookingCount)}</strong></td>
                    <td>{customer.lastVisit ? fmtDate(customer.lastVisit) : <span className="adm-none">Chưa đến</span>}</td>
                    <td>
                      <span className={`badge ${customer.noShowCount > 0 ? 'cancelled' : 'completed'}`}>
                        <i />{customer.noShowCount}
                      </span>
                    </td>
                    <td><strong>{formatVND(customer.totalSpending)}</strong></td>
                    <td>
                      {customer.reviewCount > 0
                        ? <span className="adm-rating"><Icon name="star" /> {fmtRating(customer.rating)}
                          <small>{customer.reviewCount}</small></span>
                        : <span className="adm-none">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {detail && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setDetailId(null)}>
          <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="adm-detail-head">
              <Avatar name={detail.name} url={detail.avatarUrl} size={56} />
              <div style={{ minWidth: 0 }}>
                <h3>{detail.name}</h3>
                <p className="adm-detail-price">
                  {detail.phone}{detail.email ? ` · ${detail.email}` : ''}
                </p>
                <div className="adm-cell-meta" style={{ marginTop: 6 }}>
                  <span className="adm-tag">{fmtNum(detail.bookingCount)} lượt ghé</span>
                  <span className="adm-tag">Tổng chi {formatVND(detail.totalSpending)}</span>
                  {detail.noShowCount > 0 && <span className="adm-tag">{detail.noShowCount} lần vắng</span>}
                </div>
              </div>
            </div>

            <h4 className="adm-detail-title">Lịch sử gần đây</h4>
            {detailBookings.length === 0 ? (
              <p className="adm-detail-text">Khách này chưa có lịch hẹn nào trong khoảng dữ liệu hiện tại.</p>
            ) : (
              <ul className="adm-history">
                {detailBookings.map((booking) => (
                  <li key={booking.id}>
                    <span className="adm-history-when">{fmtDate(booking.startsAt)}</span>
                    <span className="adm-history-what">{booking.serviceName}</span>
                    <StatusBadge status={booking.status} />
                  </li>
                ))}
              </ul>
            )}

            <div className="adm-modal-foot">
              <button className="button secondary" onClick={() => setDetailId(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
