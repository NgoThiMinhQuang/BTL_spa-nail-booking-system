/* ===== Trang Doanh thu & Thanh toán =====
   Số liệu từ GET /api/admin/payments: tổng đã thu, đã đặt cọc, chưa thanh toán,
   biểu đồ theo tháng và danh sách từng giao dịch kèm lịch hẹn tương ứng. */

import { useEffect, useRef, useState } from 'react';
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
  const { payments, paymentTotals } = state;

  const [status, setStatus] = useState('');
  const [term, setTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [span, setSpan] = useState(12);
  const [months, setMonths] = useState<typeof state.paymentMonths>([]);

  useEffect(() => {
    let cancelled = false;
    sendAdmin<{
      data: PaymentItem[];
      meta: { months: typeof state.paymentMonths };
    }>(`/payments?span=${span}`, 'GET').then((result) => {
      if (!cancelled && result.ok) setMonths(result.data.meta.months);
    });
    return () => { cancelled = true; };
  }, [span, state.reloadToken]);

  const rows = payments
    .filter((payment) => !status || payment.paymentStatus === status)
    .filter((payment) => !monthFilter
      || (payment.paymentDate ?? payment.startsAt).slice(0, 7) === monthFilter)
    .filter((payment) => {
      if (!term) return true;
      const key = term.toLowerCase();
      return payment.customerName.toLowerCase().includes(key)
        || payment.serviceName.toLowerCase().includes(key)
        || (payment.staffName ?? '').toLowerCase().includes(key);
    });

  const inflow = (item: { paidAmount: number; depositAmount: number }) =>
    item.paidAmount + item.depositAmount;
  const peak = Math.max(...months.map(inflow), 1);
  const inflowTotal = months.reduce((sum, item) => sum + inflow(item), 0);
  const refundTotal = months.reduce((sum, item) => sum + item.refundAmount, 0);

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
          title="Dòng tiền theo tháng"
          subtitle="Cọc + thu đủ theo ngày tiền vào két (không phải doanh thu dịch vụ)"
        >
          <div className="mode-tabs">
            {[6, 12].map((n) => (
              <button key={n} className={span === n ? 'active' : ''}
                onClick={() => setSpan(n)}>{n} tháng</button>
            ))}
          </div>
          <strong style={{ fontSize: 15, fontWeight: 600 }}>
            {formatVND(inflowTotal)}
          </strong>
        </SectionHeading>
        <div style={{ padding: '0 16px 16px' }}>
          {months.length === 0 ? (
            <EmptyState title="Chưa có giao dịch" detail="Dòng tiền hiện khi có khoản thu đầu tiên." />
          ) : (
            <>
              <div className="adm-chart-legend">
                <span><i className="sw-paid" />Thu đủ</span>
                <span><i className="sw-deposit" />Đặt cọc</span>
                <span className="adm-chart-hint">Bấm vào cột để lọc danh sách theo tháng</span>
              </div>
              <div className="adm-chart adm-chart-scroll">
                {months.map((item) => {
                  const total = inflow(item);
                  const active = monthFilter === item.month;
                  return (
                    <button key={item.month} className={`adm-chart-col${active ? ' is-active' : ''}`}
                      onClick={() => setMonthFilter(active ? '' : item.month)}
                      title={`${monthLabel(item.month)}: thu đủ ${formatVND(item.paidAmount)} · `
                        + `cọc ${formatVND(item.depositAmount)}`
                        + (item.refundAmount > 0 ? ` · hoàn ${formatVND(item.refundAmount)}` : '')
                        + ` — bấm để ${active ? 'bỏ lọc' : 'lọc danh sách'}`}>
                      {total > 0 && <span className="adm-chart-value">{moneyShort(total)}</span>}
                      <span className="adm-chart-stack"
                        style={{ height: `${Math.max(6, (total / peak) * 150)}px` }}>
                        <span className="seg-deposit"
                          style={{ height: `${total > 0 ? (item.depositAmount / total) * 100 : 0}%` }} />
                        <span className="seg-paid"
                          style={{ height: `${total > 0 ? (item.paidAmount / total) * 100 : 0}%` }} />
                      </span>
                      <small>{monthLabel(item.month)}</small>
                    </button>
                  );
                })}
              </div>
              {refundTotal > 0 && (
                <p className="adm-field-note">Đã hoàn {formatVND(refundTotal)} cho khách trong kỳ hiển thị.</p>
              )}
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <SectionHeading
          icon={<Icon name="card" />}
          title="Danh sách giao dịch"
          subtitle={`${rows.length} trong ${payments.length} giao dịch`
            + (monthFilter ? ` · tháng ${monthLabel(monthFilter)}` : '')}
        >
          {monthFilter && (
            <button className="button secondary" onClick={() => setMonthFilter('')}>
              Bỏ lọc tháng
            </button>
          )}
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
