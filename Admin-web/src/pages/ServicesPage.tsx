/* ===== Trang dịch vụ: lưới thẻ + bộ lọc cột phải ===== */

import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../components/Primitives';
import { PageBar } from '../components/PageBar';
import { Icon, type IconName } from '../components/Icon';
import { ServiceDialog } from '../components/ServiceDialog';
import { apiRequest, useApp } from '../store';
import { usePager } from '../hooks/usePager';
import { fmtNum, money, safeImage } from '../lib/utils';
import {
  serviceCategories, serviceCode, serviceStats, servicesFiltered, statusLabel,
} from '../lib/services';
import type { ServiceItem } from '../types';

const PAGE_SIZE = 9;

const STAT_CARDS: { key: string; label: string; symbol: IconName; tone: string }[] = [
  { key: '', label: 'Tổng dịch vụ', symbol: 'services', tone: 'rose' },
  { key: 'ACTIVE', label: 'Đang cung cấp', symbol: 'done', tone: 'sage' },
  { key: 'HIDDEN', label: 'Tạm ngưng', symbol: 'clock', tone: 'gold' },
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

  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');

  const active = Boolean(state.query.trim()) || state.serviceCategory !== '' || state.serviceStatus !== '';

  /* Thông báo tự ẩn sau vài giây, không cần bấm để đóng. */
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const saved = (service: ServiceItem, message: string) => {
    dispatch({ type: 'serviceSaved', service });
    setNotice(message);
  };

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
                      : card.key === 'ACTIVE' ? 'khách đang đặt được' : 'đang ẩn khỏi danh sách'}
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

        {notice && <p className="svc-notice" role="status">{notice}</p>}

        {info.rows.length ? (
          <>
            <div className="svc-grid">
              {info.rows.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onEdit={() => setEditing(s)}
                  onSaved={saved}
                  onRemoved={(message) => {
                    dispatch({ type: 'serviceRemoved', id: s.id });
                    setNotice(message);
                  }}
                />
              ))}
            </div>
            <PageBar info={info} onChange={info.goTo} unit="dịch vụ" />
          </>
        ) : (
          <EmptyState
            title={active ? 'Không có dịch vụ phù hợp' : 'Chưa có dịch vụ nào'}
            detail={active
              ? 'Bỏ bộ lọc hoặc thử từ khóa khác để xem thêm.'
              : 'Bấm “+ Thêm dịch vụ” để khai báo dịch vụ đầu tiên của bạn.'}
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
              { key: 'HIDDEN', label: 'Tạm ngưng', count: stats.hidden, symbol: 'clock' as IconName },
            ].map((item) => (
              <li key={item.key || 'all'}>
                <button
                  className={state.serviceStatus === item.key ? 'is-active' : ''}
                  aria-pressed={state.serviceStatus === item.key}
                  onClick={() => dispatch({ type: 'serviceStatus', value: item.key })}
                >
                  <span className={`svc-dot svc-dot-${item.key === 'HIDDEN' ? 'gold' : item.key === 'ACTIVE' ? 'sage' : 'rose'}`}>
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

      {(creating || editing) && (
        <ServiceDialog
          service={editing}
          staffId={state.staffId}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(service) => saved(service, editing ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ mới.')}
        />
      )}
    </div>
  );
}

/* Nút ở đầu trang: mở hộp thoại thêm dịch vụ. Hộp thoại nằm ở đây nên vẫn
   mở được khi người dùng cuộn xuống dưới danh sách dài. */
export function ServicesPageActions() {
  const [open, setOpen] = useState(false);
  const { state, dispatch } = useApp();

  return (
    <>
      <button className="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">＋</span> Thêm dịch vụ
      </button>
      {open && (
        <ServiceDialog
          service={null}
          staffId={state.staffId}
          onClose={() => setOpen(false)}
          onSaved={(service) => dispatch({ type: 'serviceSaved', service })}
        />
      )}
    </>
  );
}

/* ===== Thẻ dịch vụ: ảnh · mã · giá · thời lượng · trạng thái · menu ⋮ ===== */

function ServiceCard({
  service, onEdit, onSaved, onRemoved,
}: {
  service: ServiceItem;
  onEdit: () => void;
  onSaved: (service: ServiceItem, message: string) => void;
  onRemoved: (message: string) => void;
}) {
  const { state } = useApp();
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const image = safeImage(service.image);
  const hidden = service.status === 'HIDDEN';

  /* Bấm ra ngoài thì đóng menu ⋮. */
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  const toggleStatus = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = hidden ? 'ACTIVE' : 'HIDDEN';
      const data = await apiRequest<ServiceItem>(`/api/staff/services/${service.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          staffId: state.staffId,
          name: service.name,
          description: service.description,
          image: service.image,
          price: service.price,
          duration: service.duration,
          status: next,
          categoryId: service.categoryId ?? null,
        }),
      });
      onSaved({ ...service, ...data, status: next }, hidden ? 'Đã mở lại dịch vụ.' : 'Đã tạm ngưng dịch vụ.');
      setMenu(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/staff/services/${service.id}?staffId=${encodeURIComponent(state.staffId)}`, {
        method: 'DELETE',
      });
      onRemoved(`Đã gỡ “${service.name}” khỏi danh sách.`);
    } catch (e) {
      setError((e as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`svc-card${hidden ? ' is-hidden' : ''}`}>
      <div className="svc-card-media">
        {image
          ? <img src={image} alt={service.name} loading="lazy" />
          : <span className="svc-card-blank"><Icon name="flower" /></span>}
      </div>

      <div className="svc-card-body">
        <div className="svc-card-head">
          <h3 title={service.name}>{service.name}</h3>
          <div className="svc-menu" ref={wrapRef}>
            <button
              type="button"
              aria-label={`Tuỳ chọn cho ${service.name}`}
              aria-expanded={menu}
              aria-haspopup="menu"
              onClick={() => { setMenu((v) => !v); setConfirming(false); setError(''); }}
            >
              ⋮
            </button>
            {menu && (
              <div className="svc-menu-pop" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onEdit(); }}>
                  ✎ Sửa dịch vụ
                </button>
                <button type="button" role="menuitem" disabled={busy} onClick={toggleStatus}>
                  {hidden ? '▶ Đang cung cấp lại' : '⏸ Tạm ngưng'}
                </button>
                {confirming ? (
                  <div className="svc-menu-confirm">
                    <span>Gỡ dịch vụ này?</span>
                    <button type="button" disabled={busy} onClick={remove}>Gỡ</button>
                    <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Giữ</button>
                  </div>
                ) : (
                  <button type="button" role="menuitem" className="is-danger" onClick={() => setConfirming(true)}>
                    ✕ Gỡ khỏi danh sách
                  </button>
                )}
                {error && <p className="svc-menu-error">{error}</p>}
              </div>
            )}
          </div>
        </div>

        <p className="svc-card-code">{serviceCode(service.id)}</p>

        <p className="svc-card-meta">
          <span><Icon name="clock" />{fmtNum(service.duration)} phút</span>
        </p>

        <p className="svc-card-price">{money(service.price)}</p>
        <span className={`svc-pill ${hidden ? 'is-paused' : ''}`}>{statusLabel(service.status)}</span>
      </div>
    </article>
  );
}
