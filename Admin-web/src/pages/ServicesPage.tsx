/* ===== Trang dịch vụ (nhân viên): chỉ XEM =====

   Nhân viên không thêm, sửa, tạm ngưng hay gỡ dịch vụ — theo phân quyền
   trong README: Admin quản lý danh mục dịch vụ và giá; nhân viên chỉ xem
   danh sách dịch vụ mình phục vụ.

   Trước đây trang này có nút "＋ Thêm dịch vụ" và menu ⋮ gồm Sửa / Tạm
   ngưng / Gỡ, và các nút đó gọi POST/PUT/DELETE /api/staff/services. Nghĩa
   là nhân viên tự đổi được giá dịch vụ của cửa hàng. Nay các API đó không
   còn tồn tại và quyền quản lý chuyển sang khu vực quản trị
   (/api/admin/catalog/*). */

import { EmptyState } from '../components/Primitives';
import { PageBar } from '../components/PageBar';
import { Icon, type IconName } from '../components/Icon';
import { useApp } from '../store';
import { usePager } from '../hooks/usePager';
import { fmtNum, money, safeImage } from '../lib/utils';
import {
  serviceCategories, serviceCode, serviceStats, servicesFiltered, statusLabel,
} from '../lib/services';

const PAGE_SIZE = 9;

const STAT_CARDS: { key: string; label: string; symbol: IconName; tone: string }[] = [
  { key: '', label: 'Tổng dịch vụ', symbol: 'services', tone: 'rose' },
  { key: 'ACTIVE', label: 'Đang cung cấp', symbol: 'done', tone: 'sage' },
  { key: 'INACTIVE', label: 'Ngừng hoạt động', symbol: 'clock', tone: 'gold' },
  { key: 'price', label: 'Giá trung bình', symbol: 'tag', tone: 'lavender' },
];

