/* ===== Trang Nhân viên của quản trị =====
   Mỗi thẻ là một nhân viên thật, kèm số liệu từ booking/review của riêng nhân
   viên đó: số ca đã nhận, doanh thu, điểm đánh giá và danh sách chuyên môn. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { fmtNum, fmtRating, moneyShort } from '../lib/utils';

export function AdminStaffPage() {
  const { state } = useApp();
  const { staff, services } = state;

  const [term, setTerm] = useState('');
  const [specialty, setSpecialty] = useState('all');

  const specialties = Array.from(new Set(
    staff.map((item) => item.specialty).filter((value): value is string => Boolean(value)),
  ));

  const rows = staff
    .filter((item) =>
      (specialty === 'all' || item.specialty === specialty)
      && (item.name.toLowerCase().includes(term.toLowerCase())
        || (item.specialty ?? '').toLowerCase().includes(term.toLowerCase())));

  const onShift = staff.filter((item) => item.worksToday).length;
  const totalRevenue = staff.reduce((sum, item) => sum + item.revenue, 0);
  const rated = staff.filter((item) => item.reviewCount > 0);
  const avgRating = rated.length
    ? rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length : null;

  /** Đếm nhân viên thực hiện được từng danh mục, để đổ danh mục ở bộ lọc. */
  const categoryOf = (serviceId: string) =>
    services.find((service) => service.id === serviceId)?.category;

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="adminStaff" label="Nhân viên" value={staff.length} note="đang hoạt động" />
        <StatTile tone="sage" icon="clock" label="Đang trong ca" value={`${onShift}/${staff.length}`} note="hôm nay" />
        <StatTile tone="gold" icon="dollar" label="Doanh thu nhân sự" value={moneyShort(totalRevenue)} note="lịch hoàn thành" />
        <StatTile tone="lavender" icon="star" label="Điểm đánh giá" value={fmtRating(avgRating)}
          note={`${rated.length} người có phản hồi`} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="adminStaff" />}
          title="Danh sách nhân viên"
          subtitle={`${rows.length} trong ${staff.length} nhân viên`}
        />

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm nhân viên"
              placeholder="Tìm theo tên hoặc chuyên môn…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select aria-label="Lọc theo chuyên môn" value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}>
            <option value="all">Tất cả chuyên môn</option>
            {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy nhân viên" detail="Thử một từ khoá khác." />
        ) : (
          <div className="adm-people">
            {rows.map((item) => (
              <article key={item.id} className="adm-person">
                <div className="adm-person-head">
                  <Avatar name={item.name} url={item.avatarUrl} size={44} />
                  <span style={{ minWidth: 0 }}>
                    <h3>{item.name}</h3>
                    <small>{item.specialty ?? 'Chưa cập nhật chuyên môn'}</small>
                  </span>
                </div>

                <div className="adm-person-meta">
                  <span><Icon name="star" /> {fmtRating(item.rating)}
                    {item.reviewCount > 0 ? ` (${item.reviewCount})` : ''}</span>
                  <span><Icon name="schedule" /> {fmtNum(item.bookingCount)} lịch</span>
                  <span><Icon name="dollar" /> {moneyShort(item.revenue)}</span>
                </div>

                <dl className="adm-person-nums">
                  <div><dt>Kinh nghiệm</dt><dd>{item.experienceYears} năm</dd></div>
                  <div><dt>Hoàn thành</dt><dd>{fmtNum(item.completedCount)}</dd></div>
                  <div><dt>Dịch vụ</dt><dd>{item.serviceCount}</dd></div>
                </dl>

                <div className="adm-cell-meta">
                  {item.serviceNames.slice(0, 3).map((name) => {
                    const match = services.find((service) => service.name === name);
                    return <span key={name} className="adm-tag">{categoryOf(match?.id ?? '') ?? name}</span>;
                  })}
                  {item.serviceNames.length > 3 && (
                    <span className="adm-tag">+{item.serviceNames.length - 3}</span>
                  )}
                </div>

                <div className="adm-person-foot">
                  <span className={`badge ${item.worksToday ? 'completed' : 'pending'}`}>
                    <i />{item.worksToday ? 'Đang trong ca' : 'Ngoài ca'}
                  </span>
                  <span className="adm-person-phone">{item.phone}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
