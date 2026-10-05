/* ===== Trang Doanh thu & Thanh toán =====
   Số liệu từ GET /api/admin/payments: tổng đã thu, đã đặt cọc, chưa thanh toán,
   biểu đồ theo tháng và danh sách từng giao dịch kèm lịch hẹn tương ứng. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtDate, fmtNum, formatVND, moneyShort } from '../lib/utils';
import type { PaymentItem } from '../store';

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
  const { state, reload } = useApp();
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

  /* Ghi nhận / sửa thanh toán. PAID thì backend tự chốt đúng tổng nên ô
     số tiền để trống được; DEPOSITED bắt buộc nhập số cọc. */
  const [form, setForm] = useState({
    bookingId: '', payStatus: 'PAID', amount: '', method: 'CASH', note: '',
  });
  const [editing, setEditing] = useState<PaymentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function startEdit(payment: PaymentItem) {
    setEditing(payment);
    setForm({
      bookingId: payment.bookingId, payStatus: payment.paymentStatus,
      amount: String(payment.amount), method: payment.paymentMethod, note: '',
    });
    setFeedback('');
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ bookingId: '', payStatus: 'PAID', amount: '', method: 'CASH', note: '' });
    setFeedback('');
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bookingId.trim() && !editing) {
      setFeedback('Cần nhập mã lịch hẹn.');
      return;
    }
    setBusy(true);
    setFeedback('');
    const body: Record<string, unknown> = {
      status: form.payStatus,
      method: form.method,
      note: form.note.trim() || undefined,
    };
    if (form.amount.trim()) body.amount = Number(form.amount);
    const result = editing
      ? await sendAdmin(`/payments/${editing.id}`, 'PATCH', body)
      : await sendAdmin(`/bookings/${form.bookingId.trim()}/payment`, 'POST', body);
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setFeedback(editing ? 'Đã cập nhật thanh toán.' : 'Đã ghi nhận thanh toán.');
    cancelEdit();
    reload();
  }

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
          icon={<Icon name="card" />}
          title={editing ? `Sửa thanh toán lịch #${editing.bookingId}` : 'Ghi nhận thanh toán'}
          subtitle={editing
            ? 'Đổi trạng thái, số tiền hoặc hình thức trả'
            : 'Thu tiền tại quầy cho một lịch hẹn'}
        />
        <form className="adm-form" onSubmit={submitPayment} style={{ padding: '0 16px 16px' }}>
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Mã lịch hẹn</span>
              <input
                value={form.bookingId} onChange={set('bookingId')}
                placeholder="Ví dụ: 294" disabled={busy || !!editing}
                inputMode="numeric"
              />
            </label>
            <label className="adm-field">
              <span>Trạng thái</span>
              <select value={form.payStatus} onChange={set('payStatus')} disabled={busy}>
                <option value="PAID">Đã thanh toán đủ</option>
                <option value="DEPOSITED">Đặt cọc một phần</option>
                <option value="UNPAID">Chưa thanh toán</option>
              </select>
            </label>
          </div>
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Số tiền (đ) — PAID để trống = thu đủ tổng</span>
              <input
                value={form.amount} onChange={set('amount')}
                placeholder="Ví dụ: 100000" disabled={busy}
                inputMode="numeric"
              />
            </label>
            <label className="adm-field">
              <span>Hình thức</span>
              <select value={form.method} onChange={set('method')} disabled={busy}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
                <option value="ONLINE">Online</option>
              </select>
            </label>
          </div>
          <label className="adm-field">
            <span>Ghi chú</span>
            <input
              value={form.note} onChange={set('note')}
              placeholder="Ví dụ: khách chuyển khoản thiếu..." disabled={busy}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button" type="submit" disabled={busy}>
              {editing ? 'Lưu thay đổi' : 'Ghi nhận'}
            </button>
            {editing && (
              <button className="button secondary" type="button" disabled={busy} onClick={cancelEdit}>
                Hủy sửa
              </button>
            )}
          </div>
          {feedback && <p className="adm-error">{feedback}</p>}
        </form>
      </Panel>

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
                  <th>Sửa</th>
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
                    <td>
                      <button className="button secondary" onClick={() => startEdit(payment)}>
                        Sửa
                      </button>
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
