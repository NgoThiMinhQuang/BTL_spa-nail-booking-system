/* ===== Trang Dịch vụ của quản trị =====

   Mỗi dòng là một dịch vụ thật trong bảng services, kèm số liệu bật ra từ
   database: số nhân viên thực hiện được, số lịch hẹn đã nhận, doanh thu từ
   các lịch hoàn thành và điểm đánh giá trung bình. Bấm vào thẻ để xem chi tiết
   mô tả, thời gian nghỉ sau dịch vụ và danh sách nhân viên. */

import { useState } from 'react';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { Icon } from '../components/Icon';
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
  const [detailId, setDetailId] = useState<string | null>(null);

  /* Thêm / sửa dịch vụ. Đổi giá ở đây không làm đổi lịch cũ vì lịch nào
     cũng chụp giá lúc đặt — xem BR36. */
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({
    name: '', categoryId: '', price: '', duration: '60',
    bufferTime: '0', description: '', status: 'ACTIVE',
  });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function openCreate() {
    setEditing(null);
    setForm({ name: '', categoryId: '', price: '', duration: '60', bufferTime: '0', description: '', status: 'ACTIVE' });
    setFeedback('');
    setCreating(true);
  }

  function openEdit(service: ServiceItem) {
    setDetailId(null);
    setEditing(service);
    setForm({
      name: service.name, categoryId: service.categoryId ?? '',
      price: String(service.price), duration: String(service.duration),
      bufferTime: String(service.bufferTime ?? 0),
      description: service.description ?? '', status: service.status,
    });
    setFeedback('');
    setCreating(true);
  }

  async function submitService(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    const body = {
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      price: Number(form.price),
      duration: Number(form.duration),
      bufferTime: Number(form.bufferTime) || 0,
      description: form.description.trim(),
      status: form.status,
    };
    const result = editing
      ? await sendAdmin(`/catalog/services/${editing.id}`, 'PUT', body)
      : await sendAdmin('/catalog/services', 'POST', body);
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setCreating(false);
    reload();
  }

  async function toggleStatus(service: ServiceItem) {
    const next = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await sendAdmin(`/catalog/services/${service.id}/status`, 'PATCH', { status: next });
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    reload();
  }

  async function removeService(service: ServiceItem) {
    /* Backend chặn khi dịch vụ đã có lịch hoặc đang làm add-on (409) nên
       ở đây chỉ hỏi lại cho chắc, thông điệp lỗi hiện nguyên văn. */
    if (!window.confirm(`Xoá dịch vụ "${service.name}"? Dịch vụ đã có lịch hẹn thì không xoá được.`)) return;
    const result = await sendAdmin(`/catalog/services/${service.id}`, 'DELETE');
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setDetailId(null);
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

  const detail = services.find((service) => service.id === detailId);

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
          <button className="button" onClick={openCreate}>＋ Thêm dịch vụ</button>
        </SectionHeading>
        {feedback && !creating && <p className="adm-error" style={{ padding: '0 16px' }}>{feedback}</p>}

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
                  <th>Dịch vụ</th>
                  <th>Giá</th>
                  <th>Thời lượng</th>
                  <th>Nhân viên</th>
                  <th>Lịch hẹn</th>
                  <th>Doanh thu</th>
                  <th>Đánh giá</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((service) => (
                  <tr key={service.id} onClick={() => setDetailId(service.id)}
                    style={{ cursor: 'pointer' }}>
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
                    <td><strong>{formatVND(service.price)}</strong></td>
                    <td>{service.duration}′{service.bufferTime > 0 ? <small>+{service.bufferTime}′ nghỉ</small> : null}</td>
                    <td>{service.staffCount} người</td>
                    <td>{fmtNum(service.bookingCount)}</td>
                    <td><strong>{formatVND(service.revenue)}</strong></td>
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
                        <button className="button secondary" onClick={(e) => { e.stopPropagation(); openEdit(service); }}>
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

      {/* Thẻ chi tiết của một dịch vụ */}
      {detail && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setDetailId(null)}>
          <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="adm-detail-head">
              {safeImage(detail.imageUrl)
                ? <img className="adm-detail-image" src={safeImage(detail.imageUrl)} alt="" />
                : <span className="adm-detail-image adm-thumb-blank"><Icon name="services" /></span>}
              <div style={{ minWidth: 0 }}>
                <span className="adm-tag">{detail.category ?? 'Chưa phân loại'}</span>
                <h3>{detail.name}</h3>
                <p className="adm-detail-price">{formatVND(detail.price)} · {detail.duration} phút</p>
              </div>
            </div>

            {detail.description && <p className="adm-detail-text">{detail.description}</p>}

            <dl className="adm-detail-list">
              <div><dt>Số nhân viên thực hiện</dt><dd>{detail.staffCount}</dd></div>
              <div><dt>Lịch hẹn đã nhận</dt><dd>{fmtNum(detail.bookingCount)}</dd></div>
              <div><dt>Doanh thu</dt><dd>{formatVND(detail.revenue)}</dd></div>
              <div><dt>Thời gian nghỉ sau dịch vụ</dt><dd>{detail.bufferTime} phút</dd></div>
              <div><dt>Điểm đánh giá</dt>
                <dd>{detail.reviewCount > 0 ? `${fmtRating(detail.rating)} / 5 (${detail.reviewCount})` : 'Chưa có'}</dd>
              </div>
            </dl>

            {detail.staffNames.length > 0 && (
              <div className="adm-detail-staff">
                <h4>Nhân viên thực hiện</h4>
                <p>{detail.staffNames.join(', ')}</p>
              </div>
            )}

            <div className="adm-modal-foot">
              <button className="button secondary" onClick={() => setDetailId(null)}>Đóng</button>
              {detail && (
                <>
                  <button className="button secondary" onClick={() => openEdit(detail)}>Sửa</button>
                  <button className="button secondary" onClick={() => toggleStatus(detail)}>
                    {detail.status === 'ACTIVE' ? 'Tạm ẩn' : 'Mở bán'}
                  </button>
                  <button className="button secondary" onClick={() => removeService(detail)}>Xoá</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hộp thêm / sửa dịch vụ */}
      {creating && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setCreating(false)}>
          <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? `Sửa dịch vụ "${editing.name}"` : 'Thêm dịch vụ mới'}</h3>
            <form className="adm-form" onSubmit={submitService}>
              <label className="adm-field">
                <span>Tên dịch vụ</span>
                <input value={form.name} onChange={set('name')} disabled={busy}
                  placeholder="Ví dụ: Sơn gel cao cấp" />
              </label>
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Danh mục</span>
                  <select value={form.categoryId} onChange={set('categoryId')} disabled={busy}>
                    <option value="">— Chưa phân loại —</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="adm-field">
                  <span>Trạng thái</span>
                  <select value={form.status} onChange={set('status')} disabled={busy}>
                    <option value="ACTIVE">Đang mở bán</option>
                    <option value="INACTIVE">Tạm ẩn</option>
                  </select>
                </label>
              </div>
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Giá (đ)</span>
                  <input value={form.price} onChange={set('price')} disabled={busy}
                    inputMode="numeric" placeholder="Ví dụ: 200000" />
                </label>
                <label className="adm-field">
                  <span>Thời lượng (phút)</span>
                  <input value={form.duration} onChange={set('duration')} disabled={busy}
                    inputMode="numeric" />
                </label>
              </div>
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Nghỉ sau dịch vụ (phút)</span>
                  <input value={form.bufferTime} onChange={set('bufferTime')} disabled={busy}
                    inputMode="numeric" />
                </label>
                <span />
              </div>
              <label className="adm-field">
                <span>Mô tả</span>
                <textarea value={form.description} onChange={set('description')} disabled={busy}
                  rows={3} placeholder="Mô tả ngắn cho khách xem…" />
              </label>
              {feedback && <p className="adm-error">{feedback}</p>}
              <div className="adm-modal-foot">
                <button className="button secondary" type="button" disabled={busy}
                  onClick={() => setCreating(false)}>Hủy</button>
                <button className="button" type="submit" disabled={busy}>
                  {editing ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}