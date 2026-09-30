/* ===== Trang Nhân viên của quản trị =====
   Lưới thẻ hồ sơ nhân viên, dùng lại bộ bo góc 12–13px và thang chữ 11–13px
   của app nhân viên. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';

interface StaffItem {
  id: string; name: string; role: string; rating: number;
  initials: string; tags: string[]; status: string; worksToday: boolean;
}

const STAFF: StaffItem[] = [
  { id: 'NV001', name: 'Emma Wilson', role: 'Kỹ thuật viên', rating: 4.9, initials: 'EW', tags: ['Gel', 'Acrylic', 'Nail Art'], status: 'Hoạt động', worksToday: true },
  { id: 'NV002', name: 'Olivia Chen', role: 'KTV cao cấp', rating: 4.8, initials: 'OC', tags: ['Chrome', 'Bột nhúng', 'Pedicure'], status: 'Hoạt động', worksToday: true },
  { id: 'NV003', name: 'Mia Rodriguez', role: 'Kỹ thuật viên', rating: 4.7, initials: 'MR', tags: ['Sơn Pháp', 'Gel', 'Nail Art'], status: 'Hoạt động', worksToday: false },
  { id: 'NV004', name: 'Ava Thompson', role: 'KTV mới', rating: 4.6, initials: 'AT', tags: ['Manicure', 'Pedicure'], status: 'Hoạt động', worksToday: true },
  { id: 'NV005', name: 'Isabella Lee', role: 'KTV cao cấp', rating: 4.9, initials: 'IL', tags: ['Acrylic', 'Đắp Sculpting', 'Gel'], status: 'Hoạt động', worksToday: true },
  { id: 'NV006', name: 'Sophia Park', role: 'Kỹ thuật viên', rating: 4.8, initials: 'SP', tags: ['Gel', 'Chrome', 'Nail Art'], status: 'Hoạt động', worksToday: false },
];

export function AdminStaffPage() {
  const [term, setTerm] = useState('');

  const rows = STAFF.filter((s) => s.name.toLowerCase().includes(term.toLowerCase()));
  const onShift = STAFF.filter((s) => s.worksToday).length;
  const avgRating = (STAFF.reduce((sum, s) => sum + s.rating, 0) / STAFF.length).toFixed(1);

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="adminStaff" label="Nhân viên" value={STAFF.length} note="đang hoạt động" />
        <StatTile tone="sage" icon="clock" label="Đang trong ca" value={`${onShift}/${STAFF.length}`} note="hôm nay" />
        <StatTile tone="gold" icon="star" label="Điểm đánh giá" value={avgRating} note="trung bình cửa hàng" />
        <StatTile tone="lavender" icon="services" label="Chuyên môn" value={new Set(STAFF.flatMap((s) => s.tags)).size} note="mã chuyên môn" />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="adminStaff" />}
          title="Danh sách nhân viên"
          subtitle={`${rows.length} trong ${STAFF.length} nhân viên`}
        />

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm nhân viên"
              placeholder="Tìm nhân viên…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select aria-label="Lọc theo chuyên môn" defaultValue="all">
            <option value="all">Tất cả chuyên môn</option>
            {Array.from(new Set(STAFF.flatMap((s) => s.tags))).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy nhân viên" detail="Thử một từ khoá khác." />
        ) : (
          <div className="adm-people">
            {rows.map((s) => (
              <article key={s.id} className="adm-person">
                <div className="adm-person-head">
                  <span className="avatar">{s.initials}</span>
                  <span style={{ minWidth: 0 }}>
                    <h3>{s.name}</h3>
                    <small>{s.role} · {s.id}</small>
                  </span>
                </div>

                <div className="adm-person-meta">
                  <span><Icon name="star" /> {s.rating.toFixed(1)}</span>
                  <span><Icon name="clock" /> {s.worksToday ? 'Đang trong ca' : 'Ngoài ca'}</span>
                </div>

                <div className="adm-cell-meta">
                  {s.tags.map((t) => <span key={t} className="adm-tag">{t}</span>)}
                </div>

                <div className="adm-row-actions" style={{ marginTop: 'auto', paddingTop: 10 }}>
                  <button className="adm-icon-btn" aria-label={`Sửa hồ sơ ${s.name}`}>
                    <Icon name="edit" />
                  </button>
                  <button className="adm-icon-btn" aria-label={`Xem lịch của ${s.name}`}>
                    <Icon name="schedule" />
                  </button>
                  <button className="adm-icon-btn" aria-label={`Nhắn tin ${s.name}`}>
                    <Icon name="email" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}