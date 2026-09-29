import { useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import type { Role, AuthUser } from '../types';

export function LoginPage() {
  const { state, dispatch } = useApp();
  const [roleTab, setRoleTab] = useState<Role>('admin');

  // Form states
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    state.staffList[0] ? String(state.staffList[0].id) : '',
  );
  const [staffPassword, setStaffPassword] = useState('123456');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      if (!adminUsername.trim() || !adminPassword.trim()) {
        setErrorMsg('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu.');
        return;
      }

      if (adminUsername === 'admin' && adminPassword === 'admin123') {
        const user: AuthUser = {
          id: 'admin-1',
          name: 'Chủ Spa (Quản trị viên)',
          role: 'admin',
          email: 'admin@nailhouse.vn',
        };
        dispatch({ type: 'login', user });
      } else {
        setErrorMsg('Tên tài khoản hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!');
      }
    }, 300);
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      const staffId = selectedStaffId || (state.staffList[0] ? String(state.staffList[0].id) : '1');
      const targetStaff = state.staffList.find((s) => String(s.id) === String(staffId));

      if (!targetStaff) {
        setErrorMsg('Vui lòng chọn nhân viên làm việc.');
        return;
      }

      const user: AuthUser = {
        id: String(targetStaff.id),
        name: targetStaff.name,
        role: 'staff',
      };

      dispatch({ type: 'login', user });
    }, 300);
  };

  const fillDemoAdmin = () => {
    setAdminUsername('admin');
    setAdminPassword('admin123');
    setErrorMsg('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#090d16',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px'
    }}>
      {/* Main Container Card */}
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        minHeight: '620px',
        background: '#ffffff',
        borderRadius: '28px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))'
      }}>
        {/* Left Column: Brand Hero Section */}
        <div style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          padding: '48px 40px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Ambient Background Lighting */}
          <div style={{
            position: 'absolute',
            top: '-80px',
            left: '-80px',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(219,39,119,0.25) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-100px',
            right: '-100px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none'
          }} />

          {/* Top Brand Logo */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '8px 16px',
              borderRadius: '30px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              <span style={{ color: '#f472b6', display: 'flex', alignItems: 'center' }}>
                <Icon name="flower" />
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em' }}>
                Nail<span style={{ color: '#f472b6' }}>House</span> Studio
              </span>
            </div>
          </div>

          {/* Hero Middle Content */}
          <div style={{ position: 'relative', zIndex: 1, margin: '40px 0' }}>
            <span style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#a5b4fc',
              marginBottom: '12px'
            }}>
              Hệ thống Quản lý Spa & Nail Cao Cấp
            </span>
            <h2 style={{
              margin: '0 0 16px',
              fontSize: '32px',
              fontWeight: 800,
              lineHeight: 1.25,
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Nâng tầm trải nghiệm chăm sóc móng & quản lý hiệu quả
            </h2>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#94a3b8', maxWidth: '380px' }}>
              Giải pháp toàn diện cho chủ cửa hàng theo dõi doanh thu, phân ca nhân viên và quản lý lịch hẹn khách hàng thông minh.
            </p>

            {/* Feature badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '24px' }}>
              <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                📊 Báo cáo doanh thu
              </span>
              <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                📅 Xếp lịch hẹn tự động
              </span>
              <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                👥 Quản lý thợ chuyên nghiệp
              </span>
            </div>
          </div>

          {/* Bottom Quote Card */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '16px 20px',
            backdropFilter: 'blur(8px)'
          }}>
            <p style={{ margin: '0 0 6px', fontSize: '13px', fontStyle: 'italic', color: '#e2e8f0', lineHeight: 1.5 }}>
              “Những bàn tay tỉ mỉ tạo nên nụ cười hạnh phúc cho từng vị khách ghé thăm.”
            </p>
            <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>— Đội ngũ NailHouse</span>
          </div>
        </div>

        {/* Right Column: Interactive Login Form */}
        <div style={{
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#ffffff'
        }}>
          {/* Header text */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
              Đăng nhập hệ thống
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Chọn vai trò của bạn để truy cập không gian làm việc.
            </p>
          </div>

          {/* Custom Segmented Role Switcher */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <button
              type="button"
              onClick={() => { setRoleTab('admin'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: 'none',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: roleTab === 'admin' ? '#ffffff' : 'transparent',
                color: roleTab === 'admin' ? '#312e81' : '#64748b',
                boxShadow: roleTab === 'admin' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              👑 Quản trị Admin
            </button>
            <button
              type="button"
              onClick={() => { setRoleTab('staff'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: 'none',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: roleTab === 'staff' ? '#ffffff' : 'transparent',
                color: roleTab === 'staff' ? '#db2777' : '#64748b',
                boxShadow: roleTab === 'staff' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              ✂️ Không gian Nhân viên
            </button>
          </div>

          {/* Alert Error */}
          {errorMsg && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              marginBottom: '20px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          {/* ADMIN FORM */}
          {roleTab === 'admin' && (
            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Tên tài khoản Quản trị
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tài khoản (ví dụ: admin)"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Mật khẩu Admin
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Nhập mật khẩu"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              {/* Demo auto-fill helper card */}
              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                padding: '12px 14px',
                borderRadius: '12px',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#475569'
              }}>
                <div>
                  <strong>Tài khoản Demo Admin:</strong> <code>admin</code> / <code>admin123</code>
                </div>
                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Tự điền
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(49, 46, 129, 0.35)',
                  transition: 'transform 0.15s, boxShadow 0.15s'
                }}
              >
                {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào Hệ thống Quản trị →'}
              </button>
            </form>
          )}

          {/* STAFF FORM */}
          {roleTab === 'staff' && (
            <form onSubmit={handleStaffLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Danh sách Thợ / Nhân viên làm việc
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  {state.staffList.length === 0 && <option value="">Đang kết nối dữ liệu nhân viên…</option>}
                  {state.staffList.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} (Mã nhân viên: #{s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mật khẩu / Mã PIN nhận ca
                </label>
                <input
                  type="password"
                  placeholder="Nhập mã PIN"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(219, 39, 119, 0.35)',
                  transition: 'transform 0.15s, boxShadow 0.15s'
                }}
              >
                {isSubmitting ? 'Đang truy cập...' : 'Truy cập Trang làm việc Nhân viên →'}
              </button>
            </form>
          )}

          {/* Footer note */}
          <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: '#94a3b8' }}>
            NailHouse Studio • Hotline hỗ trợ: <span style={{ fontWeight: 600, color: '#475569' }}>1900 6868</span>
          </div>
        </div>
      </div>
    </div>
  );
}
