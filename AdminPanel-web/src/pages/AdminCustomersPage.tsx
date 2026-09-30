import { useState } from 'react';
import { formatVND } from '../lib/utils';
import { Icon } from '../components/Icon';

const MOCK_CUSTOMERS = [
  { id: 1, name: 'Sarah Johnson', initials: 'SJ', avatarBg: '#FDF2F8', avatarColor: '#EC4899', phone: '+1 (555) 214-7788', bookings: 18, noShows: 0, spent: 8420000 },
  { id: 2, name: 'Chloe Martin', initials: 'CM', avatarBg: '#DCFCE7', avatarColor: '#16A34A', phone: '+1 (555) 381-0921', bookings: 9, noShows: 3, spent: 4150000 },
  { id: 3, name: 'Ava Thompson', initials: 'AT', avatarBg: '#FEF3C7', avatarColor: '#D97706', phone: '+1 (555) 902-4410', bookings: 4, noShows: 1, spent: 1500000 },
  { id: 4, name: 'Isabella Lee', initials: 'IL', avatarBg: '#F1F5F9', avatarColor: '#475569', phone: '+1 (555) 663-1290', bookings: 22, noShows: 0, spent: 16900000 },
  { id: 5, name: 'Grace Kim', initials: 'GK', avatarBg: '#FDF2F8', avatarColor: '#EC4899', phone: '+1 (555) 470-3355', bookings: 7, noShows: 2, spent: 2980000 },
];

export function AdminCustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const customers = MOCK_CUSTOMERS.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div style={{ paddingTop: '8px', paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 600, color: '#0F172A' }}>
          Khách hàng
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
          Theo dõi lịch sử, độ thân thiết và tỷ lệ vắng mặt của khách hàng.
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)', overflow: 'hidden'
      }}>
        
        {/* Toolbar */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '16px' }}>
              ⌕
            </span>
            <input 
              type="text"
              placeholder="Tìm theo tên hoặc số điện thoại..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '10px 16px 10px 42px', borderRadius: '24px', 
                border: '1px solid #E2E8F0', outline: 'none', color: '#0F172A', fontSize: '14px',
                background: '#F8FAFC', boxSizing: 'border-box'
              }} 
            />
          </div>
          <button style={{ 
            background: '#EC4899', color: '#FFFFFF', padding: '10px 24px', 
            borderRadius: '24px', border: 'none', fontWeight: 600, display: 'flex', 
            alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px',
            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.3)'
          }}>
            + Thêm Khách Hàng
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9', borderTop: '1px solid #F1F5F9' }}>
                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Khách hàng</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Số điện thoại</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Tổng lịch hẹn</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Vắng mặt</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Tổng chi tiêu</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
                    Không tìm thấy thông tin khách hàng.
                  </td>
                </tr>
              ) : (
                customers.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < customers.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', 
                          background: c.avatarBg, color: c.avatarColor, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          fontWeight: 700, fontSize: '14px' 
                        }}>
                          {c.initials}
                        </div>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>
                          {c.name}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#64748B', fontSize: '14px' }}>
                      {c.phone}
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>
                      {c.bookings}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ 
                        background: c.noShows > 0 ? '#FCE7F3' : '#F1F5F9',
                        color: c.noShows > 0 ? '#E11D48' : '#64748B',
                        padding: '4px 12px', borderRadius: '24px', fontSize: '12px', fontWeight: 600
                      }}>
                        {c.noShows}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>
                      {formatVND(c.spent)}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button 
                        onClick={() => alert(`Đang xem lịch sử của ${c.name}`)}
                        style={{ 
                          padding: '8px 16px', borderRadius: '24px', border: '1px solid #E2E8F0', 
                          background: '#FFFFFF', color: '#334155', fontWeight: 600, fontSize: '13px',
                          display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                        }}
                      >
                        <span style={{ display: 'flex', transform: 'scale(0.8)' }}>
                          <Icon name="clock" />
                        </span>
                        Xem lịch sử
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
