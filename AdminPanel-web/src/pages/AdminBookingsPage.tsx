/* ===== Trang Lịch hẹn của quản trị =====
   Lưới thời gian theo cột nhân viên. Khung, bo góc và thang chữ lấy từ
   admin.css; màu trạng thái lấy từ theme.css để khớp app nhân viên. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Primitives';

/** Chiều cao một ô 30 phút, tính theo px. */
const SLOT = 56;
const START_H = 8;
const END_H = 19;

type Status = 'CONFIRMED' | 'PENDING' | 'COMPLETED';

const STAFF = [
  {
    id: 1, name: 'Emma', role: 'Chuyên gia làm móng',
    bookings: [
      { customer: 'Sarah Johnson', service: 'Sơn Gel Móng', startH: 8, startM: 30, duration: 60, status: 'CONFIRMED' as Status },
      { customer: 'Chloe Martin', service: 'Vẽ Móng Nghệ Thuật', startH: 10, startM: 30, duration: 90, status: 'PENDING' as Status },
      { customer: 'Ava Thompson', service: 'Sơn Móng Cổ Điến', startH: 14, startM: 0, duration: 45, status: 'CONFIRMED' as Status },
    ],
  },
  {
    id: 2, name: 'Olivia', role: 'KTV làm móng',
    bookings: [
      { customer: 'Isabella Lee', service: 'Đắp Bột Móng', startH: 9, startM: 0, duration: 120, status: 'CONFIRMED' as Status },
      { customer: 'Grace Kim', service: 'Sơn Gel Móng', startH: 13, startM: 0, duration: 60, status: 'COMPLETED' as Status },
      { customer: 'Lily Walker', service: 'Ngâm Chân Paraffin', startH: 15, startM: 30, duration: 45, status: 'PENDING' as Status },
    ],
  },
  {
    id: 3, name: 'Mia', role: 'Chuyên viên Spa Chân',
    bookings: [
      { customer: 'Zoe Harris', service: 'Spa Chăm Sóc Chân', startH: 8, startM: 0, duration: 75, status: 'COMPLETED' as Status },
      { customer: 'Emily Davis', service: 'Spa Chăm Sóc Chân', startH: 11, startM: 0, duration: 75, status: 'CONFIRMED' as Status },
      { customer: 'Hannah White', service: 'Sơn Móng Cổ Điến', startH: 15, startM: 0, duration: 45, status: 'PENDING' as Status },
    ],
  },
  {
    id: 4, name: 'Sophia', role: 'Thợ làm móng',
    bookings: [
      { customer: 'Mila Clark', service: 'Vẽ Móng Nghệ Thuật', startH: 9, startM: 30, duration: 90, status: 'CONFIRMED' as Status },
      { customer: 'Ella Robinson', service: 'Sơn Gel Móng', startH: 12, startM: 30, duration: 60, status: 'CONFIRMED' as Status },
      { customer: 'Nora Lewis', service: 'Đắp Bột Móng', startH: 15, startM: 0, duration: 120, status: 'PENDING' as Status },
    ],
  },
];

const STATUS_TEXT: Record<Status, string> = {
  CONFIRMED: 'Đã xác nhận',
  PENDING: 'Chờ xác nhận',
  COMPLETED: 'Hoàn thành',
};

function clock(h: number): string {
  const suffix = h < 12 ? 'SA' : 'CH';
  const h12 = h > 12 ? h - 12 : h === 12 ? 12 : h;
  return `${String(h12).padStart(2, '0')}:00 ${suffix}`;
}

export function AdminBookingsPage() {
  const [filter, setFilter] = useState<'ALL' | Status>('ALL');

  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const gridHeight = (END_H - START_H) * 60;

  const visible = STAFF.map((staff) => ({
    ...staff,
    bookings: staff.bookings.filter((b) => filter === 'ALL' || b.status === filter),
  }));
  const total = visible.reduce((sum, s) => sum + s.bookings.length, 0);

  return (
    <>
      {/* Thanh chọn trạng thái — cùng kiểu với .mode-tabs của app nhân viên */}
      <div className="mode-tabs" style={{ marginBottom: 14 }}>
        {(['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED'] as const).map((key) => (
          <button
            key={key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
          >
            {key === 'ALL' ? 'Tất cả' : STATUS_TEXT[key]}
          </button>
        ))}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'ALL' | Status)}
          aria-label="Lọc theo trạng thái"
          style={{
            marginLeft: 'auto', background: '#fff', border: '1px solid var(--nh-line)',
            borderRadius: 7, padding: '9px 11px', fontSize: 12, color: 'var(--nh-ink)',
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="CONFIRMED">Đã xác nhận</option>
          <option value="PENDING">Chờ xác nhận</option>
          <option value="COMPLETED">Hoàn thành</option>
        </select>
      </div>

      <div className="adm-legend">
        <span><i />Đã xác nhận</span>
        <span><i className="is-pending" />Chờ xác nhận</span>
        <span><i className="is-completed" />Hoàn thành</span>
        <span><i className="is-buffer" />15p dọn dẹp / nghỉ</span>
      </div>

      <Panel style={{ padding: 0 }}>
        <div className="adm-book" style={{ ['--adm-slot' as string]: `${SLOT}px` }}>
          {/* Cột giờ */}
          <div className="adm-book-hours">
            <div className="adm-book-hours-head" />
            <div className="adm-book-hours-body" style={{ height: gridHeight }}>
              {hours.map((h) => (
                <span key={h} style={{ top: (h - START_H) * SLOT }}>{clock(h)}</span>
              ))}
            </div>
          </div>

          {/* Cột từng nhân viên */}
          <div className="adm-book-cols">
            {visible.map((staff) => (
              <div key={staff.id} className="adm-book-col">
                <div className="adm-book-head">
                  <span className="avatar">{staff.name[0]}</span>
                  <span style={{ minWidth: 0 }}>
                    <strong>{staff.name}</strong>
                    <small>{staff.role}</small>
                  </span>
                </div>

                <div className="adm-book-body" style={{ height: gridHeight }}>
                  {staff.bookings.map((b, i) => {
                    const top = (b.startH - START_H) * 60 + b.startM * 2;
                    const height = b.duration * 2;
                    return (
                      <div
                        key={`${b.customer}-${i}`}
                        className={`adm-book-block is-${b.status.toLowerCase()}`}
                        style={{ top, height }}
                      >
                        <div className="adm-book-main">
                          <strong>{b.customer}</strong>
                          <span>{b.service}</span>
                          <small>
                            {String(b.startH).padStart(2, '0')}:{String(b.startM).padStart(2, '0')}
                            {' – '}
                            {String(Math.floor((top + height) / 60) + START_H).padStart(2, '0')}
                            {':00'} · {b.duration}′
                          </small>
                        </div>
                        <div className="adm-book-buffer">15p dọn dẹp</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--nh-muted)' }}>
        <Icon name="info" /> Hiện {total} lịch hẹn trên {STAFF.length} nhân viên. Số liệu tĩnh, chưa nối API.
      </p>
    </>
  );
}