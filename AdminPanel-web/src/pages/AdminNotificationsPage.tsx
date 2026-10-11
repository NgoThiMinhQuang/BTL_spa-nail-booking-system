/* ===== Trang giám sát gửi thông báo =====
   Backend tạo bản ghi KHÔNG đồng nghĩa khách đã nhận: ở đây FAILED nổi
   trước để Admin gọi tay/SMS, và thử đẩy lại khi khách mở app đăng ký máy. */

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
  const [filter, setFilter] = useState<Filter>('FAILED');
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function load(target: Filter) {
    setLoading(true);
    const query = target === 'ALL' ? '' : `?status=${target}`;
    const result = await sendAdmin<Notice[]>(`/notifications${query}`, 'GET');
    setLoading(false);
    if (result.ok) setRows(result.data);
  }

  useEffect(() => { load(filter); }, [filter]);

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
          icon={<Icon name="bell" />}
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
  );
}
