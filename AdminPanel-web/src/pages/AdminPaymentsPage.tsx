/* ===== Trang Doanh thu & Thanh toán =====
   Số liệu từ GET /api/admin/payments: tổng đã thu, đã đặt cọc, chưa thanh toán,
   biểu đồ theo tháng và danh sách từng giao dịch kèm lịch hẹn tương ứng. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { fmtDate, fmtNum, formatVND, moneyShort } from '../lib/utils';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  ONLINE: 'Online',
};

/** "2026-09" -> "Thg 9/2026". */
function monthLabel(month: string): string {
  const [year, value] = month.split('-');
  return value ? `Thg ${Number(value)}/${year}` : month;
}

export function AdminPaymentsPage() {
  const { state } = useApp();
  const { payments, paymentMonths, paymentTotals } = state;

  const [status, setStatus] = useState('');
  const [term, setTerm] = useState('');

  const rows = payments
    .filter((payment) => !status || payment.paymentStatus === status)
    .filter((payment) => {
      if (!term) return true;
      const key = term.toLowerCase();
      return payment.customerName.toLowerCase().includes(key)
        || payment.serviceName.toLowerCase().includes(key)
        || (payment.staffName ?? '').toLowerCase().includes(key);
    });

  const peak = Math.max(...paymentMonths.map((item) => item.paidAmount), 1);

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="sage" icon="dollar" label="Đã thu" value={moneyShort(paymentTotals.paid)}
          note="tiền vào thực tế" />
        <StatTile tone="gold" icon="card" label="Đã đặt cọc" value={moneyShort(paymentTotals.deposit)}
          note="chờ hoàn thành buổi làm" />
        <StatTile tone="rose" icon="ban" label="Chưa thanh toán" value={moneyShort(paymentTotals.unpaid)}
          note="cần thu hồi" />
        <StatTile tone="lavender" icon="services" label="Tổng giá trị" value={moneyShort(paymentTotals.all)}
          note={`${payments.length} giao dịch`} />
      </div>

      <Panel style={{ marginBottom: 18 }}>
        <SectionHeading
          icon={<Icon name="dollar" />}
          title="Doanh thu theo tháng"
          subtitle="Chỉ tính các giao dịch đã thu đủ"
        >
          <strong style={{ fontSize: 15, fontWeight: 600 }}>
            {formatVND(paymentMonths.reduce((sum, item) => sum + item.paidAmount, 0))}
          </strong>
        </SectionHeading>
        <div style={{ padding: '0 16px 16px' }}>
          {paymentMonths.length === 0 ? (
            <EmptyState title="Chưa có giao dịch" detail="Doanh thu sẽ hiện khi có lịch hoàn thành." />
          ) : (
            <div className="adm-chart">
              {paymentMonths.map((item) => (
                <div key={item.month} className="adm-chart-col"
                  title={`${monthLabel(item.month)}: ${formatVND(item.paidAmount)}`}>
                  <div className="adm-chart-bar"
                    style={{ height: `${Math.max(6, (item.paidAmount / peak) * 150)}px` }} />
                  <small>{monthLabel(item.month)}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <SectionHeading
          icon={<Icon name="card" />}
          title="Danh sách giao dịch"
          subtitle={`${rows.length} trong ${payments.length} giao dịch`}
        />

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm giao dịch"
              placeholder="Tìm khách hàng, dịch vụ, nhân viên…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select aria-label="Lọc theo trạng thái" value={status}
            onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="DEPOSITED">Đã đặt cọc</option>
            <option value="UNPAID">Chưa thanh toán</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không có giao dịch phù hợp" detail="Đổi bộ lọc hoặc từ khoá tìm kiếm." />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Khách hàng</th>
                  <th>Dịch vụ</th>
                  <th>Nhân viên</th>
                  <th>Số tiền</th>
                  <th>Hình thức</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.paymentDate ? fmtDate(payment.paymentDate) : fmtDate(payment.startsAt)}</strong>
                      <small>{METHOD_LABEL[payment.paymentMethod] ?? payment.methodText}</small>
                    </td>
                    <td>{payment.customerName}</td>
                    <td>{payment.serviceName}</td>
                    <td>{payment.staffName ?? <span className="adm-none">—</span>}</td>
                    <td><strong>{formatVND(payment.amount)}</strong></td>
                    <td>{payment.methodText}</td>
                    <td>
                      <span className={`badge ${payment.paymentStatus === 'PAID' ? 'completed'
                        : payment.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                        <i />{payment.statusText}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="app-note">
        Tổng cộng {fmtNum(payments.length)} giao dịch — doanh thu tính theo lịch hẹn đã hoàn thành.
      </p>
    </>
  );
}
