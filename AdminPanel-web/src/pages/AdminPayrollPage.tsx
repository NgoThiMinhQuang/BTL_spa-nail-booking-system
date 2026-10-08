/* ===== Trang Lương =====
   Lương = cơ bản + hoa hồng (chỉ COMPLETED + PAID) + thưởng − khấu trừ.
   Backend tự tính total, PAID thì khóa sổ. */

import { useEffect, useState } from 'react';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useApp, type PayrollItem } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { formatVND } from '../lib/utils';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_TEXT: Record<PayrollItem['status'], string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã chốt',
  PAID: 'Đã trả',
};

/** '2026-10-08' → '08/10 (T5)'. */
function dayLabel(date: string): string {
  const day = date.split('-').reverse().join('/').slice(0, 5);
  const weekday = new Date(`${date}T12:00:00`)
    .toLocaleDateString('vi-VN', { weekday: 'long' })
    .replace('Thứ ', 'T');
  return `${day} (${weekday})`;
}

/** Diễn giải một dòng chấm công thành câu đầy đủ để Admin đối chiếu. */
function describeDetail(d: SuggestDetail): string {
  const shift = d.shiftStart && d.shiftEnd
    ? `ca ${d.shiftStart.slice(0, 5)}–${d.shiftEnd.slice(0, 5)}` : 'ca làm việc';
  if (d.kind === 'LATE') {
    return `Đi muộn ${d.minutes}p (chấm ${d.checkInAt ?? '?'}, ${shift}, ân hạn 10p)`;
  }
  if (d.kind === 'ABSENT') {
    return d.fullDay
      ? `Vắng cả ngày không phép (${shift} = 1 công)`
      : `Vắng ${d.minutes}p còn lại trong ca (sau giờ nghỉ phép)`;
  }
  if (d.kind === 'UNPAID_LEAVE') {
    return `Nghỉ không lương ${d.minutes}p trong ca`;
  }
  return d.kind;
}

