/* ===== Trang Chi tiết khách hàng =====

   Ba tab tách bạch ba loại thông tin vốn dễ bị lẫn:
     Tổng quan        — hồ sơ, thống kê, 5 lịch gần nhất
     Lịch sử đặt lịch — toàn bộ lịch của khách, lọc được
     Thanh toán      — từng khoản đã thu

   Trạng thái lịch và trạng thái thanh toán hiện ở hai cột riêng, vì một lịch
   có thể đã hoàn thành mà vẫn chưa thu tiền — nhìn chung sẽ tưởng là đã
   xong hết. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatusBadge } from '../components/Primitives';
import { useApp } from '../store';
import { fmtDate, fmtNum, fmtTime, formatVND } from '../lib/utils';

interface CustomerBooking {
  id: string; code: string; bookingId: string;
  startsAt: string; endsAt: string;
  status: string; statusText: string;
  source: string; sourceText: string;
  serviceName: string; staffName: string | null;
  paymentStatus: string | null; paymentText: string | null;
  methodText: string | null; paidAmount: number | null;
  price: number; addonTotal: number; total: number;
}

interface CustomerPayment {
  id: string; bookingId: string; amount: number;
  method: string; methodText: string;
  status: string; statusText: string; paidAt: string | null;
}

interface CustomerDetail {
  id: string; code: string; name: string; phone: string; email: string | null;
  avatarUrl: string | null; address: string | null; birthday: string | null;
  status: 'ACTIVE' | 'INACTIVE'; createdAt: string;
  bookingCount: number; completedCount: number;
  cancelledCount: number; noShowCount: number;
  lastVisit: string | null; totalSpending: number;
  bookings: CustomerBooking[]; payments: CustomerPayment[];
}

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'bookings', label: 'Lịch sử đặt lịch' },
  { key: 'payments', label: 'Thanh toán' },
] as const;

type TabKey = typeof TABS[number]['key'];

const HISTORY_STATUS = [
  { key: '', label: 'Tất cả' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'NO_SHOW', label: 'No-show' },
];

const PAYMENT_TONE: Record<string, string> = {
  PAID: 'completed',
  DEPOSITED: 'pending',
  UNPAID: 'cancelled',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="adm-cd-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <span className="adm-cd-stat"><strong>{value}</strong><small>{label}</small></span>;
}

export function AdminCustomerDetailPage() {
  const { state, openBookingDetail, closeCustomerDetail } = useApp();
  const { customerDetailId } = state;

  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [hStatus, setHStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    if (!customerDetailId) return;
    try {
      const response = await fetch(`/api/admin/customers/${customerDetailId}`);
      const payload = await response.json();
      if (!response.ok) return setError(payload.message ?? 'Không tải được hồ sơ khách hàng.');
      setData(payload.data);
      setError('');
    } catch {
      setError('Mất kết nối tới máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [customerDetailId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  /* Lọc lịch sử ngay trên máy: một khách chỉ có vài chục lịch nên không cần
     gọi lại API mỗi khi đổi điều kiện lọc. */
  const history = useMemo(() => {
    if (!data) return [];
    return data.bookings.filter((booking) => {
      if (hStatus && booking.status !== hStatus) return false;
      const day = booking.startsAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [data, hStatus, from, to]);

  if (!customerDetailId) return null;

  if (loading) {
    return (
      <div className="adm-cd-grid">
        <div className="adm-skel adm-skel-panel" />
        <div className="adm-skel adm-skel-panel" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState title="Không tìm thấy khách hàng"
        detail={error || 'Khách hàng có thể đã bị xóa khỏi hệ thống.'}>
        <button className="button" onClick={closeCustomerDetail}>Quay lại danh sách</button>
      </EmptyState>
    );
  }

  return (
    <>
      <button className="adm-back" onClick={closeCustomerDetail}>
        <Icon name="chevronDown" /> Quay lại Khách hàng
      </button>

      {/* Hồ sơ: thông tin liên hệ và số liệu ngay dưới tên */}
      <Panel className="adm-cd-head">
        <div className="adm-cd-head-body">
          <Avatar name={data.name} url={data.avatarUrl} size={62} />
          <div className="adm-cd-head-copy">
            <h1>{data.name}</h1>
            <p className="subtitle">
              {data.code} · {data.phone}
              {data.email ? ` · ${data.email}` : ''}
            </p>
            <span className={`badge ${data.status === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
              <i />{data.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>

        <div className="adm-cd-stats">
          <Stat label="Tổng lịch" value={fmtNum(data.bookingCount)} />
          <Stat label="Hoàn thành" value={fmtNum(data.completedCount)} />
          <Stat label="Đã hủy" value={fmtNum(data.cancelledCount)} />
          <Stat label="No-show" value={fmtNum(data.noShowCount)} />
          <Stat label="Tổng chi tiêu" value={formatVND(data.totalSpending)} />
        </div>
      </Panel>

      {/* Ba tab */}
      <div className="mode-tabs adm-cd-tabs">
        {TABS.map((item) => (
          <button key={item.key} className={tab === item.key ? 'active' : ''}
            onClick={() => setTab(item.key)}>
            {item.label}
            {item.key === 'bookings' && <span>{data.bookings.length}</span>}
            {item.key === 'payments' && <span>{data.payments.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="adm-cd-grid">
            <Panel>
              <SectionHeading icon={<Icon name="profile" />} title="Thông tin khách hàng" />
              <dl className="adm-cd-list">
                <Row label="Họ tên">{data.name}</Row>
                <Row label="Số điện thoại">{data.phone}</Row>
                <Row label="Email">{data.email ?? '—'}</Row>
                <Row label="Trạng thái">
                  <span className={`badge ${data.status === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
                    <i />{data.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </Row>
                <Row label="Ngày tạo tài khoản">
                  {fmtDate(data.createdAt)} · {fmtTime(data.createdAt)}
                </Row>
                {data.address && <Row label="Địa chỉ">{data.address}</Row>}
                {data.birthday && <Row label="Ngày sinh">{fmtDate(data.birthday)}</Row>}
                <Row label="Mã khách">{data.code}</Row>
              </dl>
            </Panel>

            <Panel>
              <SectionHeading icon={<Icon name="check" />} title="Thống kê" />
              <dl className="adm-cd-list">
                <Row label="Tổng booking">{fmtNum(data.bookingCount)}</Row>
                <Row label="Completed">
                  <span className="badge completed"><i />{data.completedCount}</span>
                </Row>
                <Row label="Cancelled">
                  <span className="badge cancelled"><i />{data.cancelledCount}</span>
                </Row>
                <Row label="No-show">
                  <span className="badge no_show"><i />{data.noShowCount}</span>
                </Row>
                <Row label="Tổng chi tiêu">
                  <strong>{formatVND(data.totalSpending)}</strong>
                </Row>
                <Row label="Lần ghé gần nhất">
                  {data.lastVisit ? fmtDate(data.lastVisit) : 'Chưa có lịch'}
                </Row>
              </dl>
            </Panel>
          </div>

          <Panel>
            <SectionHeading
              icon={<Icon name="schedule" />}
              title="Lịch hẹn gần đây"
              subtitle={`5 lịch mới nhất trong tổng ${data.bookings.length} lịch`}
            >
              <button className="button secondary" onClick={() => setTab('bookings')}>
                Xem tất cả →
              </button>
            </SectionHeading>

            {data.bookings.length === 0 ? (
              <EmptyState title="Chưa có lịch hẹn"
                detail="Khách hàng này chưa đặt lịch nào trong khoảng dữ liệu hiện tại." />
            ) : (
              <div className="table-scroll">
                <table className="adm-table adm-table-cd">
                  <thead>
                    <tr>
                      <th>Mã lịch</th><th>Ngày giờ</th><th>Dịch vụ</th>
                      <th>Nhân viên</th><th>Trạng thái</th><th>Thanh toán</th>
                      <th className="adm-cs-num">Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookings.slice(0, 5).map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          <button className="adm-link" onClick={() => openBookingDetail(booking.id)}>
                            {booking.code}
                          </button>
                        </td>
                        <td>
                          <strong>{fmtDate(booking.startsAt)}</strong>
                          <small>{fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}</small>
                        </td>
                        <td>{booking.serviceName}</td>
                        <td>{booking.staffName ?? <span className="adm-none">Chưa phân công</span>}</td>
                        <td><StatusBadge status={booking.status} /></td>
                        <td>
                          {booking.paymentText
                            ? (
                              <span className={`badge ${PAYMENT_TONE[booking.paymentStatus ?? 'UNPAID']}`}>
                                <i />{booking.paymentText}
                              </span>
                            )
                            : <span className="adm-none">Chưa ghi nhận</span>}
                        </td>
                        <td className="adm-cs-num"><strong>{formatVND(booking.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'bookings' && (
        <Panel>
          <SectionHeading
            icon={<Icon name="schedule" />}
            title="Lịch sử đặt lịch"
            subtitle={`${history.length} trong tổng số ${data.bookings.length} lịch`}
          />

          <div className="adm-tools adm-cs-tools">
            <select aria-label="Lọc trạng thái lịch" value={hStatus}
              onChange={(e) => setHStatus(e.target.value)}>
              {HISTORY_STATUS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
            <label className="adm-cs-date">
              <span>Từ ngày</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="adm-cs-date">
              <span>Đến ngày</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            {(hStatus || from || to) && (
              <button className="button secondary"
                onClick={() => { setHStatus(''); setFrom(''); setTo(''); }}>
                <Icon name="refresh" /> Đặt lại
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <EmptyState title="Không có lịch hẹn"
              detail="Không có lịch nào khớp với điều kiện đang lọc." />
          ) : (
            <div className="table-scroll">
              <table className="adm-table adm-table-cd">
                <thead>
                  <tr>
                    <th>Booking ID</th><th>Ngày giờ</th><th>Dịch vụ</th>
                    <th>Nhân viên</th><th>Nguồn</th><th>Booking Status</th>
                    <th>Payment Status</th><th className="adm-cs-num">Tổng tiền</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <button className="adm-link" onClick={() => openBookingDetail(booking.id)}>
                          {booking.code}
                        </button>
                      </td>
                      <td>
                        <strong>{fmtDate(booking.startsAt)}</strong>
                        <small>{fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}</small>
                      </td>
                      <td>{booking.serviceName}</td>
                      <td>{booking.staffName ?? <span className="adm-none">Chưa phân công</span>}</td>
                      <td><span className="badge confirmed"><i />{booking.sourceText}</span></td>
                      <td><StatusBadge status={booking.status} /></td>
                      <td>
                        {booking.paymentText
                          ? (
                            <span className={`badge ${PAYMENT_TONE[booking.paymentStatus ?? 'UNPAID']}`}>
                              <i />{booking.paymentText}
                            </span>
                          )
                          : <span className="adm-none">Chưa ghi nhận</span>}
                      </td>
                      <td className="adm-cs-num"><strong>{formatVND(booking.total)}</strong></td>
                      <td>
                        <button className="adm-icon-btn" aria-label={`Xem lịch ${booking.code}`}
                          onClick={() => openBookingDetail(booking.id)}>
                          <Icon name="settings" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'payments' && (
        <>
          <Panel className="adm-cd-sum">
            <div className="adm-bd-body">
              <SectionHeading icon={<Icon name="dollar" />} title="Tổng đã thanh toán"
                subtitle="Chỉ tính các giao dịch có trạng thái PAID" />
              <strong className="adm-cd-sum-value">{formatVND(data.totalSpending)}</strong>
              <span className="adm-cd-sum-note">
                trên {data.payments.filter((p) => p.status === 'PAID').length} giao dịch đã thu
              </span>
            </div>
          </Panel>

          <Panel>
            <SectionHeading icon={<Icon name="card" />} title="Danh sách thanh toán"
              subtitle={`${data.payments.length} giao dịch`} />

            {data.payments.length === 0 ? (
              <EmptyState title="Chưa có giao dịch"
                detail="Khách hàng này chưa có khoản thanh toán nào được ghi nhận." />
            ) : (
              <div className="table-scroll">
                <table className="adm-table adm-table-cd">
                  <thead>
                    <tr>
                      <th>Payment ID</th><th>Booking ID</th>
                      <th className="adm-cs-num">Số tiền</th><th>Phương thức</th>
                      <th>Trạng thái</th><th>Ngày thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td><strong>#{payment.id}</strong></td>
                        <td>
                          <button className="adm-link" onClick={() => openBookingDetail(payment.bookingId)}>
                            #{payment.bookingId}
                          </button>
                        </td>
                        <td className="adm-cs-num"><strong>{formatVND(payment.amount)}</strong></td>
                        <td>{payment.methodText}</td>
                        <td>
                          <span className={`badge ${PAYMENT_TONE[payment.status] ?? 'cancelled'}`}>
                            <i />{payment.statusText}
                          </span>
                        </td>
                        <td>
                          {payment.paidAt
                            ? `${fmtDate(payment.paidAt)} · ${fmtTime(payment.paidAt)}`
                            : <span className="adm-none">Chưa thanh toán</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
