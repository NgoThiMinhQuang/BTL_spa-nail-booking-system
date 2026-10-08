/* ===== Trang Danh mục dịch vụ =====
   Mỗi thẻ là một service_category thật, kèm số dịch vụ bên trong, tổng giá trị
   và các dịch vụ thuộc danh mục. Bấm thẻ để xem chi tiết. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtNum, formatVND, moneyShort } from '../lib/utils';
import type { CategoryItem } from '../store';

export function AdminCategoriesPage() {
  const { state, reload } = useApp();
  const { categories, services } = state;

  const [term, setTerm] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');

  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE' });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', status: 'ACTIVE' });
    setFeedback('');
    setCreating(true);
  }

  function openEdit(item: CategoryItem) {
    setOpenId(null);
    setEditing(item);
    setForm({ name: item.name, description: item.description ?? '', status: item.status ?? 'ACTIVE' });
    setFeedback('');
    setCreating(true);
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    const body = { name: form.name.trim(), description: form.description.trim(), status: form.status };
    const result = editing
      ? await sendAdmin(`/catalog/categories/${editing.id}`, 'PUT', body)
      : await sendAdmin('/catalog/categories', 'POST', body);
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setCreating(false);
    reload();
  }

  async function toggleStatus(item: CategoryItem) {
    const next = (item.status ?? 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await sendAdmin(`/catalog/categories/${item.id}/status`, 'PATCH', { status: next });
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    reload();
  }

  async function removeCategory(item: CategoryItem) {
    /* Backend chặn khi danh mục còn dịch vụ (409) nên chỉ hỏi lại cho
       chắc, thông điệp lỗi hiện nguyên văn. */
    if (!window.confirm(`Xoá danh mục "${item.name}"? Danh mục còn dịch vụ thì không xoá được.`)) return;
    const result = await sendAdmin(`/catalog/categories/${item.id}`, 'DELETE');
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setOpenId(null);
    reload();
  }

  const rows = categories
    .filter((item) => item.name.toLowerCase().includes(term.toLowerCase()))
    .filter((item) => statusFilter === 'all' || (item.status ?? 'ACTIVE') === statusFilter)
    .sort((a, b) => b.serviceCount - a.serviceCount);

  const open = categories.find((item) => item.id === openId);
  const openServices = open
    ? services.filter((service) => service.categoryId === open.id)
      .sort((a, b) => a.price - b.price)
    : [];

  const emptyCategories = services.filter((service) => !service.categoryId).length;
  const avgServices = categories.length
    ? fmtNum(services.length / categories.length) : '0';

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="tag" label="Danh mục" value={categories.length} note="nhóm dịch vụ" />
        <StatTile tone="sage" icon="services" label="Dịch vụ" value={services.length}
          note={`${avgServices} dịch vụ mỗi danh mục`} />
        <StatTile tone="gold" icon="dollar" label="Tổng giá trị"
          value={moneyShort(categories.reduce((sum, item) => sum + item.totalPrice, 0))}
          note="cộng giá mỗi dịch vụ" />
        <StatTile tone="lavender" icon="ban" label="Chưa có danh mục" value={emptyCategories}
          note={emptyCategories > 0 ? 'nên gán danh mục' : 'mọi dịch vụ đã có nhóm'} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="tag" />}
          title="Danh mục dịch vụ"
          subtitle={`${rows.length} trong ${categories.length} danh mục`}
        >
          <button className="button" onClick={openCreate}>＋ Thêm danh mục</button>
        </SectionHeading>
        {feedback && !creating && <p className="adm-error" style={{ padding: '0 16px' }}>{feedback}</p>}

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm danh mục"
              placeholder="Tìm theo tên danh mục…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select aria-label="Lọc theo trạng thái" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang mở</option>
            <option value="INACTIVE">Tạm ẩn</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy danh mục" detail="Thử một từ khoá hoặc trạng thái khác." />
        ) : (
          <div className="adm-people adm-cats">
            {rows.map((item) => {
              const active = (item.status ?? 'ACTIVE') === 'ACTIVE';
              const preview = services
                .filter((service) => service.categoryId === item.id)
                .sort((a, b) => b.bookingCount - a.bookingCount)
                .slice(0, 3);
              return (
                <article key={item.id} className={`adm-person adm-cat-card${active ? '' : ' is-off'}`}>
                  <div className="adm-cat-head">
                    <span className="adm-cat-icon"><Icon name="tag" /></span>
                    <span style={{ minWidth: 0 }}>
                      <h3>{item.name}</h3>
                      <small>{item.serviceCount} dịch vụ · {formatVND(item.totalPrice)}</small>
                    </span>
                    <span className={`badge ${active ? 'completed' : 'cancelled'}`}>
                      <i />{active ? 'Đang mở' : 'Tạm ẩn'}
                    </span>
                  </div>
                  <p>{item.description ?? 'Chưa có mô tả cho danh mục này.'}</p>
                  {preview.length > 0 && (
                    <ul className="adm-cat-preview">
                      {preview.map((service) => (
                        <li key={service.id}>
                          <span>{service.name}</span>
                          <em>{formatVND(service.price)}</em>
                        </li>
                      ))}
                      {item.serviceCount > preview.length && (
                        <li className="more">+{item.serviceCount - preview.length} dịch vụ khác</li>
                      )}
                    </ul>
                  )}
                  <div className="adm-cat-foot">
                    <button className="adm-link" onClick={() => setOpenId(item.id)}>
                      Chi tiết →
                    </button>
                    <span className="adm-cat-actions">
                      <button className="button secondary" onClick={() => openEdit(item)}
                        title={`Sửa danh mục ${item.name}`}>
                        <Icon name="edit" /> Sửa
                      </button>
                      <button className="button secondary" onClick={() => toggleStatus(item)}
                        title={active ? `Ẩn danh mục ${item.name}` : `Mở lại danh mục ${item.name}`}>
                        <Icon name={active ? 'pause' : 'play'} /> {active ? 'Ẩn' : 'Mở'}
                      </button>
                      <button className="button secondary is-danger" onClick={() => removeCategory(item)}
                        title={`Xoá danh mục ${item.name}`}>
                        <Icon name="trash" /> Xoá
                      </button>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {open && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setOpenId(null)}>
          <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
            <span className="adm-tag">{open.serviceCount} dịch vụ</span>
            <h3 style={{ marginTop: 6 }}>{open.name}</h3>
            {open.description && <p>{open.description}</p>}

            {openServices.length === 0 ? (
              <p className="adm-detail-text">Danh mục này chưa có dịch vụ nào.</p>
            ) : (
              <ul className="adm-history adm-cat-list">
                {openServices.map((service) => (
                  <li key={service.id}>
                    <span className="adm-history-when">{service.duration}′</span>
                    <span className="adm-history-what">{service.name}</span>
                    <span className="adm-cat-price">{formatVND(service.price)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="adm-modal-foot">
              <button className="button secondary" onClick={() => setOpenId(null)}>Đóng</button>
              {open && (
                <>
                  <button className="button secondary" onClick={() => openEdit(open)}>Sửa</button>
                  <button className="button secondary" onClick={() => removeCategory(open)}>Xoá</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hộp thêm / sửa danh mục */}
      {creating && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setCreating(false)}>
          <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? `Sửa danh mục "${editing.name}"` : 'Thêm danh mục mới'}</h3>
            <form className="adm-form" onSubmit={submitCategory}>
              <label className="adm-field">
                <span>Tên danh mục</span>
                <input value={form.name} onChange={set('name')} disabled={busy}
                  placeholder="Ví dụ: Sơn gel" />
              </label>
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Trạng thái</span>
                  <select value={form.status} onChange={set('status')} disabled={busy}>
                    <option value="ACTIVE">Đang mở</option>
                    <option value="INACTIVE">Tạm ẩn</option>
                  </select>
                </label>
                <span />
              </div>
              <label className="adm-field">
                <span>Mô tả</span>
                <textarea value={form.description} onChange={set('description')} disabled={busy}
                  rows={3} placeholder="Mô tả ngắn…" />
              </label>
              {feedback && <p className="adm-error">{feedback}</p>}
              <div className="adm-modal-foot">
                <button className="button secondary" type="button" disabled={busy}
                  onClick={() => setCreating(false)}>Hủy</button>
                <button className="button" type="submit" disabled={busy}>
                  {editing ? 'Lưu thay đổi' : 'Thêm danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
