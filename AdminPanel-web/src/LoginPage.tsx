/* ===== Đăng nhập khu vực quản trị =====
   Cùng bảng màu và thang chữ với màn đăng nhập nhân viên, chỉ khác ở nhãn
   "KHU VỰC QUẢN TRỊ". Tài khoản nhân viên nằm ở app riêng
   (Admin-web, cổng 5173) — hai bên không dùng chung khoá đăng nhập. */

import { useState } from 'react';
import { useApp } from './store';
import { Icon } from './components/Icon';
import type { AuthUser } from './types';

const DEMO = { username: 'admin', password: 'admin123' };

export function LoginPage() {
  const { dispatch } = useApp();
  const [username, setUsername] = useState(DEMO.username);
  const [password, setPassword] = useState(DEMO.password);
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }
    if (username.trim() !== DEMO.username || password.trim() !== DEMO.password) {
      setError('Tài khoản hoặc mật khẩu quản trị không đúng.');
      return;
    }
    const user: AuthUser = {
      id: 'admin-1',
      name: 'Quản lý NailHouse',
      email: 'admin@nailhouse.vn',
      role: 'admin',
    };
    setError('');
    dispatch({ type: 'login', user });
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
              placeholder="Nhập tài khoản"
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

          <button type="submit" className="button login-admin-submit">Đăng nhập</button>
        </form>

        <p className="login-admin-demo">
          Tài khoản demo: <code>admin</code> / <code>admin123</code>
        </p>
        <a className="login-admin-staff" href="/staff/">Bạn là nhân viên? Vào không gian làm việc ↗</a>
      </section>
    </div>
  );
}