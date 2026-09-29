import { useState } from 'react';
import { formatVND } from '../../lib/utils';
import { Icon } from '../../components/Icon';

const MOCK_SERVICES = [
  { 
    id: 1, name: 'Sơn Gel', category: 'Làm móng tay', price: 150000, duration: 60, 
    requireDeposit: true, status: 'Hoạt động', 
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=100&h=100' 
  },
  { 
    id: 2, name: 'Sơn Móng Cổ Điển', category: 'Làm móng tay', price: 100000, duration: 45, 
    requireDeposit: false, status: 'Hoạt động', 
    image: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=80&w=100&h=100' 
  },
  { 
    id: 3, name: 'Spa Chăm Sóc Chân', category: 'Làm móng chân', price: 200000, duration: 75, 
    requireDeposit: true, status: 'Hoạt động', 
    image: 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&q=80&w=100&h=100' 
  },
  { 
    id: 4, name: 'Đắp Bột Móng', category: 'Đắp móng', price: 350000, duration: 120, 
    requireDeposit: true, status: 'Hoạt động', 
    image: 'https://images.unsplash.com/photo-1595868832863-71a7d6051786?auto=format&fit=crop&q=80&w=100&h=100' 
  },
];

function Toggle({ active, onClick }: { active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      style={{
        width: '40px', height: '24px', borderRadius: '12px',
        background: active ? '#EC4899' : '#E2E8F0',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s ease'
      }}
    >
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', background: '#FFFFFF',
        position: 'absolute', top: '2px', left: active ? '18px' : '2px',
        transition: 'left 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
      }} />
    </div>
  );
}

export function AdminServicesPage() {
  const [services, setServices] = useState(MOCK_SERVICES);

  const toggleDeposit = (id: number) => {
    setServices(services.map(s => s.id === id ? { ...s, requireDeposit: !s.requireDeposit } : s));
  };

  return (
    <div style={{ paddingTop: '8px', paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 600, color: '#0F172A' }}>
          Dịch vụ
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
          Quản lý danh mục dịch vụ, bảng giá và quy định đặt cọc.
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden'
      }}>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '16px' }}>
                ⌕
              </span>
              <input 
                placeholder="Tìm kiếm dịch vụ..." 
                style={{ 
                  width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', 
                  border: '1px solid #E2E8F0', outline: 'none', color: '#0F172A', fontSize: '14px',
                  boxSizing: 'border-box'
                }} 
              />
            </div>
            <button style={{ 
              padding: '10px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', 
              background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', 
              color: '#334155', fontWeight: 500, cursor: 'pointer', fontSize: '14px'
            }}>
              Lọc theo danh mục <Icon name="chevronDown" />
            </button>
          </div>
          <button style={{ 
            background: '#EC4899', color: '#FFFFFF', padding: '10px 20px', 
            borderRadius: '8px', border: 'none', fontWeight: 600, display: 'flex', 
            alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px',
            boxShadow: '0 2px 8px rgba(236,72,153,0.3)' 
          }}>
            + Thêm dịch vụ
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Dịch vụ</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Giá tiền</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Thời lượng</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Yêu cầu đặt cọc</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Trạng thái</th>
                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < services.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <img src={s.image} alt={s.name} style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px', marginBottom: '4px' }}>{s.name}</div>
                        <span style={{ fontSize: '12px', color: '#64748B', background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontWeight: 500 }}>{s.category}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>{formatVND(s.price)}</td>
                  <td style={{ padding: '16px 20px', color: '#64748B', fontSize: '14px' }}>{s.duration} phút</td>
                  <td style={{ padding: '16px 20px' }}>
                    <Toggle active={s.requireDeposit} onClick={() => toggleDeposit(s.id)} />
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '6px', 
                      background: '#DCFCE7', color: '#16A34A', padding: '4px 10px', 
                      borderRadius: '24px', fontSize: '12px', fontWeight: 600 
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A' }}></span>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                      <button style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }} aria-label="Sửa">
                        <Icon name="edit" />
                      </button>
                      <button style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }} aria-label="Xóa">
                        <Icon name="trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
