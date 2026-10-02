/* ===== Drawer chi tiết khách hàng + hộp thoại ghi chú ===== */

import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { Badge, EmptyState } from './Primitives';
import { Icon } from './Icon';
import { Stars } from './Stars';
import { apiRequest } from '../store';
import { fmtNum, money } from '../lib/utils';
import { customerTier } from '../lib/customers';
import type { CustomerDetail, HistoryItem } from '../types';

const NOTE_MAX = 2000;

interface Props {
  customerId: string;
  staffId: string;
  onClose: () => void;
  onNoteSaved: (id: string, note: string | null) => void;
}

export function CustomerDrawer({ customerId, staffId, onClose, onNoteSaved }: Props) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const panelRef = useRef<HTMLElement>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    setShowAll(false);
    setNoteOpen(false);
    /* Không gửi staffId nữa: backend lấy nhân viên từ token đăng nhập.
       Trước đây truyền từ query nghĩa là bỏ tham số thì xem được toàn bộ
       lịch sử của khách — nhân viên đọc được dữ liệu của khách chưa từng
       phục vụ ai. */
    apiRequest<CustomerDetail>(
      `/api/staff/customers/${encodeURIComponent(customerId)}`,
    )
      .then((data) => { if (alive) setDetail(data); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [customerId, staffId]);

  /* Khoá cuộn nền + trả focus về nút đã mở drawer */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.classList.add('cust-drawer-open');
    panelRef.current?.focus();
    return () => {
      document.body.classList.remove('cust-drawer-open');
      opener?.focus();
    };
  }, []);

  /* Giữ focus trong drawer khi dùng bàn phím */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !noteOpen) { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not(:disabled),input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, noteOpen]);

  useEffect(() => {
    if (noteOpen) firstField.current?.focus();
  }, [noteOpen]);

  const c = detail?.customer;
  const history = detail?.history ?? [];
  const visible = showAll ? history : history.slice(0, 5);
  const tier = c ? customerTier(c) : { key: 'new' as const, label: '' };

  const saveNote = async () => {
    if (!c || saving) return;
    setSaving(true);
    setNoteError('');
    try {
      await apiRequest(`/api/staff/customers/${encodeURIComponent(c.id)}/note`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: draft.trim() }),
      });
      const saved = draft.trim() || null;
      setDetail((prev) => (prev ? { ...prev, customer: { ...prev.customer, note: saved } } : prev));
      onNoteSaved(c.id, saved);
      setNoteOpen(false);
    } catch (e) {
      setNoteError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openNote = () => { setDraft(c?.note ?? ''); setNoteError(''); setNoteOpen(true); };

  return (
    <div className="cust-drawer is-open">
      <div className="cust-drawer-backdrop" onClick={onClose} />
      <section className="cust-drawer-panel" role="dialog" aria-modal="true"
        aria-labelledby="cust-drawer-title" tabIndex={-1} ref={panelRef}>
        <div className="cust-drawer-head">
          <div className="cust-drawer-title">
            <h2 id="cust-drawer-title">Thông tin khách hàng</h2>
            {!c && !error && <p>Đang tải hồ sơ khách hàng…</p>}
            {c && (
              <p>
                {fmtNum(history.length)} lịch hẹn với bạn
                {c.totalVisits > history.length && ` · ${fmtNum(c.totalVisits)} lượt tổng`}
                {c.memberSince && ` · khách từ ${c.memberSince}`}
              </p>
            )}
          </div>
          <button className="icon-button cust-drawer-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {error && <EmptyState title="Chưa tải được hồ sơ" detail={error} />}

        {c && (
          <>
            <div className="cust-drawer-scroll">
              <div className="cust-profile">
                <Avatar name={c.name} url={c.avatar} large />
                <div className="cust-profile-copy">
                  <h3>{c.name}</h3>
                  <span className={`cust-tier cust-tier-${tier.key}`}>
                    {tier.key === 'loyal' && '♥ '}{tier.label}
                  </span>
                </div>
              </div>

              <div className="cust-mini-stats">
                <div>
                  <span className="cust-mini-icon"><Icon name="schedule" /></span>
                  <strong>{fmtNum(c.totalVisits)}</strong>
                  <span>Lần đặt (tất cả)</span>
                </div>
                <div>
                  <span className="cust-mini-icon"><Icon name="done" /></span>
                  <strong>{c.rating > 0 ? c.rating.toFixed(1) : '—'}</strong>
                  <span>Đánh giá ({fmtNum(c.reviewCount)})</span>
                </div>
                <div>
                  <span className="cust-mini-icon"><Icon name="services" /></span>
                  <strong>{money(c.total_spending)}</strong>
                  <span>Tổng chi tiêu</span>
                </div>
              </div>

              <div className="cust-facts">
                <Fact icon="phone" label="Số điện thoại" value={c.phone} href={`tel:${c.phone}`} />
                <Fact icon="email" label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
                <Fact icon="address" label="Địa chỉ" value={c.address} />
                <Fact icon="birthday" label="Ngày sinh" value={c.birthday} />
              </div>

              <div className="cust-note-block">
                <div className="cust-note-head">
                  <h3>Ghi chú nội bộ</h3>
                  <button className="text-button cust-note-edit" onClick={openNote}>
                    {c.note ? 'Sửa ghi chú' : '+ Thêm ghi chú'}
                  </button>
                </div>
                <p className={`cust-note-body${c.note ? '' : ' is-empty'}`}>
                  {c.note || 'Chưa có ghi chú về khách hàng này. Ghi lại sở thích, dị ứng hoặc lưu ý để lần sau chăm sóc tốt hơn.'}
                </p>
              </div>

              <div className="cust-history-head">
                <h3>Lịch sử đặt dịch vụ</h3>
                <span>
                  {history.length > 5 ? (
                    <button className="text-button" onClick={() => setShowAll(true)}>
                      Xem tất cả ({fmtNum(history.length)}) →
                    </button>
                  ) : `${fmtNum(history.length)} lịch hẹn`}
                </span>
              </div>
              <HistoryTable rows={visible} />
            </div>

            <div className="cust-drawer-foot">
              <a className="button secondary" href={`tel:${c.phone}`}>☎ Gọi khách</a>
              {c.email
                ? <a className="button" href={`mailto:${c.email}`}>✉ Nhắn tin cho khách hàng</a>
                : <button className="button" type="button" disabled title="Khách chưa cập nhật email">✉ Nhắn tin cho khách hàng</button>}
            </div>

            {noteOpen && (
              <NoteEditor
                title="Ghi chú khách hàng"
                draft={draft}
                setDraft={setDraft}
                error={noteError}
                saving={saving}
                inputRef={firstField}
                onSave={saveNote}
                onCancel={() => setNoteOpen(false)}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Fact({
  icon, label, value, href,
}: { icon: 'phone' | 'email' | 'address' | 'birthday'; label: string; value: string | null; href?: string }) {
  const shown = value || 'Chưa cập nhật';
  return (
    <div className="cust-fact">
      <span className="cust-fact-icon"><Icon name={icon} /></span>
      <div>
        <small>{label}</small>
        {href ? <a href={href}>{shown}</a> : <span>{shown}</span>}
      </div>
    </div>
  );
}

function HistoryTable({ rows }: { rows: HistoryItem[] }) {
  if (!rows.length) {
    return (
      <div className="table-scroll cust-history-table">
        <table className="admin-table">
          <tbody>
            <tr><td className="cust-history-empty">Chưa có lịch sử đặt dịch vụ.</td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="table-scroll cust-history-table">
      <table className="admin-table">
        <thead>
          <tr>
            <th className="num">Ngày đặt</th>
            <th className="txt">Dịch vụ</th>
            <th className="txt">Trạng thái</th>
            <th className="num">Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="num">{b.date}<small>{b.time}</small></td>
              <td className="txt">{b.serviceName}<small>{money(b.price)} · {b.duration} phút</small></td>
              <td className="txt"><Badge status={b.status} /></td>
              <td className="num">
                {b.rating ? <Stars rating={b.rating} /> : <span className="cust-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Hộp thoại ghi chú — dùng chung cho drawer và cho nút ở đầu trang. */
export function NoteEditor({
  title = 'Thêm ghi chú khách hàng', draft, setDraft, error, saving,
  inputRef, onSave, onCancel, children,
}: {
  title?: string;
  draft: string;
  setDraft: (v: string) => void;
  error: string;
  saving: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onSave: () => void;
  onCancel: () => void;
  /** Ô chọn khách — chỉ hiện khi mở từ đầu trang. */
  children?: React.ReactNode;
}) {
  return (
    <div className="cust-dialog-backdrop" onClick={onCancel}>
      <div
        className="cust-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cust-note-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cust-note-title">{title}</h2>
        {children}
        <label className="cust-dialog-label" htmlFor="cust-note-input">Nội dung ghi chú</label>
        <textarea
          id="cust-note-input"
          ref={inputRef}
          rows={5}
          maxLength={NOTE_MAX}
          value={draft}
          placeholder="Ví dụ: Thích tone hồng nhạt, dị ứng sơn chứa acetone, thường đặt lịch cuối tuần."
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="cust-dialog-count">{draft.length}/{NOTE_MAX} ký tự</div>
        <p className="cust-dialog-error" role="alert">{error}</p>
        <div className="cust-dialog-foot">
          <button type="button" className="button secondary" onClick={onCancel}>Huỷ</button>
          <button type="button" className="button" onClick={onSave} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu ghi chú'}
          </button>
        </div>
      </div>
    </div>
  );
}
