/* ===== Trang Cài đặt =====
   Những gì trang này hiện đều đọc từ dữ liệu đang tải: quy mô cửa hàng, số liệu
   tổng quan và các mố liệt khoá dịch vụ. Phần thông tin doanh nghiệp sẽ nối vào
   bảng cấu hình khi có — hiện ghi rõ chỗ cần bổ sung thay vì bịa số. */

import { Icon } from '../components/Icon';
import { Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { fmtNum, moneyShort } from '../lib/utils';

export function AdminSettingsPage() {
  const { state, reload } = useApp();
  const { services, categories, staff, customers, bookings, payments } = state;

  const hidden = services.filter((service) => service.status === 'INACTIVE').length;
  const withoutStaff = services.filter((service) => service.staffCount === 0).length;
  const unassigned = bookings.filter((booking) => !booking.staffId).length;
  const unpaid = payments.filter((payment) => payment.paymentStatus !== 'PAID').length;

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="services" label="Danh mục" value={categories.length} note="nhóm dịch vụ" />
        <StatTile tone="sage" icon="check" label="Dịch vụ đang mở"
          value={`${services.length - hidden}/${services.length}`} note={`${hidden} đang tạm ẩn`} />
        <StatTile tone="gold" icon="adminStaff" label="Nhân viên" value={staff.length} note="tài khoản hoạt động" />
        <StatTile tone="lavender" icon="customers" label="Khách hàng" value={customers.length} note="hồ sơ trong hệ thống" />
      </div>

      <div className="adm-split-even">
        <Panel>
          <SectionHeading icon={<Icon name="shield" />} title="Thông tin cửa hàng" subtitle="NailHouse Studio" />
          <div className="adm-detail-list" style={{ margin: 16 }}>
            <div><dt>Tên cửa hàng</dt><dd>NailHouse Studio</dd></div>
            <div><dt>Giờ mở cửa</dt><dd>09:00 – 20:00</dd></div>
            <div><dt>Số nhân viên</dt><dd>{fmtNum(staff.length)}</dd></div>
            <div><dt>Số khách hàng</dt><dd>{fmtNum(customers.length)}</dd></div>
          </div>
          <p className="app-note" style={{ padding: '0 16px 16px' }}>
            Chưa có bảng cấu hình cửa hàng trong database. Các ô trên lấy số liệu
            từ bảng users/customer; giờ mở cửa đang để tĩnh.
          </p>
        </Panel>

        <Panel>
          <SectionHeading
            icon={<Icon name="settings" />}
            title="Kiểm tra dữ liệu"
            subtitle="Những mục nên xem lại"
          >
            <button className="button secondary" onClick={reload}>
              ↻ <span>Kiểm tra lại</span>
            </button>
          </SectionHeading>

          <div className="adm-check-list">
            <div className={withoutStaff > 0 ? 'is-warn' : 'is-ok'}>
              <Icon name={withoutStaff > 0 ? 'ban' : 'check'} />
              <span>
                <strong>{withoutStaff > 0 ? `${withoutStaff} dịch vụ chưa có nhân viên thực hiện` : 'Mọi dịch vụ đều có nhân viên phục vụ'}</strong>
                <small>Dịch vụ không có người làm sẽ không hiện với khách hàng.</small>
              </span>
            </div>
            <div className={unassigned > 0 ? 'is-warn' : 'is-ok'}>
              <Icon name={unassigned > 0 ? 'ban' : 'check'} />
              <span>
                <strong>{unassigned > 0 ? `${unassigned} lịch hẹn chưa phân công nhân viên` : 'Mọi lịch hẹn đều có nhân viên'}</strong>
                <small>Khách đang chờ sẽ không biết ai phục vụ.</small>
              </span>
            </div>
            <div className={unpaid > 0 ? 'is-warn' : 'is-ok'}>
              <Icon name={unpaid > 0 ? 'ban' : 'check'} />
              <span>
                <strong>{unpaid > 0 ? `${unpaid} giao dịch chưa thu đủ` : 'Đã thu đủ mọi giao dịch'}</strong>
                <small>Bao gồm cả tiền cọc và các lịch chưa thanh toán.</small>
              </span>
            </div>
            <div className="is-ok">
              <Icon name="dollar" />
              <span>
                <strong>Tổng giá trị các giao dịch: {moneyShort(payments.reduce((s, p) => s + p.amount, 0))}</strong>
                <small>Tính trên toàn bộ {fmtNum(payments.length)} bản ghi thanh toán.</small>
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
