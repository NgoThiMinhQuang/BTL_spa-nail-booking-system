/* ===== Đăng nhập không gian nhân viên =====
   Chỉ nhận tài khoản nhân viên. Tài khoản quản trị nằm ở app riêng
   (AdminPanel-web, cổng 5174) — hai bên không dùng chung khoá đăng nhập. */

import { useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import type { AuthUser } from '../types';

const DEMO = { username: 'staff', password: '123456' };

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
      setError('Tài khoản hoặc mật khẩu không đúng.');
      return;
    }
    const user: AuthUser = {
      id: '2',
      name: 'Mai Anh',
      email: 'maianh@nailhouse.local',
      role: 'staff',
    };
    setError('');
    dispatch({ type: 'login', user });
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

          {error && <p className="login-staff-error" role="alert">{error}</p>}

          <button type="submit" className="button login-staff-submit">Đăng nhập</button>
        </form>

        <p className="login-staff-demo">
          Tài khoản demo: <code>staff</code> / <code>123456</code>
        </p>
        <a className="login-staff-admin" href="/admin/">Quản trị viên? Vào khu vực quản trị ↗</a>
      </section>
    </div>
  );
}
