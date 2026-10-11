/* ===== Khung chi tiết giao dịch =====
   Kiểu ngăn trượt như trang Khách hàng: hồ sơ ở trên, dải số, các khối
   thông tin có tiêu đề, nút hành động dưới cùng. */

import { Avatar } from './Avatar';
import { Drawer } from './Drawer';
import { Icon, type IconName } from './Icon';
import type { PaymentItem } from '../store';
import { fmtDate, fmtTime, formatVND } from '../lib/utils';

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

export function PaymentDrawer({ item, onClose, onEdit, onOpenBooking }: {
  item: PaymentItem;
  onClose: () => void;
  /** Mở hộp thoại sửa thanh toán. */
  onEdit: () => void;
  /** Sang trang chi tiết lịch hẹn. */
  onOpenBooking: () => void;
}) {
  return (
    <Drawer
      title="Chi tiết giao dịch"
      subtitle={`Lịch #${item.bookingId} · ${fmtDate(item.startsAt)} ${fmtTime(item.startsAt)}`}
      onClose={onClose}
      width={560}
      footer={(
        <div className="adm-drawer-actions">
          <button className="button secondary" onClick={onClose}>Đóng</button>
          <button className="button" onClick={onOpenBooking}>
            <Icon name="schedule" /> Xem lịch hẹn
          </button>
        </div>
      )}
    >
      <div className="adm-dprofile">
        <Avatar name={item.customerName} url={null} size={58} />
        <div className="adm-dprofile-copy">
          <h3>{item.customerName}</h3>
          <p>{item.serviceName}</p>
          <div className="adm-dprofile-tags">
            <span className={`badge ${item.paymentStatus === 'PAID' ? 'completed'
              : item.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
              <i />{item.statusText}
            </span>
          </div>
        </div>
      </div>

      <div className="adm-dstats">
        <MiniStat tone="rose" icon="dollar" value={formatVND(item.amount)} label="Số tiền" />
        <MiniStat tone="gold" icon="card" value={item.methodText ?? '—'} label="Hình thức" />
        <MiniStat tone="sage" icon="schedule"
          value={item.paymentDate ? fmtDate(item.paymentDate) : 'Chưa thu'} label="Ngày thu" />
      </div>

      <section className="adm-dblock">
        <h4>Thông tin thanh toán <em><button className="adm-link" onClick={onEdit}>Sửa</button></em></h4>
        <div className="adm-dinfo">
          <Info icon="card" label="Trạng thái" value={item.statusText} />
          <Info icon="dollar" label="Số tiền" value={formatVND(item.amount)} />
          <Info icon="calendar" label="Ngày ghi nhận"
            value={item.paymentDate ? `${fmtDate(item.paymentDate)} ${fmtTime(item.paymentDate)}` : 'Chưa ghi nhận'} />
        </div>
      </section>

      <section className="adm-dblock">
        <h4>Lịch hẹn liên quan</h4>
        <div className="adm-dinfo">
          <Info icon="schedule" label="Giờ hẹn" value={`${fmtDate(item.startsAt)} ${fmtTime(item.startsAt)}`} />
          <Info icon="services" label="Dịch vụ" value={item.serviceName} />
          <Info icon="adminStaff" label="Nhân viên" value={item.staffName ?? 'Chưa phân công'} />
        </div>
      </section>
    </Drawer>
  );
}
