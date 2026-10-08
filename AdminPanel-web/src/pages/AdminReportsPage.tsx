/* ===== Trang Báo cáo theo kỳ =====
   Mọi số trong trang cùng một khoảng from/to: doanh thu dịch vụ
   (COMPLETED + PAID theo ngày thực hiện), tiền đã thu (theo ngày thanh
   toán), lượt = lịch hoàn thành, khách xếp theo lượt hoàn thành. */

import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { DonutChart, LineChart } from '../components/Charts';
import { sendAdmin } from '../lib/admin-api';
import { fmtDay, fmtNum, formatVND, moneyShort, weekdayShort } from '../lib/utils';
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
          title="Kỳ báo cáo"
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
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <SectionHeading
          icon={<Icon name="schedule" />}
          title="Doanh thu dịch vụ theo ngày"
          subtitle="Lịch COMPLETED + đã trả, theo ngày thực hiện"
        />
        <div className="adm-chart-wrap" style={{ padding: '0 16px 16px' }}>
          {!reports || reports.revenueTrend.every((d) => d.revenue === 0) ? (
            <EmptyState title="Chưa có doanh thu trong kỳ" detail="Biểu đồ hiện khi có lịch hoàn thành đã trả." />
          ) : (
            <LineChart
              unit="tr"
              data={reports.revenueTrend.map((d) => ({
                label: weekdayShort(d.day),
                value: d.revenue,
                hint: `${fmtDay(d.day)} · ${d.completed} lịch hoàn thành`,
              }))}
            />
          )}
        </div>
      </Panel>

      <div className="adm-dash-row" style={{ marginTop: 16 }}>
        <Panel>
          <SectionHeading
            icon={<Icon name="dollar" />}
            title="Dòng tiền vào – ra"
            subtitle="Theo ngày tiền thật vào/ra két"
          />
          <div className="adm-tools" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 9 }}>
            {(reports?.cashTrend.filter((d) => d.deposit + d.final + d.refund > 0).length ?? 0) === 0 ? (
              <EmptyState title="Không có dòng tiền" detail="Kỳ này chưa thu/hoàn khoản nào." />
            ) : reports!.cashTrend.filter((d) => d.deposit + d.final + d.refund > 0).map((d) => {
              const inflow = d.deposit + d.final;
              const total = inflow + d.refund;
              return (
                <div key={d.day} className="adm-bar-row"
                  style={{ gridTemplateColumns: 'minmax(70px,.8fr) minmax(60px,2fr) auto' }}>
                  <span className="adm-bar-name">{fmtDay(d.day).slice(0, 5)}</span>
                  <span className="adm-bar-track" style={{ display: 'flex' }} title={
                    `Cọc ${formatVND(d.deposit)} · Trả nốt ${formatVND(d.final)}`
                    + (d.refund > 0 ? ` · Hoàn ${formatVND(d.refund)}` : '')
                  }>
                    {total > 0 && (
                      <span className="adm-bar-fill is-completed"
                        style={{ width: `${(inflow / total) * 100}%` }} />
                    )}
                    {d.refund > 0 && (
                      <span className="adm-bar-fill"
                        style={{ width: `${(d.refund / total) * 100}%`, background: '#C0495F' }} />
                    )}
                  </span>
                  <span className="adm-bar-value">+{moneyShort(inflow)}{d.refund > 0 && ` −${moneyShort(d.refund)}`}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            icon={<Icon name="check" />}
            title="Cơ cấu lịch hẹn"
            subtitle="Trong kỳ đang chọn"
          />
          <div className="adm-tools" style={{ paddingBottom: 16 }}>
            {!summary || summary.bookings === 0 ? (
              <EmptyState title="Không có lịch" detail="Kỳ này chưa phát sinh lịch hẹn." />
            ) : (
              <div className="adm-donut-row">
                <DonutChart
                  centerLabel="lịch trong kỳ"
                  slices={[
                    { label: 'Hoàn thành', value: summary.completed, color: '#5F8F6B' },
                    { label: 'Hủy', value: summary.cancelled, color: '#C0495F' },
                    { label: 'Không đến', value: summary.noShow, color: '#C99A2C' },
                    { label: 'Đang mở', value: summary.running, color: '#8AA3C7' },
                  ]}
                />
                <div className="adm-donut-legend">
                  {[
                    { label: 'Hoàn thành', value: summary.completed, color: '#5F8F6B' },
                    { label: 'Hủy', value: summary.cancelled, color: '#C0495F' },
                    { label: 'Không đến', value: summary.noShow, color: '#C99A2C' },
                    { label: 'Đang mở', value: summary.running, color: '#8AA3C7' },
                  ].map((row) => (
                    <div key={row.label}>
                      <i style={{ background: row.color }} />
                      <span>{row.label}</span>
                      <b>{row.value}</b>
                      <small>{summary.bookings > 0 ? `${Math.round((row.value / summary.bookings) * 100)}%` : '0%'}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {(reports?.payMethodMix.length ?? 0) > 0 && (
            <div className="adm-tools" style={{ paddingBottom: 16 }}>
              <strong style={{ fontSize: 12 }}>Hình thức thu (tiền vào)</strong>
              {reports!.payMethodMix.map((m, i) => (
                <div key={m.method} className="adm-bar-row"
                  style={{ gridTemplateColumns: 'minmax(80px,1fr) minmax(40px,1.4fr) auto' }}>
                  <span className="adm-bar-name">
                    {m.method === 'CASH' ? 'Tiền mặt' : m.method === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Online'}
                  </span>
                  <span className="adm-bar-track">
                    <span className="adm-bar-fill"
                      style={{
                        width: `${(m.amount / Math.max(...reports!.payMethodMix.map((x) => x.amount), 1)) * 100}%`,
                        background: ['#5F8F6B', '#8AA3C7', '#C99A2C'][i % 3],
                      }} />
                  </span>
                  <span className="adm-bar-value">{moneyShort(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

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
                <span className="adm-bar-name"
                  title={`${item.name} · chính ${item.completed}/${item.bookings}`
                    + (item.addonBookings > 0 ? ` · add-on ${item.addonBookings} lượt ${moneyShort(item.addonRevenue)}` : '')
                    + ` · hoàn thành ${item.completionRate}%`}>
                  {item.name}
                </span>
                <span className="adm-bar-track">
                  <span className="adm-bar-fill"
                    style={{ width: `${(item.revenue / peakService) * 100}%` }} />
                </span>
                <span className="adm-bar-value">
                  {item.completed}/{item.bookings}{item.addonBookings > 0 && ` +${item.addonBookings} add-on`} · {item.completionRate}% · {moneyShort(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            icon={<Icon name="adminStaff" />}
            title="Hiệu suất nhân viên"
            subtitle="Hoàn thành · tỉ lệ · doanh thu · đánh giá"
          />
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="adm-stt">STT</th><th>Nhân viên</th><th>Hoàn thành</th><th>Tỉ lệ HT</th>
                  <th>Doanh thu</th><th>Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {(reports?.byStaff.length ?? 0) === 0 ? (
                  <tr><td colSpan={6}>Kỳ này chưa có lịch hoàn thành.</td></tr>
                ) : reports!.byStaff.map((item, index) => (
                  <tr key={item.name}>
                    <td className="adm-stt">{index + 1}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.completed}/{item.bookings}</td>
                    <td>{item.completionRate}%</td>
                    <td><strong>{moneyShort(item.revenue)}</strong></td>
                    <td>{item.rating != null ? `★${item.rating} (${item.reviewCount})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <th className="adm-stt">#</th><th>Khách hàng</th><th>Số điện thoại</th>
                <th>Hoàn thành</th><th>TB/lần</th><th>Tổng chi tiêu</th><th>Lần gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {(reports?.byCustomer.length ?? 0) === 0 ? (
                <tr><td colSpan={7}>Kỳ này chưa có khách hoàn thành dịch vụ.</td></tr>
              ) : reports!.byCustomer.map((item, index) => (
                <tr key={item.phone}>
                  <td>{index + 1}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.phone}</td>
                  <td>{item.completed}/{item.bookings}</td>
                  <td>{item.completed > 0 ? moneyShort(item.spending / item.completed) : '—'}</td>
                  <td><strong>{formatVND(item.spending)}</strong></td>
                  <td>{item.lastVisit ? fmtDay(String(item.lastVisit).slice(0, 10)) : '—'}</td>
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
