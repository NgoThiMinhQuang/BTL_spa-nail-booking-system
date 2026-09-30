/* ===== Bảng điều khiển quản trị =====
   Toàn bộ số liệu lấy từ GET /api/admin/overview: thống kê hôm nay, doanh
   thu 7 ngày, lịch hẹn sắp tới và dịch vụ bán chạy. Không có số giả. */

import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { fmtTime, formatVND, moneyShort, weekdayShort } from '../lib/utils';

export function AdminDashboardPage() {
  const { state, dispatch } = useApp();
  const { overview, loading } = state;

  if (!overview) {
    return <EmptyState title="Đang tải số liệu" detail="Số liệu cửa hàng sẽ hiện ngay khi tải xong." />;
  }

  const { today, staff, revenue, chart, upcoming, topServices } = overview;
  const peak = Math.max(...chart.map((day) => day.revenue), 1);
  const weekRevenue = chart.reduce((sum, day) => sum + day.revenue, 0);
  const maxBookings = Math.max(...topServices.map((service) => service.bookings), 1);

  return (
    <>
      {/* Bốn thẻ số liệu — chỉ đọc, không bấm được */}
      <div className="adm-tiles adm-tiles-4">
        <StatTile
          tone="rose" icon="schedule" label="Lịch hẹn hôm nay" value={today.total}
          note={`${today.confirmed} đã xác nhận · ${today.pending} chờ`}
        />
        <StatTile
          tone="gold" icon="clock" label="Đang thực hiện" value={today.processing}
          note={today.processing > 0 ? 'nhân viên đang phục vụ' : 'chưa có ca đang chạy'}
        />
        <StatTile
          tone="lavender" icon="adminStaff" label="Nhân viên trong ca" value={`${staff.onShift}/${staff.total}`}
          note="nhân sự hôm nay"
        />
        <StatTile
          tone="sage" icon="dollar" label="Doanh thu hôm nay" value={moneyShort(revenue.paidAmount)}
          note={`${revenue.paidCount} lịch đã thu · cọc ${moneyShort(revenue.depositAmount)}`}
        />
      </div>

      <div className="adm-split">
        {/* Doanh thu 7 ngày */}
        <Panel>
          <SectionHeading icon={<Icon name="dollar" />} title="Doanh thu 7 ngày" subtitle="Lịch đã hoàn thành">
            <div style={{ textAlign: 'right' }}>
              <strong style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>
                {formatVND(weekRevenue)}
              </strong>
              <span style={{ fontSize: 11, color: 'var(--nh-sage)' }}>cả tuần</span>
            </div>
          </SectionHeading>
          <div style={{ padding: '0 16px 16px' }}>
            <div className="adm-chart">
              {chart.map((day, index) => (
                <div
                  key={day.day}
                  className={`adm-chart-col${index === chart.length - 1 ? ' is-active' : ''}`}
                  title={`${day.day}: ${day.bookings} lịch · ${formatVND(day.revenue)}`}
                >
                  <div className="adm-chart-bar" style={{ height: `${Math.max(6, (day.revenue / peak) * 150)}px` }} />
                  <small>{weekdayShort(day.day)}</small>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Lịch hẹn sắp tới */}
        <Panel>
          <SectionHeading icon={<Icon name="clock" />} title="Lịch hẹn sắp tới">
            <button className="text-button" onClick={() => dispatch({ type: 'view', view: 'admin-bookings' })}>
              Xem tất cả
            </button>
          </SectionHeading>
          <div className="adm-feed" style={{ padding: '0 16px 16px' }}>
            {upcoming.length === 0 ? (
              <EmptyState title="Chưa có lịch hẹn sắp tới" detail="Các lịch mới sẽ hiện ở đây." />
            ) : upcoming.map((item) => (
              <article key={item.id} className="adm-feed-row">
                <span className="adm-feed-time">
                  {fmtTime(item.startsAt)}
                  <small>{item.duration}′</small>
                </span>
                <span className="adm-feed-body">
                  <strong>{item.customerName}</strong>
                  <span>{item.serviceName}{item.staffName ? ` · ${item.staffName}` : ''}</span>
                </span>
                <span className={`badge ${item.status === 'PENDING' ? 'pending'
                  : item.status === 'PROCESSING' ? 'processing' : 'confirmed'}`}>
                  <i />{item.status === 'PROCESSING' ? 'Đang làm'
                    : item.status === 'PENDING' ? 'Chờ' : 'Đã nhận'}
                </span>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      {/* Dịch vụ bán chạy */}
      <Panel style={{ marginTop: 18 }}>
        <SectionHeading
          icon={<Icon name="services" />}
          title="Dịch vụ bán chạy"
          subtitle="Xếp theo số lịch hẹn đã nhận"
        >
          <button className="text-button" onClick={() => dispatch({ type: 'view', view: 'admin-services' })}>
            Quản lý dịch vụ
          </button>
        </SectionHeading>
        <div className="adm-tools">
          {topServices.length === 0 ? (
            <EmptyState title="Chưa có lịch hẹn" detail="Thống kê sẽ hiện khi có đơn đầu tiên." />
          ) : topServices.map((service) => (
            <div key={service.id} className="adm-bar-row">
              <span className="adm-bar-name" title={service.name}>{service.name}</span>
              <span className="adm-bar-track">
                <span
                  className="adm-bar-fill"
                  style={{ width: `${(service.bookings / maxBookings) * 100}%` }}
                />
              </span>
              <span className="adm-bar-value">
                {service.bookings} lịch · {moneyShort(service.revenue)}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {loading && <p className="app-note">Đang cập nhật số liệu…</p>}
    </>
  );
}
