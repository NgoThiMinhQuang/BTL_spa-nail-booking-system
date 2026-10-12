/* ===== Trang thông báo =====
   Hai ngăn tách bạch, khỏi lẫn như trước:
   - "Tin nhắn của tôi": hộp thư của chính admin (nghỉ đột xuất, tin khẩn).
     Tin chưa đọc in đậm + nút đánh dấu đã đọc.
   - "Gửi tới khách": giám sát đẩy tin cho khách. Backend tạo bản ghi KHÔNG
     đồng nghĩa khách đã nhận: FAILED nổi trước để gọi tay/SMS, và thử đẩy
     lại khi khách mở app đăng ký máy. */

import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { sendAdmin } from '../lib/admin-api';

interface Notice {
  id: string; title: string; body: string; type: string;
  refType: string | null; refId: string | null;
  channel: 'INAPP' | 'PUSH' | 'SMS'; status: 'PENDING' | 'SENT' | 'FAILED' | 'READ';
  attempts: number; errorMessage: string | null;
  userName: string | null; phone: string | null;
}

interface MyNotice {
  id: string; title: string; body: string; type: string;
  refType: string | null; refId: string | null;
  channel: 'INAPP' | 'PUSH' | 'SMS'; status: 'PENDING' | 'SENT' | 'FAILED' | 'READ';
  createdAt: string;
}

type View = 'mine' | 'customer';
type Filter = 'FAILED' | 'PENDING' | 'SENT' | 'READ' | 'ALL';

const TABS: { key: Filter; label: string }[] = [
  { key: 'FAILED', label: 'Gửi lỗi' },
  { key: 'PENDING', label: 'Đang chờ' },
  { key: 'SENT', label: 'Đã gửi' },
  { key: 'READ', label: 'Đã đọc' },
  { key: 'ALL', label: 'Tất cả' },
];

const STATUS_TEXT: Record<Notice['status'], string> = {
  FAILED: 'Gửi lỗi', PENDING: 'Đang chờ', SENT: 'Đã gửi', READ: 'Đã đọc',
};

