/* ===== Đăng nhập không gian nhân viên =====

   Trước đây màn hình này so trực tiếp với một cặp tài khoản viết cứng
   trong mã nguồn rồi tự chế ra một đối tượng user giả. Nghĩa là chỉ cần
   gõ đúng hai chữ là vào được — và sau đó mọi yêu cầu API đều không có
   token nào.

   Nay nút "Đăng nhập" gọi thật vào POST /api/auth/login. Backend trả về
   token JWT, mọi lệnh gọi sau đó đính kèm token ở header Authorization,
   và backend tự chặn nếu token không hợp lệ hoặc sai vai trò. Nên bảo vệ
   nằm ở server chứ không nằm ở chỗ kiểm tra trong trình duyệt này. */

import { useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import type { AuthUser } from '../types';

export function LoginPage() {
  const { dispatch } = useApp();
  const [username, setUsername] = useState('0901000002');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: username.trim(), password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message ?? 'Tài khoản hoặc mật khẩu không đúng.');
        return;
      }

      const { token, user } = payload.data;
      /* Chỉ nhận vai trò nhân viên. Tài khoản quản trị thuộc khu vực
         /admin — nếu token hợp lệ nhưng sai vai trò thì vào đây cũng
         không có dữ liệu để hiển thị. */
      if (user.role !== 'STAFF') {
        setError('Tài khoản này không thuộc không gian làm việc của nhân viên.');
        return;
      }

      localStorage.setItem('nailhouse_staff_token', token);
      /* Dọn key chung cũ (hai web từng dùng chung 'nailhouse_token'):
         token admin sót lại mà không dọn thì vẫn nằm đó, dù không còn
         ai đọc. */
      localStorage.removeItem('nailhouse_token');
      dispatch({
        type: 'login',
        user: { id: user.staffId, name: user.name, email: user.email, role: 'staff' } as AuthUser,
      });
    } catch {
      setError('Không kết nối được tới máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-staff">
      <section className="login-staff-card">
        <div className="login-staff-brand">
          <span className="brand-mark"><Icon name="flower" /></span>
          <span>Nail<span className="rose">House</span><small>BEAUTY NAILS · BETTER YOU</small></span>
        </div>

        <h1>Đăng nhập nhân viên</h1>
        <p className="login-staff-sub">Không gian làm việc của bạn tại NailHouse.</p>

        <form onSubmit={submit} className="login-staff-form">
          <label>
            <span>Tài khoản</span>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              placeholder="Số điện thoại hoặc email"
              autoComplete="username"
            />
          </label>
          <label>
            <span>Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="login-staff-error" role="alert">{error}</p>}

          <button type="submit" className="button login-staff-submit" disabled={busy}>
            {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="login-staff-demo">
          Tài khoản demo: <code>0901000002</code> / <code>123456</code>
        </p>
        <a className="login-staff-admin" href="/admin/">Quản trị viên? Vào khu vực quản trị ↗</a>
      </section>
    </div>
  );
}