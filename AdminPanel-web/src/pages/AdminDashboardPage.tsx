/* ===== Dashboard quản trị =====

   Bố cục theo thứ tự mắt Admin nhìn vào khi mở trang:
     1. Việc cần xử lý  2. Số lịch hôm nay  3. Lịch kế tiếp
     4. Ai đang làm     5. Doanh thu          6. Dịch vụ nổi bật

   Hàng 1: năm thẻ KPI.  Hàng 2: lịch hẹn hôm nay + việc cần xử lý.
   Hàng 3: nhân viên hôm nay + cơ cấu trạng thái.  Hàng 4: doanh thu + dịch vụ.
   Mọi số đều đến từ GET /api/admin/overview — không có số bịa. */

import { useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatusBadge } from '../components/Primitives';
import { useApp, type Booking, type ChartRange, type Overview, type ViewName } from '../store';
import {
  fmtDate, fmtDay, fmtRating, fmtTime, formatVND, moneyShort, weekdayShort,
} from '../lib/utils';
import { DonutChart, LineChart } from '../components/Charts';
import { WalkInDrawer } from '../components/WalkInDrawer';
import { ReviewPanel } from '../components/ReviewPanel';

/** Thẻ KPI bấm được: bấm để sang trang tương ứng, đã lọc sẵn. */
function KpiCard({
  tone, icon, label, value, note, alert, onClick,
}: {
  tone: 'rose' | 'sage' | 'gold' | 'lavender';
  icon: IconName;
  label: string; value: string | number; note: string;
  alert?: boolean; onClick?: () => void;
}) {
  return (
    <button
      className={`svc-stat svc-stat-${tone} adm-kpi${alert ? ' is-alert' : ''}`}
      onClick={onClick}
      aria-label={`${label}: ${value}. ${note}`}
    >
      <span className="svc-stat-icon"><Icon name={alert ? 'ban' : icon} /></span>
      <span className="svc-stat-copy">
        <span className="svc-stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{alert ? `⚠ ${note}` : note}</small>
      </span>
    </button>
  );
}

/** Trạng thái của nhân viên, hiển thị bằng chữ kèm màu. */
const STAFF_STATE: Record<string, { label: string; tone: string }> = {
  BUSY: { label: 'Đang phục vụ', tone: 'processing' },
  UPCOMING: { label: 'Sắp có lịch', tone: 'confirmed' },
  DONE: { label: 'Đã xong ca', tone: 'completed' },
  FREE: { label: 'Rảnh', tone: 'completed' },
  OFF: { label: 'Nghỉ', tone: 'pending' },
};

const RANGES: { key: ChartRange; label: string }[] = [
  { key: '7', label: '7 ngày' },
  { key: '30', label: '30 ngày' },
  { key: 'month', label: 'Tháng này' },
];

/* Màu biểu đồ tròn lấy đúng bảng màu của badge trạng thái đang dùng. */
type Today = Overview['today'];
const SLICES = (today: Today) => ([
  { label: 'Chờ xác nhận', value: today.pending, color: '#C9922F' },
  { label: 'Đã xác nhận', value: today.confirmed, color: '#765E8B' },
  { label: 'Đang thực hiện', value: today.processing, color: '#D56B81' },
  { label: 'Hoàn thành', value: today.completed, color: '#4E7D74' },
  { label: 'Đã huỷ', value: today.cancelled + today.noShow, color: '#B6A3AB' },
]);

