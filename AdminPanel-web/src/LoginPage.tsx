/* ===== Đăng nhập khu vực quản trị =====
   Chỉ nhận tài khoản quản trị. Tài khoản nhân viên nằm ở app riêng
   (Admin-web, cổng 5173) — hai bên không dùng chung khoá đăng nhập. */

import { useState } from 'react';
import { useApp } from './store';
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

  const field: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    font: 'inherit',
    fontSize: '14px',
    color: '#0f172a',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
      {/* Cột trái: thương hiệu */}
      <div style={{
        flex: 1,
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #312e81 0%, #4c1d95 55%, #6d28d9 100%)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <span style={{
            width: '44px', height: '44px', borderRadius: '12px', background: '#ec4899',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }}>✿</span>
          <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '0.08em' }}>NAIL STUDIO</span>
        </div>
        <h2 style={{ margin: '0 0 10px', fontSize: '32px', fontWeight: 800, lineHeight: 1.3 }}>
          Quản lý cửa hàng<br />toàn diện trong một nơi
        </h2>
        <p style={{ margin: '0 0 26px', fontSize: '15px', lineHeight: 1.7, color: '#c7d2fe', maxWidth: '460px' }}>
          Nhân viên, dịch vụ, lịch hẹn và khách hàng — theo dõi và cập nhật mọi lúc.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['📊 Báo cáo doanh thu', '📅 Xếp lịch hẹn tự động', '👥 Quản lý nhân sự'].map((tag) => (
            <span key={tag} style={{
              fontSize: '12px', background: 'rgba(255,255,255,0.08)', padding: '6px 12px',
              borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
            }}>{tag}</span>
          ))}
        </div>
        <div style={{
          position: 'relative', marginTop: '28px', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px 20px',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: '13px', fontStyle: 'italic', color: '#e2e8f0' }}>
            “Những bàn tay tỉ mỉ tạo nên nụ cười hạnh phúc cho từng vị khách ghé thăm.”
          </p>
          <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>— Đội ngũ NailHouse</span>
        </div>
      </div>

      {/* Cột phải: biểu mẫu */}
      <div style={{
        width: '440px', padding: '48px 40px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', background: '#fff',
      }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
          Đăng nhập quản trị
        </h3>
        <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#64748b' }}>
          Khu vực dành cho quản lý cửa hàng.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Tài khoản</span>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              placeholder="Nhập tài khoản (ví dụ: admin)"
              style={field}
              autoComplete="username"
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Nhập mật khẩu"
              style={field}
              autoComplete="current-password"
            />
          </label>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: '12.5px', color: '#b91c1c' }}>{error}</p>
          )}

          <button
            type="submit"
            style={{
              padding: '13px', font: 'inherit', fontSize: '14px', fontWeight: 700, color: '#fff',
              background: '#db2777', border: 0, borderRadius: '10px', cursor: 'pointer',
            }}
          >
            Đăng nhập
          </button>
        </form>

        <div style={{
          marginTop: '24px', padding: '12px 14px', background: '#f8fafc', border: '1px dashed #cbd5e1',
          borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '12px', color: '#475569',
        }}>
          <span>Tài khoản demo: <code>admin</code> / <code>admin123</code></span>
          <a href="/staff/" style={{ color: '#db2777', textDecoration: 'none' }}>Sang app Nhân viên ↗</a>
        </div>
      </div>
    </div>
  );
}
