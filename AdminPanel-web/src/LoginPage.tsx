/* ===== Đăng nhập khu vực quản trị =====

   Cùng bảng màu và thang chữ với màn đăng nhập nhân viên, chỉ khác ở nhãn
   "KHU VỰC QUẢN TRỊ".

   Trước đây màn này so trực tiếp với "admin / admin123" viết cứng trong
   mã nguồn, không hề gọi máy chủ. Bảo vệ thật phải nằm ở server: nay
   nút đăng nhập gọi POST /api/auth/login, nhận token JWT và gửi kèm mọi
   lệnh gọi /api/admin/*. Backend tự chặn token thiếu hoặc sai vai trò —
   nên dù sửa được mã nguồn trình duyệt thì cũng không mở nổi khu quản trị. */

import { useState } from 'react';
import { useApp } from './store';
import { Icon } from './components/Icon';
import type { AuthUser } from './types';

export function LoginPage() {
  const { dispatch } = useApp();
  const [username, setUsername] = useState('0900000000');
  const [password, setPassword] = useState('Admin@2024');
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
      /* Chỉ nhận vai trò quản trị. Backend cũng chặn rồi, nhưng kiểm tra ở
         đây giúp thông báo rõ ràng thay vì một màn trắng rồi mới lỗi. */
      if (user.role !== 'ADMIN') {
        setError('Tài khoản này không có quyền quản trị.');
        return;
      }

      localStorage.setItem('nailhouse_admin_token', token);
      /* Dọn key chung cũ — xem Admin-web LoginPage: hai web từng chung key. */
      localStorage.removeItem('nailhouse_token');
      dispatch({
        type: 'login',
        user: { id: user.userId, name: user.name, email: user.email, role: 'admin' } as AuthUser,
      });
    } catch {
      setError('Không kết nối được tới máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-admin">
      <section className="login-admin-card">
        <div className="login-admin-brand">
          <span className="brand-mark"><Icon name="flower" /></span>
          <span>Nail<span className="rose">House</span><small>BEAUTY NAILS · BETTER YOU</small></span>
        </div>

        <p className="login-admin-role">KHU VỰC QUẢN TRỊ</p>
        <h1>Đăng nhập quản trị</h1>
        <p className="login-admin-sub">Toàn bộ công cụ vận hành cửa hàng trong một nơi.</p>

        <form onSubmit={submit} className="login-admin-form">
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

          {error && <p className="login-admin-error" role="alert">{error}</p>}

          <button type="submit" className="button login-admin-submit" disabled={busy}>
            {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="login-admin-demo">
          Tài khoản demo: <code>0900000000</code> / <code>Admin@2024</code>
        </p>
        <a className="login-admin-staff" href="/staff/">Bạn là nhân viên? Vào không gian làm việc ↗</a>
      </section>
    </div>
  );
}