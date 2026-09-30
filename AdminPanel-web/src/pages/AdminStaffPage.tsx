import { useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';

const MOCK_STAFF = [
  {
    id: 'NV001', name: 'Emma Wilson', role: 'Kỹ Thuật Viên', rating: 4.9, 
    initials: 'EW', color: '#EC4899', gradient: 'linear-gradient(180deg, #FDF2F8 0%, #FFFFFF 100%)',
    tags: ['Gel', 'Acrylic', 'Nail Art'], status: 'Hoạt Động'
  },
  {
    id: 'NV002', name: 'Olivia Chen', role: 'KTV Cao Cấp', rating: 4.8, 
    initials: 'OC', color: '#8B5CF6', gradient: 'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)',
    tags: ['Chrome', 'Bột Nhúng', 'Pedicure'], status: 'Hoạt Động'
  },
  {
    id: 'NV003', name: 'Mia Rodriguez', role: 'Kỹ Thuật Viên', rating: 4.7, 
    initials: 'MR', color: '#3B82F6', gradient: 'linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)',
    tags: ['Sơn Pháp', 'Gel', 'Nail Art'], status: 'Hoạt Động'
  },
  {
    id: 'NV004', name: 'Ava Thompson', role: 'KTV Mới', rating: 4.6, 
    initials: 'AT', color: '#10B981', gradient: 'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 100%)',
    tags: ['Manicure', 'Pedicure'], status: 'Hoạt Động'
  },
  {
    id: 'NV005', name: 'Isabella Lee', role: 'KTV Cao Cấp', rating: 4.9, 
    initials: 'IL', color: '#F59E0B', gradient: 'linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)',
    tags: ['Acrylic', 'Đắp Sculpting', 'Gel'], status: 'Hoạt Động'
  },
  {
    id: 'NV006', name: 'Sophia Park', role: 'Kỹ Thuật Viên', rating: 4.8, 
    initials: 'SP', color: '#E11D48', gradient: 'linear-gradient(180deg, #FFF1F2 0%, #FFFFFF 100%)',
    tags: ['Gel', 'Chrome', 'Nail Art'], status: 'Hoạt Động'
  }
];

export function AdminStaffPage() {
  const { reload } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', phone: '', email: '', specialty: 'Chuyên viên Nail & Spa' });

  const staffList = MOCK_STAFF.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name.trim()) return;
    alert(`Đã thêm nhân viên: ${newStaff.name}`);
    setShowAddModal(false);
    setNewStaff({ name: '', phone: '', email: '', specialty: 'Chuyên viên Nail & Spa' });
    reload();
  };

  return (
    <div style={{ paddingTop: '8px', paddingBottom: '32px' }}>
      
      {/* Header Controls */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '18px' }}>
            ⌕
          </span>
          <input 
            type="text"
            placeholder="Tìm kiếm nhân viên..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '12px 16px 12px 42px', borderRadius: '10px', 
              border: '1px solid #E2E8F0', outline: 'none', color: '#0F172A', fontSize: '14px',
              boxSizing: 'border-box'
            }} 
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          style={{ 
            background: '#EC4899', color: '#FFFFFF', padding: '12px 24px', 
            borderRadius: '10px', border: 'none', fontWeight: 600, display: 'flex', 
            alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px',
            boxShadow: '0 4px 12px rgba(236,72,153,0.3)' 
          }}
        >
          + Thêm Nhân Viên
        </button>
      </div>

      {/* Staff Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {staffList.map((staff, i) => (
          <div key={i} style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #F1F5F9',
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ background: staff.gradient, height: '80px', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: '24px', left: '20px',
                width: '56px', height: '56px', borderRadius: '50%',
                background: staff.color, color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 700,
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}>
                {staff.initials}
              </div>
            </div>
            
            <div style={{ padding: '24px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{staff.name}</h3>
                  <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>{staff.role}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{staff.id}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#FBBF24', fontSize: '16px' }}>★</span> {staff.rating}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px', flex: 1 }}>
                {staff.tags.map((tag, idx) => (
                  <span key={idx} style={{
                    background: '#FDF2F8', color: '#DB2777', padding: '4px 10px', 
                    borderRadius: '6px', fontSize: '11px', fontWeight: 600
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                <span style={{
                  background: '#DCFCE7', color: '#16A34A', padding: '6px 12px', 
                  borderRadius: '24px', fontSize: '12px', fontWeight: 600
                }}>
                  {staff.status}
                </span>
                <button 
                  onClick={() => alert(`Chỉnh sửa ${staff.name}`)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#3B82F6',
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                  aria-label="Sửa"
                >
                  <Icon name="edit" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Staff Modal (Kept from previous version but styled slightly better) */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '32px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>Thêm nhân viên mới</h3>
            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Họ và tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Số điện thoại</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 0912345678"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>Chuyên môn</label>
                <input
                  type="text"
                  value={newStaff.specialty}
                  onChange={(e) => setNewStaff({ ...newStaff, specialty: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#64748B', fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#EC4899', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
                >
                  Lưu nhân viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
