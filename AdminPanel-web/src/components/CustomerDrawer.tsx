/* ===== Khung chi tiết khách hàng =====

   Bố cục theo kiểu "xem nhanh một người": hồ sơ ở trên cùng, chỉ số thành
   dải số ngắn, thông tin liên hệ có biểu tượng để quét mắt, rồi tới lịch
   sử đặt dịch vụ.

   Ba loại trạng thái luôn tách bạch, không trộn vào nhau:
     trạng thái tài khoản (Active/Inactive) ≠ trạng thái lịch ≠ trạng thái
     thanh toán. Một lịch có thể đã hoàn thành mà vẫn chưa thu tiền. */

import { useCallback, useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Avatar } from './Avatar';
import { StatusBadge } from './Primitives';
import { Drawer } from './Drawer';
import { useApp } from '../store';
import { fmtDate, fmtNum, fmtTime, formatVND } from '../lib/utils';

interface CustomerBooking {
  id: string; code: string;
  startsAt: string; endsAt: string;
  status: string; statusText: string;
  source: string; sourceText: string;
  serviceName: string; staffName: string | null;
  paymentStatus: string | null; paymentText: string | null;
  price: number; addonTotal: number; total: number;
}

interface CustomerPayment {
  id: string; bookingId: string; amount: number;
  methodText: string; status: string; statusText: string; paidAt: string | null;
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

/* Một dòng thông tin: biểu tượng, nhãn nhỏ, giá trị lớn. */
function Info({ icon, label, value }: {
  icon: IconName; label: string; value: React.ReactNode;
}) {
  return (
    <div className="adm-di-row">
      <span className="adm-di-icon"><Icon name={icon} /></span>
      <span>
        <small>{label}</small>
        <strong>{value ?? 'Chưa cập nhật'}</strong>
      </span>
    </div>
  );
}

/** Ô số liệu nhỏ trong dải số. */
function MiniStat({ icon, value, label, tone }: {
  icon: IconName; value: React.ReactNode; label: string;
  tone: 'rose' | 'gold' | 'sage';
}) {
  return (
    <div className={`adm-dstat is-${tone}`}>
      <Icon name={icon} />
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

const HISTORY_TABS = [
  { key: 'all', label: 'Ngày đặt' },
  { key: 'service', label: 'Dịch vụ' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'money', label: 'Thanh toán' },
];

export function CustomerDrawer({ customerId, onClose }: {
  customerId: string;
  onClose: () => void;
}) {
  const { openBookingDetail } = useApp();

  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`);
      const payload = await response.json();
      if (!response.ok) return setError(payload.message ?? 'Không tải được hồ sơ khách hàng.');
      setData(payload.data);
      setError('');
    } catch {
      setError('Mất kết nối tới máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  /* Khung mở lại khách khác thì phải trả tab về mặc định, không giữ lại
     lựa chọn của khách trước. */
  useEffect(() => { setTab('all'); }, [customerId]);

  if (loading) {
    return (
      <Drawer title="Thông tin khách hàng" onClose={onClose} width={560}>
        <div className="adm-ds">
          <div className="adm-skel adm-skel-panel" />
          <div className="adm-skel adm-skel-panel" />
        </div>
      </Drawer>
    );
  }

  if (error || !data) {
    return (
      <Drawer title="Thông tin khách hàng" onClose={onClose} width={560}>
        <p className="login-admin-error">{error}</p>
      </Drawer>
    );
  }

  /* Khách quen: có từ 3 lịch trở lên và không vắng mặt lần nào. */
  const loyal = data.bookingCount >= 3 && data.noShowCount === 0;
  const risky = data.noShowCount > 0;

  const shown = tab === 'service' ? 'service' : tab === 'status' ? 'status' : tab === 'money' ? 'money' : 'day';

  return (
    <Drawer
      title="Thông tin khách hàng"
      subtitle={`${data.bookingCount} lịch hẹn tính đến nay · khách từ ${fmtDate(data.createdAt)}`}
      onClose={onClose}
      width={560}
      footer={(
        <div className="adm-drawer-actions">
          <button className="button secondary" onClick={onClose}>Đóng</button>
          <button className="button" onClick={() => openBookingDetail(data.bookings[0]?.id ?? '')}>
            <Icon name="schedule" /> Xem lịch gần nhất
          </button>
        </div>
      )}
    >
      {/* Hồ sơ: tên và các nhãn định danh */}
      <div className="adm-dprofile">
        <Avatar name={data.name} url={data.avatarUrl} size={58} />
        <div className="adm-dprofile-copy">
          <h3>{data.name}</h3>
          <p>{data.code} · {data.phone}</p>
          <div className="adm-dprofile-tags">
            <span className={`badge ${data.status === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
              <i />{data.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
            </span>
            {loyal && <span className="badge confirmed"><i />Khách thân thiết</span>}
            {risky && <span className="badge cancelled"><i />Có lượt vắng mặt</span>}
          </div>
        </div>
      </div>

      {/* Dải số: ba con số Admin hay xem nhất */}
      <div className="adm-dstats">
        <MiniStat tone="rose" icon="schedule" value={fmtNum(data.bookingCount)} label="Lần đặt" />
        <MiniStat tone="gold" icon="check" value={fmtNum(data.completedCount)} label="Hoàn thành" />
        <MiniStat tone="sage" icon="dollar" value={formatVND(data.totalSpending)} label="Tổng chi tiêu" />
      </div>

      {/* Thông tin liên hệ và tài khoản */}
      <section className="adm-dblock">
        <h4>Thông tin khách hàng</h4>
        <div className="adm-dinfo">
          <Info icon="phone" label="Số điện thoại" value={data.phone} />
          <Info icon="email" label="Email" value={data.email} />
          <Info icon="address" label="Địa chỉ" value={data.address} />
          <Info icon="calendar" label="Ngày sinh" value={data.birthday ? fmtDate(data.birthday) : null} />
        </div>
      </section>

      {/* Phân bổ trạng thái: ba trạng thái lịch, tách khỏi trạng thái tài khoản */}
      <section className="adm-dblock">
        <h4>Tình hình sử dụng</h4>
        <div className="adm-dspread">
          <span className="is-ok"><i />{data.completedCount} hoàn thành</span>
          <span className="is-mute"><i />{data.cancelledCount} đã hủy</span>
          <span className="is-bad"><i />{data.noShowCount} không đến</span>
        </div>
        <p className="adm-field-note">
          Lần ghé gần nhất: {data.lastVisit ? `${fmtDate(data.lastVisit)} · ${fmtTime(data.lastVisit)}` : 'chưa có lịch nào'}
          {data.payments.filter((p) => p.status === 'PAID').length > 0
            && ` · ${data.payments.filter((p) => p.status === 'PAID').length} giao dịch đã thanh toán`}
        </p>
      </section>

      {/* Lịch sử đặt dịch vụ */}
      <section className="adm-dblock">
        <h4>Lịch sử đặt dịch vụ <em>{data.bookings.length} lịch</em></h4>

        <div className="adm-dtabs">
          {HISTORY_TABS.map((item) => (
            <button key={item.key} className={tab === item.key ? 'is-on' : ''}
              onClick={() => setTab(item.key)}>{item.label}</button>
          ))}
        </div>

        {data.bookings.length === 0 ? (
          <p className="adm-field-note">Khách hàng này chưa đặt lịch nào.</p>
        ) : (
          <ul className="adm-dlist">
            {data.bookings.map((booking) => (
              <li key={booking.id}>
                <button onClick={() => openBookingDetail(booking.id)}>
                  {shown !== 'service' && (
                    <span className="adm-dlist-when">
                      <strong>{fmtDate(booking.startsAt)}</strong>
                      <small>{fmtTime(booking.startsAt)}</small>
                    </span>
                  )}
                  {shown !== 'money' && (
                    <span className="adm-dlist-what">
                      <strong>{booking.serviceName}</strong>
                      <small>{booking.staffName ?? 'Chưa phân công nhân viên'}</small>
                    </span>
                  )}
                  {shown !== 'status' && <StatusBadge status={booking.status} />}
                  <span className="adm-dlist-sum">
                    <strong>{formatVND(booking.total)}</strong>
                    <small className={`is-${booking.paymentStatus === 'PAID' ? 'ok' : 'warn'}`}>
                      {booking.paymentText ?? 'Chưa ghi nhận'}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Drawer>
  );
}
