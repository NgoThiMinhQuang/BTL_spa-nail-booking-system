/* ===== Trang Doanh thu & Thanh toán =====
   Số liệu từ GET /api/admin/payments: tổng đã thu, đã đặt cọc, chưa thanh toán,
   biểu đồ theo tháng và danh sách từng giao dịch kèm lịch hẹn tương ứng. */

import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { Drawer } from '../components/Drawer';
import { PaymentDrawer } from '../components/PaymentDrawer';
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
  const { state, reload, openBookingDetail } = useApp();
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

  const [editItem, setEditItem] = useState<PaymentItem | null>(null);
  const [drawerItem, setDrawerItem] = useState<PaymentItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBookingId, setCreateBookingId] = useState('');

  function startEdit(payment: PaymentItem) {
    /* Lịch chưa có dòng payment thì không sửa được — mở ngăn ghi mới
       điền sẵn mã lịch. */
    if (!payment.id) {
      setCreateBookingId(payment.bookingId);
      setCreateOpen(true);
      return;
    }
    setEditItem(payment);
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
          note="đã thu + cọc + còn nợ" />
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
        >
          <button className="button" onClick={() => { setCreateBookingId(''); setCreateOpen(true); }}>
            ＋ Ghi nhận
          </button>
        </SectionHeading>

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
            <option value="REFUNDED">Đã hoàn cọc</option>
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
                  <th className="adm-stt">STT</th><th>Ngày thu</th>
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
                {rows.map((payment, index) => (
                  <tr key={payment.bookingId} className="adm-row-click"
                    onClick={() => setDrawerItem(payment)}>
                    <td className="adm-stt">{index + 1}</td>
                    <td>
                      <strong>{payment.paymentDate ? fmtDate(payment.paymentDate) : '—'}</strong>
                      <small>{payment.paymentMethod ? METHOD_LABEL[payment.paymentMethod] ?? payment.methodText : `Chưa ghi nhận · hẹn ${fmtDate(payment.startsAt)}`}</small>
                    </td>
                    <td>{payment.customerName}</td>
                    <td>{payment.serviceName}</td>
                    <td>{payment.staffName ?? <span className="adm-none">—</span>}</td>
                    <td><strong>{formatVND(payment.amount)}</strong></td>
                    <td>{payment.methodText ?? <span className="adm-none">—</span>}</td>
                    <td>
                      <span className={`badge ${payment.paymentStatus === 'PAID' ? 'completed'
                        : payment.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                        <i />{payment.statusText}
                      </span>
                    </td>
                    <td>
                      <button className="button secondary" onClick={(e) => { e.stopPropagation(); startEdit(payment); }}>
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

      {drawerItem && (
        <PaymentDrawer
          item={drawerItem}
          onClose={() => setDrawerItem(null)}
          onEdit={() => { setDrawerItem(null); startEdit(drawerItem); }}
          onOpenBooking={() => { setDrawerItem(null); openBookingDetail(drawerItem.bookingId); }}
        />
      )}

      {createOpen && (
        <PaymentFormDrawer
          key={createBookingId}
          bookingId={createBookingId}
          onClose={() => setCreateOpen(false)}
          onDone={() => { setCreateOpen(false); reload(); }}
        />
      )}

      {editItem && (
        <EditPaymentModal
          key={editItem.id ?? editItem.bookingId}
          item={editItem}
          onClose={() => setEditItem(null)}
          onDone={() => { setEditItem(null); reload(); }}
        />
      )}
    </>
  );
}

/* Ngăn trượt ghi nhận thanh toán mới. */
function PaymentFormDrawer({ bookingId, onClose, onDone }: {
  bookingId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [formBookingId, setFormBookingId] = useState(bookingId);
  const [payStatus, setPayStatus] = useState('PAID');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formBookingId.trim()) {
      setError('Cần nhập mã lịch hẹn.');
      return;
    }
    setBusy(true);
    setError('');
    const body: Record<string, unknown> = {
      status: payStatus,
      method,
      note: note.trim() || undefined,
    };
    if (amount.trim()) body.amount = Number(amount);
    const result = await sendAdmin(`/bookings/${formBookingId.trim()}/payment`, 'POST', body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone();
  }

  return (
    <Drawer
      title="Ghi nhận thanh toán"
      subtitle="Thu tiền tại quầy cho một lịch hẹn"
      onClose={onClose}
      width={560}
      footer={(
        <div className="adm-drawer-actions">
          <button className="button secondary" disabled={busy} onClick={onClose}>
            Hủy bỏ
          </button>
          <button className="button" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>
            {busy ? 'Đang ghi…' : 'Ghi nhận'}
          </button>
        </div>
      )}
    >
      <form ref={formRef} className="adm-form" onSubmit={submit}>
        <label className="adm-field">
          <span>Mã lịch hẹn</span>
          <input value={formBookingId} onChange={(e) => setFormBookingId(e.target.value)}
            placeholder="Ví dụ: 294" disabled={busy} inputMode="numeric" />
        </label>
        <div className="adm-form-row">
          <label className="adm-field">
            <span>Trạng thái</span>
            <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)} disabled={busy}>
              <option value="PAID">Đã thanh toán</option>
              <option value="DEPOSITED">Đã đặt cọc</option>
              <option value="UNPAID">Chưa thanh toán</option>
            </select>
            <small className="adm-field-note">
              Trả đủ chỉ ghi cho lịch đã hoàn thành (khách vãng lai làm ngay trong ngày thì thu được).
            </small>
          </label>
          <label className="adm-field">
            <span>Hình thức</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy}>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
              <option value="ONLINE">Online</option>
            </select>
          </label>
        </div>
        <label className="adm-field">
          <span>Số tiền (đ) — PAID để trống = thu đủ tổng</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Ví dụ: 100000" disabled={busy} inputMode="numeric" />
        </label>
        <label className="adm-field">
          <span>Ghi chú</span>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: khách chuyển khoản thiếu..." disabled={busy} />
        </label>
        {error && <p className="adm-error">{error}</p>}
      </form>
    </Drawer>
  );
}

/* Hộp thoại sửa thanh toán — cùng kiểu modal với các trang khác. */
/* Các đường đi cho phép tính từ trạng thái hiện tại — không cho lùi
   (đã cọc thì không về Chưa thanh toán, đã trả đủ thì chỉ sửa hình thức,
   đã hoàn cọc thì khóa hẳn). Backend cũng chặn, đây là để Admin khỏi
   bấm nhầm từ đầu. */
const PAY_FLOW: Record<string, { value: string; label: string }[]> = {
  UNPAID: [
    { value: 'UNPAID', label: 'Chưa thanh toán' },
    { value: 'DEPOSITED', label: 'Đã đặt cọc' },
    { value: 'PAID', label: 'Đã thanh toán' },
  ],
  DEPOSITED: [
    { value: 'DEPOSITED', label: 'Đã đặt cọc' },
    { value: 'PAID', label: 'Đã thanh toán' },
  ],
  PAID: [{ value: 'PAID', label: 'Đã thanh toán' }],
  REFUNDED: [{ value: 'REFUNDED', label: 'Đã hoàn cọc' }],
};

function EditPaymentModal({ item, onClose, onDone }: {
  item: PaymentItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const options = PAY_FLOW[item.paymentStatus] ?? PAY_FLOW.UNPAID;
  const locked = item.paymentStatus === 'REFUNDED';
  const [payStatus, setPayStatus] = useState(item.paymentStatus);
  const [amount, setAmount] = useState(String(item.amount));
  const [method, setMethod] = useState(item.paymentMethod ?? 'CASH');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body: Record<string, unknown> = { status: payStatus, method };
    if (note.trim()) body.note = note.trim();
    if (amount.trim()) body.amount = Number(amount);
    const result = await sendAdmin(`/payments/${item.id}`, 'PATCH', body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone();
  }

  return (
    <Drawer
      title={`Sửa thanh toán lịch #${item.bookingId}`}
      subtitle={`${item.customerName} · ${item.serviceName} · ${formatVND(item.amount)}`}
      onClose={onClose}
      width={560}
      footer={(
        <div className="adm-drawer-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Hủy bỏ
          </button>
          <button type="button" className="button" disabled={busy || locked}
            onClick={() => formRef.current?.requestSubmit()}>
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      )}
    >
      <p className="adm-field-note">Hiện tại: <strong>{item.statusText}</strong></p>
      {locked && (
        <p className="adm-error">Khoản này đã hoàn cọc nên khóa sổ, không sửa được nữa.</p>
      )}
      <form ref={formRef} className="adm-form" onSubmit={submit}>
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Trạng thái</span>
              <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)}
                disabled={busy || locked}>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <small className="adm-field-note">
                Trả đủ chỉ ghi cho lịch đã hoàn thành (khách vãng lai làm ngay trong ngày thì thu được).
              </small>
            </label>
            <label className="adm-field">
              <span>Số tiền (đ) — PAID để trống = thu đủ tổng</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="Ví dụ: 100000" disabled={busy || locked} inputMode="numeric" />
            </label>
          </div>
          <div className="adm-form-row">
            <label className="adm-field">
              <span>Hình thức</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy || locked}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
                <option value="ONLINE">Online</option>
              </select>
            </label>
          </div>
          <label className="adm-field">
            <span>Ghi chú</span>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: khách chuyển khoản thiếu..." disabled={busy} />
          </label>
          {error && <p className="adm-error">{error}</p>}
      </form>
    </Drawer>
  );
}
