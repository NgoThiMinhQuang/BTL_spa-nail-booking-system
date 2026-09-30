/* ===== Bảng điều khiển quản trị =====
   Bố cục hai cột: bên trái biểu đồ doanh thu, bên phải lịch hẹn sắp tới.
   Thẻ số liệu dùng chung bộ .svc-stat với trang Dịch vụ của app nhân viên. */

import { useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { formatVND } from '../lib/utils';

interface FeedItem {
  time: string;
  part: string;
  customer: string;
  service: string;
  status: string;
}

/* Lịch hẹn sắp tới. Khi nối API, thay mảng này bằng dữ liệu thật. */
const FEED: FeedItem[] = [
  { time: '09:00', part: 'Sáng', customer: 'Nguyễn Phương Thảo', service: 'Sơn Gel Móng · KTV Linh', status: 'Đang làm' },
  { time: '10:30', part: 'Sáng', customer: 'Trần Thu Trang', service: 'Đắp Gel Trọn Bộ · KTV Mai', status: 'Đã xác nhận' },
  { time: '11:15', part: 'Sáng', customer: 'Lê Ngọc Anh', service: 'Spa Pedicure Chăm Sóc Chân · KTV Anna', status: 'Chờ xác nhận' },
  { time: '13:00', part: 'Chiều', customer: 'Phạm Quỳnh Chi', service: 'Vẽ Móng Nghệ Thuật · KTV Linh', status: 'Đã xác nhận' },
];

/* Doanh thu 7 ngày, đơn vị nghìn đồng. Khi nối API sẽ lấy từ database. */
const CHART = [
  { day: 'T2', amount: 350 },
  { day: 'T3', amount: 320 },
  { day: 'T4', amount: 550 },
  { day: 'T5', amount: 480 },
  { day: 'T6', amount: 720 },
  { day: 'T7', amount: 880 },
  { day: 'CN', amount: 620, active: true },
];

const WEEK_TOTAL = CHART.reduce((sum, day) => sum + day.amount, 0);

export function AdminDashboardPage() {
  const { state, dispatch } = useApp();
  const [openNew, setOpenNew] = useState(false);
  const bookings = state.rangeBookings ?? [];
  const revenue = bookings.reduce((sum, b) => sum + (b.price ?? 0), 0);
  const peak = Math.max(...CHART.map((d) => d.amount));

  return (
    <>
      {/* Bốn thẻ số liệu — chỉ đọc, không bấm được */}
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="schedule" label="Lịch hẹn hôm nay"
          value={bookings.length || 24} note="+4 so với hôm qua" />
        <StatTile tone="gold" icon="clock" label="Chờ xác nhận" value={5} note="Cần duyệt" />
        <StatTile tone="lavender" icon="adminStaff" label="Nhân viên đang làm"
          value={3} note="trên 6 người đang ca" />
        <StatTile tone="sage" icon="dollar" label="Doanh thu hôm nay"
          value={revenue > 0 ? formatVND(revenue) : '5.200.000 đ'} note="+12% so với hôm qua" />
      </div>

      <div className="adm-split">
        {/* Biểu đồ doanh thu */}
        <Panel>
          <SectionHeading
            icon={<Icon name="dollar" />}
            title="Tổng quan doanh thu"
            subtitle="7 ngày gần đây"
          >
            <div style={{ textAlign: 'right' }}>
              <strong style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>
                {formatVND(WEEK_TOTAL * 1000)}
              </strong>
              <span style={{ fontSize: 11, color: 'var(--nh-sage)' }}>+8,4% so với tuần trước</span>
            </div>
          </SectionHeading>
          <div style={{ padding: '0 16px 16px' }}>
            <div className="adm-chart">
              {CHART.map((day) => (
                <div key={day.day} className={`adm-chart-col${day.active ? ' is-active' : ''}`}>
                  <div
                    className="adm-chart-bar"
                    style={{ height: `${Math.max(8, (day.amount / peak) * 150)}px` }}
                    title={`${day.day}: ${formatVND(day.amount * 1000)}`}
                  />
                  <small>{day.day}</small>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Lịch hẹn sắp tới */}
        <Panel>
          <SectionHeading
            icon={<Icon name="clock" />}
            title="Lịch hẹn sắp tới"
          >
            <button className="text-button" onClick={() => dispatch({ type: 'view', view: 'admin-bookings' })}>
              Xem tất cả
            </button>
          </SectionHeading>
          <div className="adm-feed" style={{ padding: '0 16px 16px' }}>
            {FEED.length === 0
              ? <EmptyState title="Chưa có lịch hẹn" detail="Các lịch hẹn sắp tới sẽ hiện ở đây." />
              : FEED.map((item) => (
                <article key={item.time} className="adm-feed-row">
                  <span className="adm-feed-time">{item.time}<small>{item.part}</small></span>
                  <span className="adm-feed-body">
                    <strong>{item.customer}</strong>
                    <span>{item.service}</span>
                  </span>
                  <span className={`badge ${item.status === 'Chờ xác nhận' ? 'pending'
                    : item.status === 'Đang làm' ? 'processing' : 'confirmed'}`}>
                    <i />{item.status}
                  </span>
                </article>
              ))}
          </div>
        </Panel>
      </div>

      {openNew && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true">
          <div className="adm-modal">
            <h3>Tạo lịch hẹn mới</h3>
            <p>Thêm lịch hẹn tại quầy cho khách hàng. Trang này chưa nối API nên chưa lưu được.</p>
            <div className="adm-modal-foot">
              <button className="button secondary" onClick={() => setOpenNew(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}