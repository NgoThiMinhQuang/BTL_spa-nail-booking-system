/* ===== Trang Danh mục dịch vụ =====
   Mỗi thẻ là một service_category thật, kèm số dịch vụ bên trong, tổng giá trị
   và các dịch vụ thuộc danh mục. Bấm thẻ để xem chi tiết. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { fmtNum, formatVND, moneyShort } from '../lib/utils';

export function AdminCategoriesPage() {
  const { state } = useApp();
  const { categories, services } = state;

  const [term, setTerm] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = categories
    .filter((item) => item.name.toLowerCase().includes(term.toLowerCase()))
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
        />

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
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy danh mục" detail="Thử một từ khoá khác." />
        ) : (
          <div className="adm-people">
            {rows.map((item) => (
              <button key={item.id} className="adm-person adm-cat-card"
                onClick={() => setOpenId(item.id)}>
                <div className="adm-cat-head">
                  <span className="adm-cat-icon"><Icon name="tag" /></span>
                  <span style={{ minWidth: 0 }}>
                    <h3>{item.name}</h3>
                    <small>{item.serviceCount} dịch vụ</small>
                  </span>
                </div>
                <p>{item.description ?? 'Chưa có mô tả cho danh mục này.'}</p>
                <div className="adm-person-meta">
                  <span><Icon name="dollar" /> {formatVND(item.totalPrice)}</span>
                  <span><Icon name="services" /> {item.serviceCount}</span>
                </div>
              </button>
            ))}
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
