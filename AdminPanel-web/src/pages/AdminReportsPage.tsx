/* ===== Trang Báo cáo =====
   Tổng hợp từ GET /api/admin/reports: doanh thu theo dịch vụ, theo nhân viên và
   khách hàng thân thiết, kèm chỉ số tổng quan về toàn bộ lịch hẹn. */

import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { fmtNum, formatVND, moneyShort } from '../lib/utils';

export function AdminReportsPage() {
  const { state } = useApp();
  const { reports } = state;

  if (!reports) {
    return <EmptyState title="Đang tải báo cáo" detail="Số liệu sẽ hiện ngay khi tải xong." />;
  }

  const { byService, byStaff, byCustomer, totals } = reports;
  const doneRate = totals.bookings > 0
    ? Math.round((totals.completed / totals.bookings) * 100) : 0;
  const peakService = Math.max(...byService.map((item) => item.revenue), 1);
  const peakStaff = Math.max(...byStaff.map((item) => item.revenue), 1);

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="schedule" label="Tổng lịch hẹn" value={fmtNum(totals.bookings)}
          note={`${doneRate}% đã hoàn thành`} />
        <StatTile tone="sage" icon="done" label="Hoàn thành" value={fmtNum(totals.completed)}
          note={`${totals.cancelled} huỷ · ${totals.noShow} không đến`} />
        <StatTile tone="gold" icon="clock" label="Thời gian TB" value={`${totals.avgMinutes}′`}
          note="mỗi buổi làm" />
        <StatTile tone="lavender" icon="dollar" label="Tổng doanh thu" value={moneyShort(totals.bookings > 0
          ? byService.reduce((sum, item) => sum + item.revenue, 0) : 0)}
          note="từ lịch hoàn thành" />
      </div>

      <div className="adm-dash-row">
        {/* Doanh thu theo dịch vụ */}
        <Panel>
          <SectionHeading
            icon={<Icon name="services" />}
            title="Doanh thu theo dịch vụ"
            subtitle={`${byService.length} dịch vụ đã có lịch hẹn`}
          />
          <div className="adm-tools" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
            {byService.length === 0 ? (
              <EmptyState title="Chưa có lịch hẹn" detail="Báo cáo sẽ có số liệu khi có đơn đầu tiên." />
            ) : byService.map((item) => (
              <div key={item.name} className="adm-bar-row"
                style={{ gridTemplateColumns: 'minmax(90px,1.2fr) minmax(50px,2fr) auto' }}>
                <span className="adm-bar-name" title={item.name}>{item.name}</span>
                <span className="adm-bar-track">
                  <span className="adm-bar-fill"
                    style={{ width: `${(item.revenue / peakService) * 100}%` }} />
                </span>
                <span className="adm-bar-value">
                  {item.bookings} lượt · {moneyShort(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Doanh thu theo nhân viên */}
        <Panel>
          <SectionHeading
            icon={<Icon name="adminStaff" />}
            title="Doanh thu theo nhân viên"
            subtitle={`${byStaff.length} người`}
          />
          <div className="adm-tools" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
            {byStaff.map((item) => (
              <div key={item.name} className="adm-bar-row"
                style={{ gridTemplateColumns: 'minmax(78px,1fr) minmax(40px,1.4fr) auto' }}>
                <span className="adm-bar-name" title={item.name}>{item.name}</span>
                <span className="adm-bar-track">
                  <span className="adm-bar-fill is-completed"
                    style={{ width: `${(item.revenue / peakStaff) * 100}%` }} />
                </span>
                <span className="adm-bar-value">{item.bookings} lịch</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Khách hàng thân thiết */}
      <Panel style={{ marginTop: 16 }}>
        <SectionHeading
          icon={<Icon name="customers" />}
          title="Khách hàng thân thiết"
          subtitle="Xếp theo số lần đặt"
        />
        <div className="table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th><th>Khách hàng</th><th>Số điện thoại</th>
                <th>Số lần đặt</th><th>Tổng chi tiêu</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.map((item, index) => (
                <tr key={item.phone}>
                  <td>{index + 1}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.phone}</td>
                  <td>{item.bookings}</td>
                  <td><strong>{formatVND(item.spending)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="app-note">
        Số liệu lấy từ toàn bộ {fmtNum(totals.bookings)} lịch hẹn trong hệ thống.
        Doanh thu chỉ tính các lịch đã hoàn thành.
      </p>
    </>
  );
}