function SuggestBody({ item, data, busy, onClose, onApply }: {
  item: PayrollItem;
  data: SuggestData;
  busy: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  const parts: string[] = [];
  if (data.lateMinutes > 0) parts.push(`đi muộn ${data.lateMinutes}p (${data.lateDays} ngày)`);
  if (data.absentDays > 0) parts.push(`vắng không phép ${data.absentDays} ngày`);
  if (data.unpaidLeaveMinutes > 0) parts.push(`nghỉ không lương ${data.unpaidLeaveMinutes}p`);
  const rows = data.details.filter((d) => d.amount > 0);

  return (
    <div>
      <h3>Gợi ý khấu trừ — {item.staffName}</h3>
      <p>Tháng {item.periodMonth} · lương cơ bản {formatVND(data.baseSalary)}.</p>
      <p>
        Cách tính: 1 công = cơ bản ÷ 26 = {formatVND(data.perDayRate)};
        đi muộn quá 10 phút ân hạn trừ {formatVND(Math.round(data.perMinuteRate))}/phút.
      </p>
      {parts.length === 0 ? (
        <p style={{ marginTop: 12 }}>Chấm công sạch, không có gì để trừ.</p>
      ) : (
        <p style={{ marginTop: 12 }}>Phát hiện: {parts.join(' · ')}.</p>
      )}
      {rows.length > 0 && (
        <div className="table-scroll" style={{ marginTop: 8 }}>
          <table className="adm-table">
            <thead>
              <tr><th>Ngày</th><th>Nội dung</th><th>Tiền trừ</th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={`${d.workDate}-${d.kind}-${d.minutes}`}>
                  <td><strong>{dayLabel(d.workDate)}</strong></td>
                  <td>{describeDetail(d)}</td>
                  <td><strong>{formatVND(d.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 12 }}>
        <strong>Tổng gợi ý: {formatVND(data.suggestedDeduction)}</strong>
        {item.bonus > 0 && <> · giữ nguyên thưởng {formatVND(item.bonus)}</>}.
      </p>
      <div className="adm-modal-foot">
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
          Để sau
        </button>
        <button type="button" className="button" disabled={busy} onClick={onApply}>
          {busy ? 'Đang lưu…' : 'Áp dụng'}
        </button>
      </div>
    </div>
  );
}

interface SuggestDetail {
  workDate: string; kind: string; minutes: number; amount: number;
  fullDay?: boolean; shiftStart: string | null; shiftEnd: string | null;
  checkInAt: string | null;
}

interface SuggestData {
  suggestedDeduction: number; lateMinutes: number; lateDays: number;
  absentDays: number; unpaidLeaveMinutes: number;
  baseSalary: number; perMinuteRate: number; perDayRate: number;
  details: SuggestDetail[];
}

type RowModal =
  | { type: 'bonus'; bonus: string; deduction: string }
  | { type: 'pay'; method: string }
  | { type: 'suggest'; data: SuggestData }
  | null;

function PayrollRow({ item, onDone }: { item: PayrollItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<RowModal>(null);
  const [detail, setDetail] = useState<{
    items: { id: string; bookingId: string | null; serviceName: string | null; startsAt: string; paidAmount: number; commissionAmount: number }[];
  } | null>(null);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setMessage('');
    const result = await sendAdmin<{ status: string }>(path, 'PATCH', body);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onDone();
  }

  async function confirm() {
    await act(`/payrolls/${item.id}/confirm`);
  }

  function openPay() {
    setModal({ type: 'pay', method: 'tiền mặt' });
  }

  async function submitPay(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== 'pay') return;
    const method = modal.method.trim();
    setModal(null);
    await act(`/payrolls/${item.id}/pay`, { paymentMethod: method || null });
  }

  async function reopen() {
    await act(`/payrolls/${item.id}/reopen`);
  }

  function openBonus() {
    setModal({ type: 'bonus', bonus: String(item.bonus), deduction: String(item.deduction) });
  }

  async function submitBonus(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== 'bonus') return;
    const bonus = modal.bonus.trim();
    const deduction = modal.deduction.trim();
    if (!/^\d+$/.test(bonus) || !/^\d+$/.test(deduction)) {
      setMessage('Thưởng/khấu trừ phải là số nguyên ≥ 0.');
      return;
    }
    setModal(null);
    await savePay(Number(bonus), Number(deduction));
  }

  async function savePay(bonus: number, deduction: number) {
    setBusy(true);
    setMessage('');
    const result = await sendAdmin('/payrolls', 'POST', {
      staffId: Number(item.staffId), month: item.periodMonth, bonus, deduction,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onDone();
  }

  async function suggest() {
    setBusy(true);
    setMessage('');
    const result = await sendAdmin<SuggestData>(
      `/payrolls/suggest-deduction?staffId=${item.staffId}&month=${item.periodMonth}`, 'GET');
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setModal({ type: 'suggest', data: result.data });
  }

  async function applySuggest() {
    if (modal?.type !== 'suggest') return;
    const suggested = modal.data.suggestedDeduction;
    setModal(null);
    await savePay(item.bonus, suggested);
  }

  async function toggleDetail() {
    if (open) {
      setOpen(false);
      return;
    }
    setBusy(true);
    const result = await sendAdmin<{ items: [] }>(`/payrolls/${item.id}`, 'GET');
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDetail(result.data as never);
    setOpen(true);
  }

  return (
    <>
      <tr>
        <td>
          <strong>{item.staffName}</strong>
          <small>{item.periodMonth} · {item.completedCount} lịch hoàn thành</small>
        </td>
        <td>{formatVND(item.baseSalary)}<small>{item.commissionRate}% hoa hồng</small></td>
        <td>{formatVND(item.serviceRevenue)}<small>doanh thu tính HH</small></td>
        <td>{formatVND(item.commissionAmount)}</td>
        <td><strong>{formatVND(item.totalSalary)}</strong>
          {(item.bonus > 0 || item.deduction > 0) && (
            <small>+{formatVND(item.bonus)} −{formatVND(item.deduction)}</small>
          )}
        </td>
        <td>
          <span className={`badge ${item.status === 'PAID' ? 'completed' : item.status === 'CONFIRMED' ? 'pending' : ''}`}>
            <i />{STATUS_TEXT[item.status]}
          </span>
        </td>
        <td>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="button secondary" disabled={busy} onClick={toggleDetail}>
              {open ? 'Ẩn' : 'Chi tiết'}
            </button>
            {item.status === 'DRAFT' && (
              <>
                <button className="button secondary" disabled={busy} onClick={suggest}>Gợi ý trừ</button>
                <button className="button secondary" disabled={busy} onClick={openBonus}>Thưởng/Trừ</button>
                <button className="button" disabled={busy} onClick={confirm}>Chốt</button>
              </>
            )}
            {item.status === 'CONFIRMED' && (
              <>
                <button className="button secondary" disabled={busy} onClick={reopen}>Mở lại</button>
                <button className="button" disabled={busy} onClick={openPay}>Trả lương</button>
              </>
            )}
          </div>
          {message && <p className="adm-error">{message}</p>}
        </td>
      </tr>
      {open && detail && (
        <tr>
          <td colSpan={7}>
            {detail.items.length === 0 ? (
              <span className="adm-none">Tháng này không có lịch COMPLETED + PAID nào.</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                {detail.items.map((b) => (
                  <li key={b.id}>
                    {String(b.startsAt).slice(0, 16).replace('T', ' ')} · {b.serviceName} · thu {formatVND(b.paidAmount)} → HH {formatVND(b.commissionAmount)}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
      {modal && (
        <tr>
          <td colSpan={7} style={{ padding: 0, border: 0 }}>
            <div className="adm-modal-backdrop" onClick={() => setModal(null)}>
              <div className={`adm-modal${modal.type === 'suggest' ? ' adm-modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
                {modal.type === 'bonus' && (
                  <form onSubmit={submitBonus}>
                    <h3>Thưởng / Khấu trừ — {item.staffName}</h3>
                    <p>Tổng lương = {formatVND(item.baseSalary)} + {formatVND(item.commissionAmount)} + thưởng − trừ.</p>
                    <div className="adm-form" style={{ marginTop: 12 }}>
                      <label className="adm-field">
                        <span>Thưởng (VND)</span>
                        <input value={modal.bonus} inputMode="numeric"
                          onChange={(e) => setModal({ ...modal, bonus: e.target.value })}
                          disabled={busy} autoFocus />
                      </label>
                      <label className="adm-field">
                        <span>Khấu trừ (VND)</span>
                        <input value={modal.deduction} inputMode="numeric"
                          onChange={(e) => setModal({ ...modal, deduction: e.target.value })}
                          disabled={busy} />
                      </label>
                    </div>
                    <div className="adm-modal-foot">
                      <button type="button" className="button secondary" disabled={busy}
                        onClick={() => setModal(null)}>Hủy bỏ</button>
                      <button type="submit" className="button" disabled={busy}>
                        {busy ? 'Đang lưu…' : 'Lưu'}
                      </button>
                    </div>
                  </form>
                )}
                {modal.type === 'pay' && (
                  <form onSubmit={submitPay}>
                    <h3>Trả lương — {item.staffName}</h3>
                    <p>{formatVND(item.totalSalary)} · tháng {item.periodMonth}.</p>
                    <div className="adm-form" style={{ marginTop: 12 }}>
                      <label className="adm-field">
                        <span>Hình thức trả</span>
                        <input value={modal.method}
                          onChange={(e) => setModal({ ...modal, method: e.target.value })}
                          disabled={busy} autoFocus placeholder="VD: tiền mặt, chuyển khoản" />
                      </label>
                    </div>
                    <div className="adm-modal-foot">
                      <button type="button" className="button secondary" disabled={busy}
                        onClick={() => setModal(null)}>Hủy bỏ</button>
                      <button type="submit" className="button" disabled={busy}>
                        {busy ? 'Đang trả…' : 'Xác nhận đã trả'}
                      </button>
                    </div>
                  </form>
                )}
                {modal.type === 'suggest' && (
                  <SuggestBody
                    item={item}
                    data={modal.data}
                    busy={busy}
                    onClose={() => setModal(null)}
                    onApply={applySuggest}
                  />
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AdminPayrollPage() {
  const { state, reload } = useApp();
  const { staff } = state;

  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<PayrollItem[]>(state.payrolls);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function load(target: string) {
    setLoading(true);
    const result = await sendAdmin<PayrollItem[]>('/payrolls?month=' + target, 'GET');
    setLoading(false);
    if (result.ok) setRows(result.data);
  }

  useEffect(() => {
    setRows(state.payrolls);
  }, [state.payrolls]);

  useEffect(() => {
    load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function calcAll() {
    setLoading(true);
    setMessage('');
    for (const person of staff) {
      /* Giữ thưởng/phạt đã nhập tay trên phiếu nháp: tính lại chỉ cập nhật
         lương cơ bản + hoa hồng theo cấu hình mới, không xóa số tay. */
      const existing = rows.find((r) => r.staffId === person.id && r.status === 'DRAFT');
      const result = await sendAdmin('/payrolls', 'POST', {
        staffId: Number(person.id), month,
        bonus: existing?.bonus ?? 0, deduction: existing?.deduction ?? 0,
      });
      if (!result.ok) {
        setMessage(`Tính cho ${person.name} lỗi: ${result.message}`);
        setLoading(false);
        await load(month);
        reload();
        return;
      }
    }
    setLoading(false);
    setMessage(`Đã tính nháp lương tháng ${month} cho ${staff.length} nhân viên.`);
    await load(month);
    reload();
  }

  const paid = rows.reduce((s, r) => s + (r.status === 'PAID' ? r.totalSalary : 0), 0);
  const unpaid = rows.reduce((s, r) => s + (r.status !== 'PAID' ? r.totalSalary : 0), 0);

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="card" label="Tổng lương tháng" value={formatVND(paid + unpaid)} note={`${month} · ${rows.length} phiếu`} />
        <StatTile tone="sage" icon="schedule" label="Đã trả" value={formatVND(paid)} note={`${rows.filter((r) => r.status === 'PAID').length} phiếu khóa sổ`} />
        <StatTile tone="gold" icon="clock" label="Chưa trả" value={formatVND(unpaid)} note="nháp + đã chốt" />
        <StatTile tone="lavender" icon="adminStaff" label="Nhân viên" value={staff.length} note="người hưởng lương" />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="card" />}
          title="Phiếu lương theo tháng"
          subtitle="Cơ bản + hoa hồng COMPLETED+PAID + thưởng − khấu trừ · PAID thì khóa"
        >
          <input
            type="month" aria-label="Tháng lương" value={month}
            max={currentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
          <button className="button" disabled={loading} onClick={calcAll}>
            {loading ? 'Đang tính…' : `Tính lương ${month}`}
          </button>
        </SectionHeading>

        {staff.some((s) => !s.baseSalary && !s.commissionRate) && (
          <p className="adm-error" style={{ padding: '0 16px' }}>
            Có nhân viên chưa cấu hình lương (cơ bản 0đ, hoa hồng 0%) nên tổng lương ra 0đ
            dù vẫn có doanh thu. Vào trang Nhân viên → Sửa để đặt lương cơ bản + % hoa hồng,
            rồi bấm Tính lương lại (phiếu nháp tính lại theo cấu hình mới).
          </p>
        )}

        {message && <p className="adm-error" style={{ padding: '0 16px' }}>{message}</p>}

        {rows.length === 0 ? (
          <EmptyState
            title={`Chưa có phiếu lương tháng ${month}`}
            detail="Bấm «Tính lương» để tạo phiếu nháp cho toàn bộ nhân viên."
          />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th>Nhân viên</th><th>Lương cơ bản</th><th>Doanh thu HH</th>
                  <th>Hoa hồng</th><th>Tổng lương</th><th>Trạng thái</th><th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => <PayrollRow key={item.id} item={item} onDone={() => { load(month); reload(); }} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
