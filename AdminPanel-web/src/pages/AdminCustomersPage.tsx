/* ===== Trang Khách hàng của quản trị =====
   Bảng dùng chung bộ .adm-table / .adm-cell-name với các trang khác; màu nhãn
   và bo góc lấy từ theme.css nên khớp app nhân viên. */

import { useState } from 'react';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { formatVND } from '../lib/utils';

const CUSTOMERS = [
  { id: 1, name: 'Sarah Johnson', phone: '+1 (555) 214-7788', bookings: 18, noShows: 0, spent: 8420000 },
  { id: 2, name: 'Chloe Martin', phone: '+1 (555) 381-0921', bookings: 9, noShows: 3, spent: 4150000 },
  { id: 3, name: 'Ava Thompson', phone: '+1 (555) 902-4410', bookings: 4, noShows: 1, spent: 1500000 },
  { id: 4, name: 'Isabella Lee', phone: '+1 (555) 663-1290', bookings: 22, noShows: 0, spent: 16900000 },
  { id: 5, name: 'Grace Kim', phone: '+1 (555) 470-3355', bookings: 7, noShows: 2, spent: 2980000 },
];

export function AdminCustomersPage() {
  const [term, setTerm] = useState('');

  const rows = CUSTOMERS.filter((c) =>
    c.name.toLowerCase().includes(term.toLowerCase()) || c.phone.includes(term));

  const totalSpent = CUSTOMERS.reduce((sum, c) => sum + c.spent, 0);
  const totalNoShow = CUSTOMERS.reduce((sum, c) => sum + c.noShows, 0);
  const loyal = CUSTOMERS.filter((c) => c.noShows === 0).length;

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="customers" label="Khách hàng" value={CUSTOMERS.length} note="toàn hệ thống" />
        <StatTile tone="sage" icon="card" label="Tổng chi tiêu" value={formatVND(totalSpent)} note="tích lũy" />
        <StatTile tone="gold" icon="ban" label="Lượt vắng mặt" value={totalNoShow} note="cần nhắc nhở" />
        <StatTile tone="lavender" icon="star" label="Khách thân thiết" value={loyal} note="không vắng mặt" />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="customers" />}
          title="Danh sách khách hàng"
          subtitle={`${rows.length} trong ${CUSTOMERS.length} khách hàng`}
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
          <button className="button secondary">
            <Icon name="sparkles" /> <span>Phân khúc</span>
          </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy khách hàng" detail="Thử một từ khoá khác, ví dụ tên hoặc số điện thoại." />
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Số điện thoại</th>
                  <th>Tổng lịch hẹn</th>
                  <th>Vắng mặt</th>
                  <th>Tổng chi tiêu</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="adm-cell-name">
                        <Avatar name={c.name} url={null} size={34} />
                        <span style={{ minWidth: 0 }}>
                          <strong>{c.name}</strong>
                        </span>
                      </span>
                    </td>
                    <td>{c.phone}</td>
                    <td><strong>{c.bookings}</strong></td>
                    <td>
                      <span className={`badge ${c.noShows > 0 ? 'cancelled' : 'completed'}`}>
                        <i />{c.noShows}
                      </span>
                    </td>
                    <td><strong>{formatVND(c.spent)}</strong></td>
                    <td>
                      <span className="adm-row-actions">
                        <button className="adm-icon-btn" aria-label={`Xem lịch sử của ${c.name}`}>
                          <Icon name="clock" />
                        </button>
                        <button className="adm-icon-btn" aria-label={`Gọi ${c.name}`}>
                          <Icon name="phone" />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}