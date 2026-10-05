/* ===== Trang Yêu cầu nghỉ =====
   Nhân viên xin nghỉ, Admin duyệt hoặc từ chối ở đây. Duyệt khi còn lịch
   của khách trong khoảng nghỉ sẽ bị backend chặn (409) kèm danh sách lịch
   cần xử lý — phải đổi nhân viên, đổi giờ hoặc hủy các lịch đó trước. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtDay } from '../lib/utils';
import type { LeaveItem } from '../store';

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const TABS: { key: Filter; label: string }[] = [
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'REJECTED', label: 'Đã từ chối' },
  { key: 'ALL', label: 'Tất cả' },
];

const STATUS_TEXT: Record<LeaveItem['status'], string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

function LeaveRow({ item, onDone }: { item: LeaveItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function review(approve: boolean) {
    const note = approve
      ? (window.prompt('Ghi chú duyệt (không bắt buộc):', '') ?? '')
      : (window.prompt('Lý do từ chối:', '') ?? '');
    if (!approve && !note.trim()) {
      setMessage('Từ chối cần ghi rõ lý do.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = await sendAdmin(
      `/leave-requests/${item.id}/${approve ? 'approve' : 'reject'}`,
      'PATCH',
      { note: note.trim() || null },
    );
    setBusy(false);
    if (!result.ok) {
      /* 409 kèm danh sách lịch vướng: hiện thẳng để Admin đi xử lý. */
      setMessage(result.message);
      return;
    }
    onDone();
  }

  return (
    <tr key={item.id}>
      <td>
        <strong>{fmtDay(item.startDatetime.slice(0, 10))}</strong>
        <small>{item.startDatetime.slice(11, 16)} – {item.endDatetime.slice(11, 16)} ngày {fmtDay(item.endDatetime.slice(0, 10))}</small>
      </td>
      <td>
        <strong>{item.staffName}</strong>
        <small>{item.specialty ?? '—'}</small>
      </td>
      <td>{item.reason ?? <span className="adm-none">—</span>}</td>
      <td>
        {item.affectedBookings > 0
          ? (
            <span className="badge cancelled" title={item.affectedList.map((b) => `#${b.id} ${b.startsAt.slice(11, 16)} ${b.serviceName} — ${b.customerName}`).join('\n')}>
              <i />{item.affectedBookings} lịch cần xử lý
            </span>
          )
          : <span className="badge completed"><i />Không ảnh hưởng</span>}
      </td>
      <td>
        <span className={`badge ${item.status === 'PENDING' ? 'pending' : item.status === 'APPROVED' ? 'completed' : 'cancelled'}`}>
          <i />{STATUS_TEXT[item.status]}
        </span>
        {item.reviewerName && <small> bởi {item.reviewerName}</small>}
      </td>
      <td>
        {item.status === 'PENDING' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button" disabled={busy} onClick={() => review(true)}>Duyệt</button>
            <button className="button secondary" disabled={busy} onClick={() => review(false)}>Từ chối</button>
          </div>
        ) : (
          <span className="adm-none">{item.reviewNote ?? '—'}</span>
        )}
        {message && <p className="adm-error">{message}</p>}
      </td>
    </tr>
  );
}

export function AdminLeavePage() {
  const { state, reload } = useApp();
  const { leave } = state;

  const [filter, setFilter] = useState<Filter>('PENDING');

  const rows = leave
    .filter((item) => filter === 'ALL' || item.status === filter)
    .sort((a, b) => b.startDatetime.localeCompare(a.startDatetime));

  const pending = leave.filter((item) => item.status === 'PENDING');
  const blocked = pending.reduce((sum, item) => sum + item.affectedBookings, 0);

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="pause" label="Chờ duyệt" value={pending.length}
          note={pending.length > 0 ? 'cần xử lý' : 'không có yêu cầu mới'} />
        <StatTile tone="gold" icon="calendar" label="Lịch vướng nghỉ" value={blocked}
          note="khách cần đổi người/giờ" />
        <StatTile tone="sage" icon="schedule" label="Đã duyệt" value={leave.filter((i) => i.status === 'APPROVED').length}
          note="yêu cầu nghỉ thành công" />
        <StatTile tone="lavender" icon="ban" label="Đã từ chối" value={leave.filter((i) => i.status === 'REJECTED').length}
          note="yêu cầu không duyệt" />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="pause" />}
          title="Yêu cầu nghỉ"
          subtitle="Nhân viên xin nghỉ — Admin duyệt mới có hiệu lực"
        >
          <div className="mode-tabs">
            {TABS.map((tab) => (
              <button key={tab.key} className={filter === tab.key ? 'active' : ''}
                onClick={() => setFilter(tab.key)}>{tab.label}</button>
            ))}
          </div>
        </SectionHeading>

        {rows.length === 0 ? (
          <EmptyState
            title={filter === 'PENDING' ? 'Không có yêu cầu chờ duyệt' : 'Chưa có yêu cầu nào'}
            detail="Yêu cầu nghỉ của nhân viên sẽ hiện ở đây."
          />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th>Khoảng nghỉ</th><th>Nhân viên</th><th>Lý do</th>
                  <th>Lịch ảnh hưởng</th><th>Trạng thái</th><th>Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => <LeaveRow key={item.id} item={item} onDone={reload} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
