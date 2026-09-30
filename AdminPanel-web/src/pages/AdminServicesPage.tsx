/* ===== Trang Dịch vụ của quản trị =====
   Cùng bộ thẻ số liệu (.svc-stat) và bảng của app nhân viên. */

import { useState } from 'react';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { formatVND } from '../lib/utils';

interface Service {
  id: number; name: string; category: string; price: number;
  duration: number; requireDeposit: boolean; status: string; image: string;
}

const SERVICES: Service[] = [
  { id: 1, name: 'Sơn Gel', category: 'Làm móng tay', price: 150000, duration: 60, requireDeposit: true, status: 'Hoạt động', image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=100&h=100' },
  { id: 2, name: 'Sơn Móng Cổ Điển', category: 'Làm móng tay', price: 100000, duration: 45, requireDeposit: false, status: 'Hoạt động', image: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=80&w=100&h=100' },
  { id: 3, name: 'Spa Chăm Sóc Chân', category: 'Làm móng chân', price: 200000, duration: 75, requireDeposit: true, status: 'Hoạt động', image: 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&q=80&w=100&h=100' },
  { id: 4, name: 'Đắp Bột Móng', category: 'Đắp móng', price: 350000, duration: 120, requireDeposit: true, status: 'Hoạt động', image: 'https://images.unsplash.com/photo-1595868832863-71a7d6051786?auto=format&fit=crop&q=80&w=100&h=100' },
];

const CATEGORIES = ['Tất cả', 'Làm móng tay', 'Làm móng chân', 'Đắp móng'];

export function AdminServicesPage() {
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [deposit, setDeposit] = useState<Record<number, boolean>>(
    Object.fromEntries(SERVICES.map((s) => [s.id, s.requireDeposit])),
  );

  const rows = SERVICES.filter((s) =>
    (category === 'Tất cả' || s.category === category)
    && s.name.toLowerCase().includes(term.toLowerCase()));

  const depositCount = Object.values(deposit).filter(Boolean).length;
  const avgPrice = Math.round(SERVICES.reduce((s, x) => s + x.price, 0) / SERVICES.length);
  const avgDuration = Math.round(SERVICES.reduce((s, x) => s + x.duration, 0) / SERVICES.length);

  return (
    <>
      {/* Thẻ số liệu — chỉ đọc */}
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="services" label="Tổng dịch vụ" value={SERVICES.length} note="đang mở" />
        <StatTile tone="sage" icon="dollar" label="Giá trung bình" value={formatVND(avgPrice)} note="mỗi buổi" />
        <StatTile tone="gold" icon="clock" label="Thời lượng TB" value={`${avgDuration}′`} note="mỗi buổi" />
        <StatTile tone="lavender" icon="card" label="Yêu cầu đặt cọc" value={`${depositCount}/${SERVICES.length}`} note="dịch vụ" />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="services" />}
          title="Danh mục dịch vụ"
          subtitle={`${rows.length} trong ${SERVICES.length} dịch vụ`}
        />

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm dịch vụ"
              placeholder="Tìm dịch vụ…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Lọc theo danh mục"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="button secondary">
            <Icon name="sparkles" /> <span>Trạng thái</span>
          </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy dịch vụ" detail="Thử đổi danh mục hoặc xoá từ khoá tìm kiếm." />
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Dịch vụ</th>
                  <th>Giá tiền</th>
                  <th>Thời lượng</th>
                  <th>Yêu cầu đặt cọc</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="adm-cell-name">
                        <img className="adm-thumb" src={s.image} alt="" loading="lazy" />
                        <span style={{ minWidth: 0 }}>
                          <strong>{s.name}</strong>
                          <span className="adm-tag">{s.category}</span>
                        </span>
                      </span>
                    </td>
                    <td><strong>{formatVND(s.price)}</strong></td>
                    <td>{s.duration} phút</td>
                    <td>
                      <div
                        role="switch"
                        aria-checked={deposit[s.id]}
                        aria-label={`Yêu cầu đặt cọc cho ${s.name}`}
                        tabIndex={0}
                        className={`adm-toggle${deposit[s.id] ? ' is-on' : ''}`}
                        onClick={() => setDeposit((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDeposit((prev) => ({ ...prev, [s.id]: !prev[s.id] }));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <span className="badge completed"><i />{s.status}</span>
                    </td>
                    <td>
                      <span className="adm-row-actions">
                        <button className="adm-icon-btn" aria-label={`Sửa ${s.name}`}>
                          <Icon name="edit" />
                        </button>
                        <button className="adm-icon-btn" aria-label={`Xoá ${s.name}`}>
                          <Icon name="trash" />
                        </button>
                      </span>
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