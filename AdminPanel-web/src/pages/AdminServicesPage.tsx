/* ===== Trang Dịch vụ của quản trị =====

   Mỗi dòng là một dịch vụ thật trong bảng services, kèm số liệu bật ra từ
   database: số nhân viên thực hiện được, số lịch hẹn đã nhận, doanh thu từ
   các lịch hoàn thành và điểm đánh giá trung bình. Bấm vào thẻ để xem chi tiết
   mô tả, thời gian nghỉ sau dịch vụ và danh sách nhân viên. */

import { useState } from 'react';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ServiceDrawer } from '../components/ServiceDrawer';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtNum, fmtRating, formatVND, moneyShort, safeImage } from '../lib/utils';
import type { ServiceItem } from '../store';

type SortKey = 'popular' | 'revenue' | 'price' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Bán chạy nhất' },
  { key: 'revenue', label: 'Doanh thu cao' },
  { key: 'price', label: 'Giá cao nhất' },
  { key: 'name', label: 'Tên A → Z' },
];

export function AdminServicesPage() {
  const { state, reload } = useApp();
  const { services, categories } = state;

  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [onlyActive, setOnlyActive] = useState(false);
  const [sort, setSort] = useState<SortKey>('popular');
  const [quickFeedback, setQuickFeedback] = useState('');

  /* Khung trượt bên phải kiểu trang Khách hàng: bấm dòng xem chi tiết,
     bấm Sửa thì sửa ngay trong khung, Thêm thì mở khung trắng. */
  const [drawer, setDrawer] = useState<{
    service: ServiceItem | null; mode: 'detail' | 'edit';
  } | null>(null);

  async function toggleStatus(service: ServiceItem) {
    const next = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await sendAdmin(`/catalog/services/${service.id}/status`, 'PATCH', { status: next });
    if (!result.ok) {
      setQuickFeedback(result.message);
      return;
    }
    setQuickFeedback('');
    reload();
  }

  const rows = services
    .filter((service) =>
      (category === 'all' || service.categoryId === category)
      && (!onlyActive || service.status === 'ACTIVE')
      && (service.name.toLowerCase().includes(term.toLowerCase())
        || (service.description ?? '').toLowerCase().includes(term.toLowerCase())))
    .sort((a, b) => {
      if (sort === 'revenue') return b.revenue - a.revenue;
      if (sort === 'price') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name, 'vi');
      return b.bookingCount - a.bookingCount;
    });

  const active = services.filter((service) => service.status === 'ACTIVE');
  const avgPrice = active.length
    ? Math.round(active.reduce((sum, s) => sum + s.price, 0) / active.length) : 0;
  const totalRevenue = services.reduce((sum, s) => sum + s.revenue, 0);
  const rated = services.filter((s) => s.reviewCount > 0);
  const avgRating = rated.length
    ? rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length : null;

  /* Khung đang mở luôn đọc bản mới nhất từ store để sau khi lưu / ẩn /
     mở trong khung, nội dung hiện ra là số liệu vừa tải lại. */
  const liveService = drawer?.service
    ? services.find((service) => service.id === drawer.service!.id) ?? drawer.service
    : null;

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="services" label="Dịch vụ đang mở"
          value={`${active.length}/${services.length}`} note={`${categories.length} danh mục`} />
        <StatTile tone="sage" icon="dollar" label="Doanh thu dịch vụ" value={moneyShort(totalRevenue)} note="từ lịch hoàn thành" />
        <StatTile tone="gold" icon="card" label="Giá trung bình" value={formatVND(avgPrice)} note="mỗi buổi" />
        <StatTile tone="lavender" icon="star" label="Điểm đánh giá" value={fmtRating(avgRating)}
          note={`${rated.length} dịch vụ có phản hồi`} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="services" />}
          title="Danh mục dịch vụ"
          subtitle={`${rows.length} trong ${services.length} dịch vụ`}
        >
          <button className="button" onClick={() => setDrawer({ service: null, mode: 'edit' })}>＋ Thêm dịch vụ</button>
        </SectionHeading>
        {quickFeedback && <p className="adm-error" style={{ padding: '0 16px' }}>{quickFeedback}</p>}

        {/* Danh mục: dùng đúng bộ tab của app nhân viên */}
        <div className="svc-tabs" style={{ padding: '0 16px' }}>
          <button className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>
            Tất cả<span>{services.length}</span>
          </button>
          {categories.map((item) => (
            <button key={item.id}
              className={category === item.id ? 'is-active' : ''}
              onClick={() => setCategory(item.id)}>
              {item.name}<span>{item.serviceCount}</span>
            </button>
          ))}
        </div>

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm dịch vụ"
              placeholder="Tìm theo tên hoặc mô tả…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <button
            className={`button secondary${onlyActive ? ' is-on' : ''}`}
            onClick={() => setOnlyActive((prev) => !prev)}
            aria-pressed={onlyActive}
          >
            <Icon name="check" /> <span>Chỉ dịch vụ đang mở</span>
          </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy dịch vụ" detail="Thử đổi danh mục hoặc bỏ từ khoá tìm kiếm." />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th className="num">STT</th>
                  <th>Dịch vụ</th>
                  <th className="num">Giá</th>
                  <th className="num">Thời lượng</th>
                  <th className="num">Nhân viên</th>
                  <th className="num">Lịch hẹn</th>
                  <th className="num">Doanh thu</th>
                  <th>Đánh giá</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {/* STT chạy theo đúng thứ tự đang hiển thị (đã lọc + sắp
                    xếp) nên đổi tab/sắp xếp là số tự nhảy theo — không dùng
                    mã dịch vụ cố định. */}
                {rows.map((service, index) => (
                  <tr key={service.id} onClick={() => setDrawer({ service, mode: 'detail' })}
                    style={{ cursor: 'pointer' }}>
                    <td className="num">{index + 1}</td>
                    <td>
                      <span className="adm-cell-name">
                        {safeImage(service.imageUrl)
                          ? <img className="adm-thumb" src={safeImage(service.imageUrl)} alt="" loading="lazy" />
                          : <span className="adm-thumb adm-thumb-blank"><Icon name="services" /></span>}
                        <span style={{ minWidth: 0 }}>
                          <strong>{service.name}</strong>
                          {service.category && <span className="adm-tag">{service.category}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="num"><strong>{formatVND(service.price)}</strong></td>
                    <td className="num">{service.duration}′{service.bufferTime > 0 ? <small>+{service.bufferTime}′ nghỉ</small> : null}</td>
                    <td className="num">{service.staffCount} người</td>
                    <td className="num">{fmtNum(service.bookingCount)}</td>
                    <td className="num"><strong>{formatVND(service.revenue)}</strong></td>
                    <td>
                      {service.reviewCount > 0
                        ? <span className="adm-rating"><Icon name="star" /> {fmtRating(service.rating)}
                          <small>{service.reviewCount}</small></span>
                        : <span className="adm-none">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${service.status === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
                        <i />{service.status === 'ACTIVE' ? 'Đang mở' : 'Tạm ẩn'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button secondary" onClick={(e) => { e.stopPropagation(); setDrawer({ service, mode: 'edit' }); }}>
                          Sửa
                        </button>
                        <button className="button secondary" onClick={(e) => { e.stopPropagation(); toggleStatus(service); }}>
                          {service.status === 'ACTIVE' ? 'Ẩn' : 'Mở'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Khung trượt bên phải kiểu trang Khách hàng: xem chi tiết và sửa
          ngay trong khung. key theo dịch vụ + chế độ để đổi khung là reset. */}
      {drawer && (
        <ServiceDrawer
          key={`${drawer.service?.id ?? 'new'}-${drawer.mode}`}
          service={liveService}
          initialMode={drawer.mode}
          categories={categories}
          onClose={() => setDrawer(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}