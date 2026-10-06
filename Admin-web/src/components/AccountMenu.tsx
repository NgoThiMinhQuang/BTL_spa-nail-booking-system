/* ===== Menu tài khoản trên topbar: Hồ sơ cá nhân / Đổi mật khẩu / Đăng xuất ===== */

import { useEffect, useRef, useState } from 'react';
import { useApp, apiRequest } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

function doLogout(dispatch: ReturnType<typeof useApp>['dispatch']) {
  try {
    localStorage.removeItem('nailhouse_staff_token');
    localStorage.removeItem('nailhouse_token');
  } catch { /* bỏ qua */ }
  dispatch({ type: 'logout' });
}

export function AccountMenu() {
  const { state, dispatch } = useApp();
  const { goView } = useNavigation();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const name = state.data ? state.data.profile.name : state.user?.name ?? 'Đang tải…';
  const email = state.data?.profile.email ?? state.user?.email ?? '';

  /* Bấm ra ngoài hoặc Esc thì đóng menu. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  return (
    <div className="account-menu" ref={boxRef}>
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tài khoản của bạn"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account-avatar">
          {state.data
            ? <Avatar name={state.data.profile.name} url={state.data.profile.avatar} />
            : 'NH'}
        </span>
        <span className="account-name">{name}</span>
        <span className={`account-caret${open ? ' is-open' : ''}`} aria-hidden="true">
          <Icon name="chevronDown" />
        </span>
      </button>

      {open && (
        <div className="account-pop" role="menu" aria-label="Tùy chọn tài khoản">
          <div className="account-pop-head">
            <Avatar name={name} url={state.data?.profile.avatar} large />
            <div>
              <strong>{name}</strong>
              {email && <small>{email}</small>}
              <small className="account-role">Nhân viên NailHouse</small>
            </div>
          </div>
          <button
            type="button" role="menuitem"
            onClick={() => { setOpen(false); goView('profile'); }}
          >
            <Icon name="profile" /> Hồ sơ cá nhân
          </button>
          <button
            type="button" role="menuitem"
            onClick={() => { setOpen(false); setPwOpen(true); }}
          >
            <Icon name="shield" /> Đổi mật khẩu
          </button>
          <div className="account-pop-sep" aria-hidden="true" />
          <button
            type="button" role="menuitem" className="is-danger"
            onClick={() => doLogout(dispatch)}
          >
            <span aria-hidden="true">⎋</span> Đăng xuất
          </button>
        </div>
      )}

      {pwOpen && (
        <PasswordDialog
          onClose={() => setPwOpen(false)}
        />
      )}
    </div>
  );
}

/* Hộp thoại đổi mật khẩu: gọi PUT /api/auth/password (token gắn sẵn). */
function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!current.trim() || !next || !confirm) {
      setOk(false); setMessage('Vui lòng nhập đủ 3 ô mật khẩu.');
      return;
    }
    if (next.length < 6) {
      setOk(false); setMessage('Mật khẩu mới cần ít nhất 6 ký tự.');
      return;
    }
    if (next !== confirm) {
      setOk(false); setMessage('Nhập lại mật khẩu mới chưa khớp.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      await apiRequest('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setOk(true); setMessage('Đổi mật khẩu thành công.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setOk(false); setMessage(err instanceof Error ? err.message : 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="cust-dialog-backdrop"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cust-dialog account-pw-dialog" role="dialog" aria-modal="true" aria-label="Đổi mật khẩu">
        <h2>Đổi mật khẩu</h2>
        <form onSubmit={submit}>
          <label className="svc-field">
            <span>Mật khẩu hiện tại</span>
            <input
              ref={firstField}
              type="password" autoComplete="current-password"
              value={current} disabled={busy}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="svc-field">
            <span>Mật khẩu mới (ít nhất 6 ký tự)</span>
            <input
              type="password" autoComplete="new-password"
              value={next} disabled={busy}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className="svc-field">
            <span>Nhập lại mật khẩu mới</span>
            <input
              type="password" autoComplete="new-password"
              value={confirm} disabled={busy}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {message && (
            <p className={ok ? 'account-pw-ok' : 'account-pw-error'} role="status">{message}</p>
          )}
          <div className="account-pw-actions">
            <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
              {ok ? 'Đóng' : 'Hủy bỏ'}
            </button>
            {!ok && (
              <button type="submit" className="button" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu mật khẩu'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