export function AdminDashboardPage() {
  const { state, dispatch, chartRange, setChartRange, reload } = useApp();
  const { overview, user, loading, feedback } = state;

  const [walkIn, setWalkIn] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* Mọi useState phải nằm TRƯỚC mọi return sớm (Rules of Hooks). Trước đây
     actionError khai báo sau `if (!overview) return ...` nên lần render đầu
     (đang tải) ít hook hơn lần sau — React crash trắng trang. */
  const [actionError, setActionError] = useState('');

  const go = (view: ViewName) => dispatch({ type: 'view', view });

  /* Lỗi tải dữ liệu — hiện cho người dùng, không lộ chi tiết kỹ thuật. */
  if (feedback && !overview) {
    return (
      <Panel>
        <EmptyState title="Không thể tải dữ liệu Dashboard" detail="Vui lòng thử lại." />
        <div className="adm-modal-foot" style={{ justifyContent: 'center' }}>
          <button className="button" onClick={reload}><Icon name="refresh" /> Thử lại</button>
        </div>
      </Panel>
    );
  }

  /* Đang tải lần đầu — hiện khung xám thay vì quay toàn màn hình. */
  if (!overview) return <DashboardSkeleton />;

  const { today, pendingAll, revenue, todayBookings, staffToday, chart, topServices, todos } = overview;

  /* Thao tác nhanh trên dòng. Chỉ những bước thuộc về quản trị:

  /* Chỉ những bước thuộc về quản trị: Xác nhận, Đánh dấu không đến,
     Hủy kèm lý do. Hai bước của nhân viên (Bắt đầu/Hoàn thành) backend
     trả 403 nên không hiện nút. */
  async function setStatus(booking: Booking, status: string, extra?: Record<string, unknown>) {
    setBusyId(booking.id);
    setActionError('');
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(payload?.message ?? 'Không cập nhật được trạng thái.');
        return;
      }
      reload();
    } catch {
      setActionError('Mất kết nối tới máy chủ.');
    } finally {
      setBusyId(null);
    }
  }

  function cancelBooking(booking: Booking) {
    const reason = window.prompt(`Lý do hủy lịch #${booking.id}:`, '');
    if (reason === null) return;
    if (!reason.trim()) {
      setActionError('Hủy lịch phải nhập lý do.');
      return;
    }
    setStatus(booking, 'CANCELLED', { cancelReason: reason.trim() });
  }

  return (
    <>
      {/* Tiêu đề riêng của Dashboard: lời chào + ngày + nút tạo lịch nổi bật */}
      <div className="adm-hero">
        <div>
          <h2>Xin chào, {user?.name ?? 'Quản lý'}</h2>
          <p>Đây là tình hình hoạt động của cửa hàng hôm nay.</p>
        </div>
        <div className="adm-hero-side">
          <span className="adm-today">Hôm nay: {fmtDate(new Date().toISOString())}</span>
          <button className="button adm-primary" onClick={() => setWalkIn(true)}>
            <Icon name="plus" /> Tạo lịch Walk-in
          </button>
        </div>
      </div>

      {/* Hàng 1 — năm thẻ KPI */}
      <div className="adm-tiles adm-tiles-5">
        <KpiCard tone="rose" icon="schedule" label="Lịch hẹn hôm nay" value={today.total}
          note={`${today.confirmed} đã xác nhận`} onClick={() => go('admin-bookings')} />
        <KpiCard tone="gold" icon="clock" label="Chờ xác nhận" value={pendingAll}
          note={pendingAll > 0 ? 'cần xử lý' : 'không còn lịch chờ'}
          alert={pendingAll > 0} onClick={() => go('admin-bookings')} />
        <KpiCard tone="lavender" icon="play" label="Đang thực hiện" value={today.processing}
          note={`${today.processing} khách đang làm`} onClick={() => go('admin-bookings')} />
        <KpiCard tone="sage" icon="done" label="Đã hoàn thành" value={today.completed}
          note="trong hôm nay" onClick={() => go('admin-bookings')} />
        <KpiCard tone="rose" icon="dollar" label="Tiền thu hôm nay" value={moneyShort(revenue.paidAmount)}
          note={`${revenue.paidCount} giao dịch đã trả · cọc ${moneyShort(revenue.depositAmount)}`} onClick={() => go('admin-payments')} />
      </div>

      {/* Hàng 2 — hai biểu đồ, đặt ngay dưới hàng KPI để có cái nhìn tổng
          quan trước khi đọc tới từng dòng lịch. */}
      <div className="adm-dash-row">
        <Panel>
          <SectionHeading
            icon={<Icon name="dollar" />}
            title="Doanh thu dịch vụ"
            subtitle="Lịch COMPLETED + đã trả, theo ngày thực hiện"
          >
            <div className="mode-tabs">
              {RANGES.map((item) => (
                <button key={item.key} className={chartRange === item.key ? 'active' : ''}
                  onClick={() => setChartRange(item.key)}>{item.label}</button>
              ))}
            </div>
          </SectionHeading>
          <div className="adm-chart-wrap">
            {chart.every((point) => point.revenue === 0) ? (
              <EmptyState title="Chưa có giao dịch trong khoảng này"
                detail="Biểu đồ sẽ có dữ liệu khi phát sinh doanh thu." />
            ) : (
              <>
                {/* Đường có trục tung tính theo triệu; rê chuột hiện số tiền */}
                <LineChart
                  unit="tr"
                  data={chart.map((point) => ({
                    label: chart.length <= 10
                      ? weekdayShort(point.day)
                      : fmtDay(point.day).slice(0, 5),
                    value: point.revenue,
                    hint: `${fmtDate(point.day)} · ${point.bookings} lịch`,
                  }))}
                />
                <p className="adm-chart-foot">
                  Tổng {formatVND(chart.reduce((sum, point) => sum + point.revenue, 0))}
                </p>
              </>
            )}
          </div>
        </Panel>

        <Panel>
          <SectionHeading icon={<Icon name="check" />} title="Trạng thái lịch hẹn" subtitle="Trong hôm nay" />
          <div className="adm-tools" style={{ paddingBottom: 16 }}>
            <div className="adm-donut-row">
              <DonutChart slices={SLICES(today)} />
              <div className="adm-donut-legend">
                {SLICES(today).map((row) => (
                  <div key={row.label}>
                    <i style={{ background: row.color }} />
                    <span>{row.label}</span>
                    <b>{row.value}</b>
                    <small>{today.total > 0 ? `${Math.round((row.value / today.total) * 100)}%` : '0%'}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Hàng 3 — lịch hẹn hôm nay + việc cần xử lý */}
      <div className="adm-dash-row">
        <Panel>
          <SectionHeading
            icon={<Icon name="schedule" />}
            title="Lịch hẹn hôm nay"
            subtitle={`${todayBookings.length} lịch · ${today.total} tất cả`}
          >
            <button className="text-button" onClick={() => go('admin-bookings')}>Xem tất cả →</button>
          </SectionHeading>
          {actionError && <p className="adm-error" style={{ padding: '0 16px' }}>{actionError}</p>}

          {todayBookings.length === 0 ? (
            <EmptyState title="Hôm nay chưa có lịch hẹn"
              detail="Các lịch hẹn mới sẽ xuất hiện tại đây." />
          ) : (
            <div className="table-scroll">
              <table className="adm-table adm-table-wide">
                <thead>
                  <tr>
                    <th className="adm-stt">STT</th><th>Giờ</th><th>Khách hàng</th><th>Dịch vụ</th>
                    <th>Nhân viên</th><th>Trạng thái</th><th>Thanh toán</th><th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {todayBookings.map((booking, index) => (
                    <tr key={booking.id}>
                      <td className="adm-stt">{index + 1}</td>
                      <td>
                        <strong>{fmtTime(booking.startsAt)}</strong>
                        <small>{booking.duration}′</small>
                      </td>
                      <td>
                        <strong>{booking.customerName}</strong>
                        <small>{booking.customerPhone}</small>
                      </td>
                      <td>
                        <strong>{booking.serviceName}</strong>
                        <small>{formatVND(booking.price)}</small>
                      </td>
                      <td>{booking.staffName ?? <span className="adm-none">Chưa phân công</span>}</td>
                      <td><StatusBadge status={booking.status} /></td>
                      <td>
                        {booking.paymentText
                          ? <span className={`badge ${booking.paymentStatus === 'PAID' ? 'completed'
                            : booking.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                            <i />{booking.paymentText}
                          </span>
                          : <span className="adm-none">Chưa ghi nhận</span>}
                      </td>
                      <td>
                        <span className="adm-row-actions">
                          {booking.status === 'PENDING' && (
                            <button className="adm-text-btn" disabled={busyId === booking.id}
                              onClick={() => setStatus(booking, 'CONFIRMED')}>
                              {busyId === booking.id ? '…' : 'Xác nhận'}
                            </button>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <button className="adm-text-btn" disabled={busyId === booking.id}
                              onClick={() => setStatus(booking, 'NO_SHOW')}>Không đến</button>
                          )}
                          {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                            <button className="adm-icon-btn" aria-label="Huỷ lịch hẹn"
                              disabled={busyId === booking.id}
                              onClick={() => cancelBooking(booking)}>
                              <Icon name="ban" />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Việc cần xử lý — Admin không phải mở từng menu để tìm vấn đề */}
        <Panel>
          <SectionHeading icon={<Icon name="bell" />} title="Việc cần xử lý" />
          <div className="adm-todo">
            {([
              { count: todos.pending, label: 'lịch chờ xác nhận', icon: 'clock', view: 'admin-bookings' },
              { count: todos.leave, label: 'yêu cầu nghỉ hôm nay', icon: 'pause', view: 'admin-leave' },
              { count: todos.unpaid, label: 'chưa thanh toán', icon: 'card', view: 'admin-payments' },
              { count: todos.unassigned, label: 'chưa phân công người', icon: 'adminStaff', view: 'admin-bookings' },
            ] as { count: number; label: string; icon: IconName; view: ViewName }[]).map((item) => (
              <button key={item.label} className="adm-todo-row" onClick={() => go(item.view)}>
                <Icon name={item.icon} />
                <span><strong>{item.count}</strong> {item.label}</span>
                <span className="adm-todo-arrow">→</span>
              </button>
            ))}
            {todos.pending + todos.leave + todos.unpaid + todos.unassigned === 0 && (
              <p className="adm-todo-clear"><Icon name="check" /> Không có việc nào cần xử lý.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Hàng 4 — nhân viên hôm nay + dịch vụ phổ biến */}
      <div className="adm-dash-row">
        <Panel>
          <SectionHeading
            icon={<Icon name="adminStaff" />}
            title="Nhân viên hôm nay"
            subtitle={`${staffToday.length} người có ca`}
          >
            <button className="text-button" onClick={() => go('admin-staff')}>Xem tất cả →</button>
          </SectionHeading>
          {staffToday.length === 0 ? (
            <EmptyState title="Hôm nay không có ai làm ca" detail="Xếp ca ở trang Lịch làm việc." />
          ) : (
            <div className="adm-staff-list">
              {staffToday.map((person) => {
                const meta = STAFF_STATE[person.status] ?? STAFF_STATE.FREE;
                return (
                  <div key={person.id} className="adm-staff-row">
                    <Avatar name={person.name} url={person.avatarUrl} size={32} />
                    <span className="adm-staff-who">
                      <strong>{person.name}</strong>
                      <small>
                        {person.shiftStart
                          ? `${person.shiftStart.slice(0, 5)} – ${person.shiftEnd?.slice(0, 5)}`
                          : 'Không có ca'}
                      </small>
                    </span>
                    <span className="adm-staff-count">{person.bookingCount} lịch</span>
                    <span className={`badge ${meta.tone}`}><i />{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionHeading
            icon={<Icon name="sparkles" />}
            title="Dịch vụ nổi bật"
            subtitle="Hoàn thành trong khoảng đang chọn · xếp theo lượt"
          >
            <button className="text-button" onClick={() => go('admin-services')}>Xem tất cả →</button>
          </SectionHeading>
          <div className="adm-feed" style={{ padding: '0 16px 16px' }}>
            {topServices.length === 0 ? (
              <EmptyState title="Chưa có dịch vụ nào" detail="Thống kê sẽ hiện khi có lịch hẹn." />
            ) : topServices.map((service) => (
              <div key={service.id} className="adm-top-row">
                <span className="adm-top-name">{service.name}</span>
                <span className="adm-top-nums">
                  <strong>{service.bookings} lượt</strong>
                  <small>{formatVND(service.revenue)}</small>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Đánh giá mới nhất — thông tin phụ, đặt cuối trang */}
      <Panel style={{ marginTop: 18 }}>
        <SectionHeading
          icon={<Icon name="star" />}
          title="Đánh giá mới nhất"
          subtitle={`${state.reviewStats.total} đánh giá · trung bình ${fmtRating(state.reviewStats.average)}`}
        >
          <button className="text-button" onClick={() => go('admin-reviews')}>Xem tất cả →</button>
        </SectionHeading>
        <div className="adm-tools" style={{ paddingBottom: 16 }}>
          <ReviewPanel reviews={state.reviews.slice(0, 4)} />
        </div>
      </Panel>

      {loading && <p className="app-note">Đang cập nhật số liệu…</p>}

      {walkIn && (
        <WalkInDrawer
          actorName={user?.name ?? 'Quản trị viên'}
          onClose={() => setWalkIn(false)}
          onDone={() => { setWalkIn(false); reload(); }}
        />
      )}
    </>
  );
}

/** Khung xám lúc tải — thay cho spinner toàn màn hình. */
function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải dữ liệu">
      <div className="adm-tiles adm-tiles-5">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="adm-skel adm-kpi-skel" />)}
      </div>
      <div className="adm-dash-row">
        <div className="adm-skel adm-skel-panel" />
        <div className="adm-skel adm-skel-panel" />
      </div>
      <div className="adm-dash-row">
        <div className="adm-skel adm-skel-panel" />
        <div className="adm-skel adm-skel-panel" />
      </div>
    </div>
  );
}
