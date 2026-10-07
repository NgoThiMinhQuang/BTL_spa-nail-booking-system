/* ===== Trang Báo cáo theo kỳ =====
   Mọi số trong trang cùng một khoảng from/to: doanh thu dịch vụ
   (COMPLETED + PAID theo ngày thực hiện), tiền đã thu (theo ngày thanh
   toán), lượt = lịch hoàn thành, khách xếp theo lượt hoàn thành. */

import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { sendAdmin } from '../lib/admin-api';
import { fmtDay, fmtNum, formatVND, moneyShort } from '../lib/utils';
import type { Reports } from '../store';

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return isoDay(d);
}

type Preset = 'today' | '7days' | 'month' | 'prevMonth' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7days', label: '7 ngày' },
  { key: 'month', label: 'Tháng này' },
  { key: 'prevMonth', label: 'Tháng trước' },
  { key: 'custom', label: 'Tùy chọn' },
];

function presetRange(key: Preset): [string, string] {
  const now = new Date();
  if (key === 'today') return [isoDay(now), isoDay(now)];
  if (key === '7days') {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return [isoDay(from), isoDay(now)];
  }
  if (key === 'prevMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return [isoDay(first), isoDay(last)];
  }
  return [monthStart(), isoDay(now)];
}

export function AdminReportsPage() {
  const [preset, setPreset] = useState<Preset>('month');
  const [[from, to], setRange] = useState<[string, string]>(() => presetRange('month'));
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage('');
    sendAdmin<Reports>(`/reports?from=${from}&to=${to}`, 'GET').then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setReports(result.data);
    });
    return () => { cancelled = true; };
  }, [from, to]);

  function pick(key: Preset) {
    setPreset(key);
    if (key !== 'custom') setRange(presetRange(key));
  }

  const summary = reports?.summary;
  const peakService = Math.max(...(reports?.byService.map((i) => i.revenue) ?? [1]), 1);
  const peakStaff = Math.max(...(reports?.byStaff.map((i) => i.revenue) ?? [1]), 1);
  const peakDay = Math.max(...(reports?.revenueTrend.map((i) => i.revenue) ?? [1]), 1);

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="schedule" label="Tổng lịch hẹn" value={fmtNum(summary?.bookings ?? 0)}
          note={summary ? `${summary.completionRate}% hoàn thành` : `${fmtDay(from)} – ${fmtDay(to)}`} />
        <StatTile tone="sage" icon="done" label="Doanh thu dịch vụ" value={moneyShort(summary?.serviceRevenue ?? 0)}
          note="COMPLETED + đã trả" />
        <StatTile tone="gold" icon="dollar" label="Tiền đã thu" value={moneyShort(summary?.cashCollected ?? 0)}
          note={summary ? `cọc ${moneyShort(summary.cashDeposit)}` : 'theo ngày thanh toán'} />
        <StatTile tone="lavender" icon="ban"
          label="Huỷ / Không đến"
          value={fmtNum((summary?.cancelled ?? 0) + (summary?.noShow ?? 0))}
          note={summary && summary.forfeitedAmount > 0
            ? `giữ cọc ${moneyShort(summary.forfeitedAmount)}`
            : 'không mất gì thêm'} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="schedule" />}
          title="Báo cáo theo kỳ"
          subtitle={reports ? `${fmtDay(reports.from)} – ${fmtDay(reports.to)}` : 'Chọn khoảng thời gian'}
        >
          <div className="mode-tabs">
            {PRESETS.map((tab) => (
              <button key={tab.key} className={preset === tab.key ? 'active' : ''}
                onClick={() => pick(tab.key)}>{tab.label}</button>
            ))}
          </div>
        </SectionHeading>
        <div className="adm-form-row" style={{ padding: '0 16px 12px' }}>
          <label className="adm-field">
            <span>Từ ngày</span>
            <input type="date" value={from} max={to}
              onChange={(e) => { setPreset('custom'); e.target.value && setRange([e.target.value, to]); }} />
          </label>
          <label className="adm-field">
            <span>Đến ngày</span>
            <input type="date" value={to} min={from} max={isoDay(new Date())}
              onChange={(e) => { setPreset('custom'); e.target.value && setRange([from, e.target.value]); }} />
          </label>
        </div>
        {message && <p className="adm-error" style={{ padding: '0 16px' }}>{message}</p>}
        {loading && <p className="app-note" style={{ padding: '0 16px' }}>Đang tải số liệu…</p>}

        {!reports ? (
          <EmptyState title="Chưa có số liệu" detail="Chọn khoảng thời gian để xem báo cáo." />
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr><th>Ngày</th><th>Hoàn thành</th><th>Doanh thu dịch vụ</th></tr>
              </thead>
              <tbody>
                {reports.revenueTrend.filter((d) => d.completed > 0 || d.revenue > 0).map((d) => (
                  <tr key={d.day}>
                    <td><strong>{fmtDay(d.day)}</strong></td>
                    <td>
                      <span className="adm-bar-track" style={{ display: 'inline-block', width: 90, verticalAlign: 'middle' }}>
                        <span className="adm-bar-fill is-completed"
                          style={{ width: `${(d.revenue / peakDay) * 100}%` }} />
                      </span> {d.completed} lịch
                    </td>
                    <td><strong>{formatVND(d.revenue)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="adm-dash-row" style={{ marginTop: 16 }}>
        <Panel>
          <SectionHeading
            icon={<Icon name="services" />}
            title="Doanh thu theo dịch vụ"
            subtitle="Lượt = lịch hoàn thành · tỉ lệ trên lịch đã kết thúc"
          />
          <div className="adm-tools" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
            {(reports?.byService.length ?? 0) === 0 ? (
              <EmptyState title="Không có số liệu" detail="Kỳ này chưa có lịch hoàn thành." />
            ) : reports!.byService.map((item) => (
              <div key={item.name} className="adm-bar-row"
                style={{ gridTemplateColumns: 'minmax(90px,1.2fr) minmax(50px,2fr) auto' }}>
                <span className="adm-bar-name" title={`${item.name} · hoàn thành ${item.completionRate}%`}>
                  {item.name}
                </span>
                <span className="adm-bar-track">
                  <span className="adm-bar-fill"
                    style={{ width: `${(item.revenue / peakService) * 100}%` }} />
                </span>
                <span className="adm-bar-value">
                  {item.completed}/{item.bookings} · {item.completionRate}% · {moneyShort(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            icon={<Icon name="adminStaff" />}
            title="Hiệu suất nhân viên"
            subtitle="Hoàn thành · doanh thu COMPLETED+PAID · đánh giá"
          />
          <div className="adm-tools" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
            {(reports?.byStaff.length ?? 0) === 0 ? (
              <EmptyState title="Không có số liệu" detail="Kỳ này chưa có lịch hoàn thành." />
            ) : reports!.byStaff.map((item) => (
              <div key={item.name} className="adm-bar-row"
                style={{ gridTemplateColumns: 'minmax(78px,1fr) minmax(40px,1.4fr) auto' }}>
                <span className="adm-bar-name"
                  title={`${item.name} · hoàn thành ${item.completionRate}%${item.rating != null ? ` · ★${item.rating} (${item.reviewCount})` : ''}`}>
                  {item.name}
                </span>
                <span className="adm-bar-track">
                  <span className="adm-bar-fill is-completed"
                    style={{ width: `${(item.revenue / peakStaff) * 100}%` }} />
                </span>
                <span className="adm-bar-value">
                  {item.completed} lịch · {item.completionRate}% · {moneyShort(item.revenue)}
                  {item.rating != null && ` · ★${item.rating}`}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel style={{ marginTop: 16 }}>
        <SectionHeading
          icon={<Icon name="customers" />}
          title="Khách hàng thân thiết"
          subtitle="Xếp theo lượt hoàn thành, rồi tới tổng chi tiêu"
        />
        <div className="table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th><th>Khách hàng</th><th>Số điện thoại</th>
                <th>Hoàn thành</th><th>Tổng chi tiêu</th>
              </tr>
            </thead>
            <tbody>
              {(reports?.byCustomer.length ?? 0) === 0 ? (
                <tr><td colSpan={5}>Kỳ này chưa có khách hoàn thành dịch vụ.</td></tr>
              ) : reports!.byCustomer.map((item, index) => (
                <tr key={item.phone}>
                  <td>{index + 1}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.phone}</td>
                  <td>{item.completed}/{item.bookings}</td>
                  <td><strong>{formatVND(item.spending)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="app-note">
        Doanh thu dịch vụ = lịch COMPLETED + đã PAID theo ngày thực hiện
        (add-on tính về đúng dịch vụ của món).
        Tiền đã thu tính theo ngày thanh toán (gồm cả cọc)
        {summary && summary.cashRefunded > 0 && (
          <> − đã hoàn {formatVND(summary.cashRefunded)}</>
        )}.
        {summary && summary.forfeitedAmount > 0 && (
          <> Cọc giữ lại từ {summary.forfeitedCount} lịch khách hủy/không đến: {formatVND(summary.forfeitedAmount)}.</>
        )}
      </p>
    </>
  );
}
