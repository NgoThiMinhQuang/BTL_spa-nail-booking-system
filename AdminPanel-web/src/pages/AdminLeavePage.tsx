/* ===== Trang Yêu cầu nghỉ =====
   Nhân viên xin nghỉ, Admin duyệt hoặc từ chối ở đây. Duyệt khi còn lịch
   của khách trong khoảng nghỉ sẽ bị backend chặn (409) kèm danh sách lịch
   cần xử lý — phải đổi nhân viên, đổi giờ hoặc hủy các lịch đó trước. */

import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile, StatusBadge } from '../components/Primitives';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtDay, fmtTime } from '../lib/utils';
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

const REASON_TEXT: Record<string, string> = {
  HEALTH: 'Sức khỏe',
  FAMILY: 'Gia đình khẩn cấp',
  PERSONAL: 'Sự cố cá nhân',
  OTHER: 'Lý do khác',
};

/* Một sự cố nghỉ đột xuất: ai nghỉ, khoảng nào, vì nhóm lý do gì, từng
   lịch bị ảnh hưởng đang ở đâu (chờ xử lý hay đã đổi sang người khác).
   Không có nút Duyệt/Từ chối ở đây — đơn đã có hiệu lực từ lúc báo. */
function IncidentCard({ item }: { item: LeaveItem }) {
  const { openBookingDetail } = useApp();
  const [expanded, setExpanded] = useState(item.affectedList.length > 0);
  const total = item.affectedList.length;
  const waiting = item.affectedList.filter(
    (b) => (b.currentStaffId ?? item.staffId) === item.staffId);
  const handed = total - waiting.length;
  const pct = total === 0 ? 100 : Math.round((handed / total) * 100);

  return (
    <li className="adm-req-card adm-inc-card">
      <Avatar name={item.staffName} url={null} size={44} />
      <div className="adm-req-copy">
        <div className="adm-req-head">
          <strong>{item.staffName}</strong>
          <span className="badge cancelled"><i />Nghỉ đột xuất</span>
          {total === 0
            ? <span className="badge completed"><i />Hoàn tất xử lý</span>
            : <span className="badge pending"><i />Còn {waiting.length} lịch chờ</span>}
        </div>
        <p className="adm-inc-meta">
          <span>{fmtDay(item.startDatetime.slice(0, 10))}</span>
          <span>{fmtTime(item.startDatetime)} – {fmtTime(item.endDatetime)}</span>
          {item.reasonCategory && <span>{REASON_TEXT[item.reasonCategory] ?? item.reasonCategory}</span>}
          {item.reason && <span className="adm-inc-note">{item.reason}</span>}
        </p>
        <div className="adm-progress" title={`Đã bàn giao ${handed}/${total} lịch`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="adm-field-note">
          {total === 0
            ? 'Không còn lịch nào chờ bàn giao.'
            : `Đã bàn giao ${handed}/${total} lịch.`}
          {total > 0 && (
            <button className="adm-link" onClick={() => setExpanded((open) => !open)}>
              {expanded ? 'Ẩn danh sách ▴' : `Xem danh sách ▾`}
            </button>
          )}
        </p>
        {expanded && total > 0 && (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr><th>Giờ</th><th>Dịch vụ</th><th>Khách</th><th>Trạng thái</th><th>Người giữ</th><th /></tr>
              </thead>
              <tbody>
                {item.affectedList.map((b) => {
                  const moved = (b.currentStaffId ?? item.staffId) !== item.staffId;
                  return (
                    <tr key={b.id}>
                      <td><strong>{fmtTime(b.startsAt)}</strong></td>
                      <td>{b.serviceName}</td>
                      <td>{b.customerName}</td>
                      <td><StatusBadge status={b.status} /></td>
                      <td>
                        {moved
                          ? <span className="badge completed"><i />→ {b.currentStaffName ?? 'người khác'}</span>
                          : <span className="adm-none">{item.staffName}</span>}
                      </td>
                      <td>
                        <button className="adm-link" onClick={() => openBookingDetail(b.id)}>
                          Mở lịch →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </li>
  );
}

function LeaveRow({ item, index, onDone }: { item: LeaveItem; index: number; onDone: () => void }) {
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
      <td className="adm-stt">{index + 1}</td>
      <td>
        <strong>{fmtDay(item.startDatetime.slice(0, 10))}</strong>
        <small>{item.startDatetime.slice(11, 16)} – {item.endDatetime.slice(11, 16)} ngày {fmtDay(item.endDatetime.slice(0, 10))}</small>
        {item.leaveType === 'EMERGENCY' && (
          <small style={{ color: '#b42318', fontWeight: 700 }}>🚨 Nghỉ đột xuất — đã chặn nhận khách mới</small>
        )}
      </td>
      <td>
        <strong>{item.staffName}</strong>
        <small>{item.specialty ?? '—'}</small>
      </td>
      <td>
        {item.leaveType === 'EMERGENCY' && item.reasonCategory && (
          <><strong>{REASON_TEXT[item.reasonCategory] ?? item.reasonCategory}</strong><br /></>
        )}
        {item.reason ?? <span className="adm-none">—</span>}
      </td>
      <td>
        {item.affectedBookings > 0
          ? (
            <span className="badge cancelled" title={item.affectedList.map((b) => `#${b.id} ${b.startsAt.slice(11, 16)} ${b.serviceName} — ${b.customerName}`).join('\n')}>
              <i />{item.affectedBookings} lịch cần xử lý
            </span>
          )
          : item.leaveType === 'EMERGENCY' && item.status === 'APPROVED'
            ? <span className="badge completed"><i />Đã xử lý xong</span>
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
  const emergencyOpen = leave.filter(
    (item) => item.leaveType === 'EMERGENCY' && item.status === 'APPROVED' && item.affectedBookings > 0,
  );
  const blocked = pending.reduce((sum, item) => sum + item.affectedBookings, 0)
    + emergencyOpen.reduce((sum, item) => sum + item.affectedBookings, 0);
  const incidents = leave
    .filter((item) => item.leaveType === 'EMERGENCY')
    .sort((a, b) => b.startDatetime.localeCompare(a.startDatetime));

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
          title="Sự cố nghỉ đột xuất"
          subtitle={emergencyOpen.length > 0
            ? `${emergencyOpen.reduce((sum, item) => sum + item.affectedList.length, 0)} lịch chờ bàn giao`
            : 'Không có sự cố cần xử lý'}
        />
        {incidents.length === 0 ? (
          <EmptyState title="Chưa có sự cố nghỉ đột xuất" detail="Nhân viên báo nghỉ đột xuất sẽ hiện ở đây kèm từng lịch cần bàn giao." />
        ) : (
          <ul className="adm-req-list">
            {incidents.map((item) => <IncidentCard key={item.id} item={item} />)}
          </ul>
        )}
      </Panel>

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
                  <th className="adm-stt">STT</th><th>Khoảng nghỉ</th><th>Nhân viên</th><th>Lý do</th>
                  <th>Lịch ảnh hưởng</th><th>Trạng thái</th><th>Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => <LeaveRow key={item.id} item={item} index={index} onDone={reload} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
