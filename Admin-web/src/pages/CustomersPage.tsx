/* ===== Trang khách hàng của tôi ===== */

import { useMemo, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { PageBar } from '../components/PageBar';
import { Stars } from '../components/Stars';
import { CustomerDrawer, NoteEditor } from '../components/CustomerDrawer';
import { apiRequest, useApp } from '../store';
import { usePager } from '../hooks/usePager';
import { downloadCsv, fmtNum } from '../lib/utils';
import {
  customersFiltered, customerTier, SEGMENTS, SORTS, useCustomerStats,
} from '../lib/customers';
import type { CustomerSummary } from '../types';

const PAGE_SIZE = 8;

export function CustomersPage() {
  const { state, dispatch } = useApp();
  const all = state.data!.customers;
  const rows = customersFiltered(all, {
    query: state.query, filter: state.customerFilter, sort: state.customerSort,
  });
  const info = usePager('customers', rows, PAGE_SIZE);
  const stats = useCustomerStats(all);

  const filtered = Boolean(state.query.trim()) || state.customerFilter !== 'all';
  const listSub = filtered
    ? `${fmtNum(rows.length)} trong ${fmtNum(all.length)} khách`
    : `${fmtNum(all.length)} khách`;

  const cards = [
    { key: 'all', symbol: 'customers' as const, label: 'Tổng khách hàng', value: fmtNum(stats.total), note: 'trong danh sách của bạn', tone: 'rose' },
    { key: 'loyal', symbol: 'done' as const, label: 'Khách hàng thân thiết', value: fmtNum(stats.loyal), note: 'từ 5 lượt đặt trở lên', tone: 'gold' },
    { key: 'returning', symbol: 'schedule' as const, label: 'Khách hàng quay lại', value: fmtNum(stats.returning), note: 'đặt từ lần thứ 2', tone: 'sage' },
    { key: 'rating', symbol: 'play' as const, label: 'Đánh giá trung bình', value: stats.avgRating, note: `${fmtNum(stats.reviewTotal)} đánh giá`, tone: 'lavender', stars: stats.avgRating !== '—' },
  ];

  const exportCsv = () => {
    downloadCsv(`khach-hang-${state.date}.csv`, [
      ['STT', 'Ten khach hang', 'So dien thoại', 'Email', 'So lan dat', 'Lan gan nhat', 'Dia chi', 'Diem danh gia'],
      ...rows.map((c, i) => [
        i + 1, c.name, c.phone, c.email ?? '', c.visits, c.lastVisit, c.address ?? '', c.rating || '',
      ]),
    ]);
  };

  return (
    <>
      {/* Thẻ số liệu chỉ để đọc, không bấm. Lọc nhóm vẫn dùng select bên dưới. */}
      <div className="cust-stats">
        {cards.map((card) => (
          <div key={card.key} className={`cust-stat cust-stat-${card.tone}`}>
            <span className="cust-stat-icon"><Icon name={card.symbol} /></span>
            <div className="cust-stat-copy">
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              {card.stars ? <Stars rating={Number(stats.avgRating)} /> : <small>{card.note}</small>}
            </div>
          </div>
        ))}
      </div>

      <section className="panel cust-list">
        <div className="section-heading cust-list-head">
          <div>
            <h2>Danh sách khách hàng</h2>
            <p>{listSub}</p>
          </div>
          <button className="button secondary cust-export" onClick={exportCsv}>⤓ &nbsp; Xuất danh sách</button>
        </div>

        <div className="cust-tools">
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm khách hàng"
              placeholder="Tìm theo tên, số điện thoại, email…"
              value={state.query}
              onChange={(e) => dispatch({ type: 'query', query: e.target.value })}
            />
          </label>
          <select
            aria-label="Lọc khách hàng"
            value={state.customerFilter}
            onChange={(e) => dispatch({ type: 'customerFilter', value: e.target.value })}
          >
            {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select
            aria-label="Sắp xếp khách hàng"
            value={state.customerSort}
            onChange={(e) => dispatch({ type: 'customerSort', value: e.target.value })}
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {info.rows.length ? (
          <div className="table-scroll">
            <table className="admin-table cust-table">
              <thead>
                <tr>
                  <th className="col-stt">STT</th>
                  <th className="txt">Khách hàng</th>
                  <th className="txt">Số điện thoại</th>
                  <th className="num">Số lần đặt</th>
                  <th className="txt">Lần gần nhất</th>
                  <th className="num">Đánh giá</th>
                  <th><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {info.rows.map((c, i) => {
                  const tier = customerTier(c);
                  return (
                    <tr key={c.id} data-cust-row={c.id}>
                      <td className="col-stt num">{fmtNum(info.start + i + 1)}</td>
                      <td className="txt">
                        <div className="cust-person">
                          <Avatar name={c.name} url={c.avatar} />
                          <div>
                            <strong>{c.name}</strong>
                            <small className={`cust-tier cust-tier-${tier.key}`}>
                              {tier.key === 'loyal' && '♥ '}{tier.label}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="txt">
                        <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()}>{c.phone}</a>
                      </td>
                      <td className="num">{fmtNum(c.visits)}<small>lần</small></td>
                      <td className="txt">{c.lastVisit}</td>
                      <td className="num">
                        {c.rating
                          ? <><Stars rating={c.rating} /><small>{c.rating.toFixed(1)}</small></>
                          : <span className="cust-muted">Chưa đánh giá</span>}
                      </td>
                      <td className="txt">
                        <button
                          className="view-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'customerOpen', id: c.id });
                          }}
                          aria-label={`Xem chi tiết ${c.name}`}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={filtered ? 'Không có khách phù hợp' : 'Chưa có khách hàng'}
            detail={filtered
              ? 'Thử từ khóa khác hoặc chọn nhóm “Tất cả”.'
              : 'Khách hàng có lịch hẹn với bạn sẽ xuất hiện tại đây.'}
          />
        )}

        <PageBar info={info} onChange={info.goTo} unit="khách hàng" />
      </section>

      {state.customerId && (
        <CustomerDrawer
          customerId={state.customerId}
          staffId={state.staffId}
          onClose={() => dispatch({ type: 'customerOpen', id: null })}
          onNoteSaved={(id, note) => dispatch({ type: 'customerNote', id, note })}
        />
      )}
    </>
  );
}

/* Nút ở đầu trang: mở hộp thoại ghi chú, có chọn khách. */
export function CustomersPageActions() {
  const { state, dispatch } = useApp();
  const all = state.data?.customers ?? [];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const rows = useMemo(
    () => customersFiltered(all, { query: state.query, filter: state.customerFilter, sort: state.customerSort }),
    [all, state.query, state.customerFilter, state.customerSort],
  );

  if (!all.length) return null;

  const currentId = picked || rows[0]?.id || all[0].id;
  const current = all.find((c) => String(c.id) === String(currentId));

  const save = async () => {
    if (saving || !current) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/staff/customers/${encodeURIComponent(current.id)}/note`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: draft.trim() }),
      });
      dispatch({ type: 'customerNote', id: current.id, note: draft.trim() || null });
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button className="button" onClick={() => { setOpen(true); setDraft(current?.note ?? ''); setError(''); }}>
        <span aria-hidden="true">✎</span>
        <span className="cust-note-long">+ Thêm ghi chú khách hàng</span>
        <span className="cust-note-short">Ghi chú</span>
      </button>
    );
  }

  return (
    <NoteEditor
      draft={draft}
      setDraft={setDraft}
      error={error}
      saving={saving}
      inputRef={inputRef}
      onSave={save}
      onCancel={() => setOpen(false)}
    >
      <label className="cust-dialog-label" htmlFor="cust-note-customer">Khách hàng</label>
      <select
        id="cust-note-customer"
        className="cust-dialog-select"
        value={currentId}
        onChange={(e) => {
          setPicked(e.target.value);
          setDraft(all.find((c) => String(c.id) === e.target.value)?.note ?? '');
          setError('');
        }}
      >
        {(rows.length ? rows : all).map((c: CustomerSummary) => (
          <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
        ))}
      </select>
    </NoteEditor>
  );
}