export function AdminNotificationsPage() {
  const [view, setView] = useState<View>('mine');

  const [mine, setMine] = useState<MyNotice[]>([]);
  const [mineLoading, setMineLoading] = useState(false);
  const unread = mine.filter((item) => item.status !== 'READ').length;

  const [filter, setFilter] = useState<Filter>('FAILED');
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadMine() {
    setMineLoading(true);
    const result = await sendAdmin<MyNotice[]>('/notifications/mine', 'GET');
    setMineLoading(false);
    if (result.ok) setMine(result.data);
  }

  async function load(target: Filter) {
    setLoading(true);
    const query = target === 'ALL' ? '' : `?status=${target}`;
    const result = await sendAdmin<Notice[]>(`/notifications${query}`, 'GET');
    setLoading(false);
    if (result.ok) setRows(result.data);
  }

  useEffect(() => { loadMine(); }, []);
  useEffect(() => { if (view === 'customer') load(filter); }, [view, filter]);

  async function markRead(item: MyNotice) {
    const result = await sendAdmin(`/notifications/${item.id}/read`, 'PATCH');
    if (result.ok) {
      setMine((prev) => prev.map((row) => (
        row.id === item.id ? { ...row, status: 'READ' } : row)));
    }
  }

  async function retry(item: Notice) {
    setMessage('');
    const result = await sendAdmin<{ status: string }>(`/notifications/${item.id}/retry`, 'POST');
    if (!result.ok) {
      setMessage(`${item.userName ?? 'Khách'}: ${result.message}`);
      return;
    }
    await load(filter);
  }

  const failed = rows.filter((r) => r.status === 'FAILED');

  return (
    <>
      <div className="adm-tabs" role="tablist" aria-label="Hộp thông báo" style={{ margin: '0 0 16px' }}>
        <button role="tab" aria-selected={view === 'mine'}
          className={view === 'mine' ? 'is-on' : ''} onClick={() => setView('mine')}>
          <Icon name="bell" /> Tin nhắn của tôi
          {unread > 0
            ? <em className="adm-tab-count is-alert">{unread}</em>
            : <em className="adm-tab-count">{mine.length}</em>}
        </button>
        <button role="tab" aria-selected={view === 'customer'}
          className={view === 'customer' ? 'is-on' : ''} onClick={() => setView('customer')}>
          <Icon name="customers" /> Gửi tới khách
        </button>
      </div>

      {view === 'mine' && (
        <Panel>
          <SectionHeading
            icon={<Icon name="bell" />}
            title="Tin nhắn của tôi"
            subtitle={unread > 0 ? `${unread} tin chưa đọc` : 'Đã đọc hết tin nhắn'}
          />
          {mineLoading && <p className="app-note" style={{ padding: '0 16px' }}>Đang tải…</p>}
          {!mineLoading && mine.length === 0 && (
            <EmptyState title="Chưa có tin nhắn" detail="Tin báo cho quản trị (nghỉ đột xuất, tin khẩn) sẽ hiện ở đây." />
          )}
          {mine.length > 0 && (
            <ul className="adm-mine-list">
              {mine.map((item) => {
                const fresh = item.status !== 'READ';
                return (
                  <li key={item.id} className={fresh ? 'is-fresh' : ''}>
                    <div>
                      <p>
                        <strong>{item.title}</strong>
                        {fresh && <span className="badge pending"><i />Mới</span>}
                      </p>
                      <p className="adm-mine-body">{item.body}</p>
                      <small>{String(item.createdAt).slice(0, 16).replace('T', ' ')}</small>
                    </div>
                    {fresh && (
                      <button className="button secondary" onClick={() => markRead(item)}>
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {view === 'customer' && (
        <>
          <div className="adm-tiles adm-tiles-4">
            <StatTile tone="rose" icon="ban" label="Gửi lỗi" value={failed.length}
              note={failed.length > 0 ? 'gọi tay/SMS cho khách' : 'không có tin lỗi'} />
            <StatTile tone="gold" icon="clock" label="Đang chờ" value={rows.filter((r) => r.status === 'PENDING').length}
              note="tin push chờ đẩy" />
            <StatTile tone="sage" icon="check" label="Đã gửi" value={rows.filter((r) => r.status === 'SENT').length}
              note="cổng đẩy đã nhận" />
            <StatTile tone="lavender" icon="done" label="Đã đọc" value={rows.filter((r) => r.status === 'READ').length}
              note="khách đã mở xem" />
          </div>

          <Panel>
            <SectionHeading
              icon={<Icon name="customers" />}
              title="Thông báo tới khách"
              subtitle="Tạo bản ghi chưa chắc khách đã nhận — FAILED phải xử lý tay"
            >
              <div className="mode-tabs">
                {TABS.map((tab) => (
                  <button key={tab.key} className={filter === tab.key ? 'active' : ''}
                    onClick={() => setFilter(tab.key)}>{tab.label}</button>
                ))}
              </div>
            </SectionHeading>

            {message && <p className="adm-error" style={{ padding: '0 16px' }}>{message}</p>}
            {loading && <p className="app-note" style={{ padding: '0 16px' }}>Đang tải…</p>}

            {rows.length === 0 && !loading ? (
              <EmptyState title="Không có thông báo" detail="Tin nhắn cho khách sẽ hiện ở đây." />
            ) : (
              <div className="table-scroll">
                <table className="adm-table adm-table-wide">
                  <thead>
                    <tr>
                      <th className="adm-stt">STT</th><th>Khách hàng</th><th>Nội dung</th>
                      <th>Kênh</th><th>Trạng thái</th><th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item, index) => (
                      <tr key={item.id}>
                        <td className="adm-stt">{index + 1}</td>
                        <td>
                          <strong>{item.userName ?? '—'}</strong>
                          <small>{item.phone ?? 'khách vãng lai'}</small>
                        </td>
                        <td>
                          <strong>{item.title}</strong>
                          <small>{item.body}</small>
                        </td>
                        <td>{item.channel}</td>
                        <td>
                          <span className={`badge ${item.status === 'FAILED' ? 'cancelled'
                            : item.status === 'READ' ? 'completed' : 'pending'}`}>
                            <i />{STATUS_TEXT[item.status]}
                          </span>
                          {item.errorMessage && <small>{item.errorMessage}</small>}
                          {item.attempts > 0 && <small> · thử {item.attempts} lần</small>}
                        </td>
                        <td>
                          {item.status === 'FAILED' && item.channel === 'PUSH' ? (
                            <button className="button secondary" onClick={() => retry(item)}>
                              Thử đẩy lại
                            </button>
                          ) : (
                            <span className="adm-none">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
