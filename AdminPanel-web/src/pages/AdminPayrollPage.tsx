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

function PayrollRow({ item, onDone }: { item: PayrollItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
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

  async function pay() {
    const method = window.prompt('Hình thức trả (VD: tiền mặt, chuyển khoản):', 'tiền mặt') ?? '';
    await act(`/payrolls/${item.id}/pay`, { paymentMethod: method.trim() || null });
  }

  async function reopen() {
    await act(`/payrolls/${item.id}/reopen`);
  }

  async function recalc() {
    const bonus = window.prompt('Thưởng (VND):', String(0));
    if (bonus === null) return;
    const deduction = window.prompt('Khấu trừ (VND):', String(0));
    if (deduction === null) return;
    if (!/^\d+$/.test(bonus.trim()) || !/^\d+$/.test(deduction.trim())) {
      setMessage('Thưởng/khấu trừ phải là số nguyên ≥ 0.');
      return;
    }
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

  const KIND_TEXT: Record<string, string> = {
    LATE: 'đi muộn', ABSENT: 'vắng không phép', UNPAID_LEAVE: 'nghỉ không lương',
    PAID_LEAVE: 'nghỉ có lương', ON_TIME: 'đúng giờ',
  };

  async function suggest() {
    setBusy(true);
    setMessage('');
    const result = await sendAdmin<{
      suggestedDeduction: number; lateMinutes: number; lateDays: number;
      absentDays: number; unpaidLeaveMinutes: number;
      details: { workDate: string; kind: string; minutes: number; amount: number }[];
    }>(`/payrolls/suggest-deduction?staffId=${item.staffId}&month=${item.periodMonth}`, 'GET');
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const s = result.data;
    const lines = s.details
      .filter((d) => d.amount > 0)
      .map((d) => `${d.workDate}: ${KIND_TEXT[d.kind] ?? d.kind} ${d.minutes}p → ${formatVND(d.amount)}`)
      .join('\n');
    const ok = window.confirm(
      `Gợi ý khấu trừ tháng ${item.periodMonth}:\n`
      + `- Đi muộn: ${s.lateMinutes}p (${s.lateDays} ngày)\n`
      + `- Vắng không phép: ${s.absentDays} ngày\n`
      + `- Nghỉ không lương: ${s.unpaidLeaveMinutes}p\n`
      + `=> Tổng gợi ý: ${formatVND(s.suggestedDeduction)}\n`
      + (lines ? `\n${lines}\n` : '\n')
      + `\nÁp dụng ${formatVND(s.suggestedDeduction)} vào ô khấu trừ (giữ nguyên thưởng ${formatVND(item.bonus)})?`,
    );
    if (ok) await savePay(item.bonus, s.suggestedDeduction);
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
                <button className="button secondary" disabled={busy} onClick={recalc}>Thưởng/Trừ</button>
                <button className="button" disabled={busy} onClick={confirm}>Chốt</button>
              </>
            )}
            {item.status === 'CONFIRMED' && (
              <>
                <button className="button secondary" disabled={busy} onClick={reopen}>Mở lại</button>
                <button className="button" disabled={busy} onClick={pay}>Trả lương</button>
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