export function ServicesPage() {
  const { state, dispatch } = useApp();
  const all = state.data!.services;
  const stats = serviceStats(all);
  const categories = serviceCategories(all);

  const rows = servicesFiltered(all, {
    query: state.query, category: state.serviceCategory, status: state.serviceStatus,
  });
  const info = usePager('services', rows, PAGE_SIZE);

  const active = Boolean(state.query.trim()) || state.serviceCategory !== '' || state.serviceStatus !== '';

  return (
    <div className="svc-layout">
      <div className="svc-main">
        {/* Thẻ số liệu chỉ để đọc, không bấm — giống trang Khách hàng.
            Lọc theo trạng thái vẫn làm ở cột phải (mục “Trạng thái”). */}
        <div className="svc-stats">
          {STAT_CARDS.map((card) => (
            <div key={card.key} className={`svc-stat svc-stat-${card.tone}`}>
              <span className="svc-stat-icon"><Icon name={card.symbol} /></span>
              <span className="svc-stat-copy">
                <span className="svc-stat-label">{card.label}</span>
                <strong>
                  {card.key === '' ? fmtNum(stats.total)
                    : card.key === 'price' ? stats.avgPrice
                      : fmtNum(card.key === 'ACTIVE' ? stats.active : stats.hidden)}
                </strong>
                <small>
                  {card.key === '' ? 'dịch vụ của bạn'
                    : card.key === 'price' ? 'mỗi lượt làm'
                      : card.key === 'ACTIVE' ? 'khách đang đặt được' : 'cửa hàng đã ngừng'}
                </small>
              </span>
            </div>
          ))}
        </div>

        <div className="svc-tabs" role="tablist" aria-label="Danh mục dịch vụ">
          <button
            role="tab"
            aria-selected={state.serviceCategory === ''}
            className={state.serviceCategory === '' ? 'is-active' : ''}
            onClick={() => dispatch({ type: 'serviceCategory', value: '' })}
          >
            Tất cả <span>{fmtNum(all.length)}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              role="tab"
              aria-selected={state.serviceCategory === c.name}
              className={state.serviceCategory === c.name ? 'is-active' : ''}
              onClick={() => dispatch({
                type: 'serviceCategory',
                value: state.serviceCategory === c.name ? '' : c.name,
              })}
            >
              {c.name} <span>{fmtNum(c.count)}</span>
            </button>
          ))}
        </div>

        {info.rows.length ? (
          <>
            <div className="svc-grid">
              {info.rows.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
            <PageBar info={info} onChange={info.goTo} unit="dịch vụ" />
          </>
        ) : (
          <EmptyState
            title={active ? 'Không có dịch vụ phù hợp' : 'Chưa có dịch vụ nào'}
            detail={active
              ? 'Bỏ bộ lọc hoặc thử từ khóa khác để xem thêm.'
              : 'Liên hệ quản lý để được gán dịch vụ.'}
          />
        )}
      </div>

      <aside className="svc-aside">
        <label className="svc-search">
          <Icon name="search" />
          <input
            aria-label="Tìm dịch vụ"
            placeholder="Tìm dịch vụ, mã dịch vụ…"
            value={state.query}
            onChange={(e) => dispatch({ type: 'query', query: e.target.value })}
          />
          {state.query && (
            <button type="button" aria-label="Xoá từ khoá" onClick={() => dispatch({ type: 'query', query: '' })}>
              ✕
            </button>
          )}
        </label>

        <section className="panel svc-filter">
          <h3>Trạng thái</h3>
          <ul>
            {[
              { key: '', label: 'Tất cả', count: all.length, symbol: 'check' as IconName },
              { key: 'ACTIVE', label: 'Đang cung cấp', count: stats.active, symbol: 'done' as IconName },
              { key: 'INACTIVE', label: 'Ngừng hoạt động', count: stats.hidden, symbol: 'clock' as IconName },
            ].map((item) => (
              <li key={item.key || 'all'}>
                <button
                  className={state.serviceStatus === item.key ? 'is-active' : ''}
                  aria-pressed={state.serviceStatus === item.key}
                  onClick={() => dispatch({ type: 'serviceStatus', value: item.key })}
                >
                  <span className={`svc-dot svc-dot-${item.key === 'INACTIVE' ? 'gold' : item.key === 'ACTIVE' ? 'sage' : 'rose'}`}>
                    <Icon name={item.symbol} />
                  </span>
                  {item.label}
                  <em>{fmtNum(item.count)}</em>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel svc-filter">
          <h3>Danh mục dịch vụ</h3>
          <ul>
            <li>
              <button
                className={state.serviceCategory === '' ? 'is-active' : ''}
                aria-pressed={state.serviceCategory === ''}
                onClick={() => dispatch({ type: 'serviceCategory', value: '' })}
              >
                <span className="svc-check" aria-hidden="true">✓</span>
                Tất cả
                <em>{fmtNum(all.length)}</em>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.name}>
                <button
                  className={state.serviceCategory === c.name ? 'is-active' : ''}
                  aria-pressed={state.serviceCategory === c.name}
                  onClick={() => dispatch({
                    type: 'serviceCategory',
                    value: state.serviceCategory === c.name ? '' : c.name,
                  })}
                >
                  <span className="svc-check" aria-hidden="true">✓</span>
                  {c.name}
                  <em>{fmtNum(c.count)}</em>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="quote-card">
          <p>“Dịch vụ tử tế<br />Nâng tầm vẻ đẹp”</p>
          <span>NailHouse Studio</span>
        </section>

        <section className="help-card">
          <span className="help-card-icon"><Icon name="bell" /></span>
          <div>
            <h3>Cần hỗ trợ?</h3>
            <p>Liên hệ quản lý để được hỗ trợ thêm về dịch vụ.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

/* Không còn nút thêm dịch vụ: việc đó thuộc quyền Admin. Vị trí nút ở đầu
   trang vẫn được giữ để main.tsx không phải đổi cấu trúc. */
export function ServicesPageActions() {
  return (
    <span className="svc-readonly-hint">Danh mục dịch vụ do quản lý quản lý</span>
  );
}

/* ===== Thẻ dịch vụ: ảnh · mã · giá · thời lượng · trạng thái ===== */

function ServiceCard({ service }: { service: import('../types').ServiceItem }) {
  const image = safeImage(service.image);
  const paused = service.status === 'INACTIVE';

  return (
    <article className={`svc-card${paused ? ' is-hidden' : ''}`}>
      <div className="svc-card-media">
        {image
          ? <img src={image} alt={service.name} loading="lazy" />
          : <span className="svc-card-blank"><Icon name="flower" /></span>}
      </div>

      <div className="svc-card-body">
        <div className="svc-card-head">
          <h3 title={service.name}>{service.name}</h3>
        </div>

        <p className="svc-card-code">{serviceCode(service.id)}</p>

        <p className="svc-card-meta">
          <span><Icon name="clock" />{fmtNum(service.duration)} phút</span>
        </p>

        <p className="svc-card-price">{money(service.price)}</p>
        <span className={`svc-pill ${paused ? 'is-paused' : ''}`}>{statusLabel(service.status)}</span>
      </div>
    </article>
  );
}