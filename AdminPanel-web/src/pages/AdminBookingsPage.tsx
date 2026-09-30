import { useState } from 'react';
import { Icon } from '../components/Icon';

type Status = 'CONFIRMED' | 'PENDING' | 'COMPLETED';

const STAFF_DATA = [
  {
    id: 1,
    name: 'Emma',
    role: 'Chuyên gia làm móng',
    initial: 'E',
    color: '#FCE7F3',
    textColor: '#DB2777',
    bookings: [
      { customer: 'Sarah Johnson', service: 'Sơn Gel Móng', startH: 8, startM: 30, duration: 60, status: 'CONFIRMED' as Status },
      { customer: 'Chloe Martin', service: 'Vẽ Móng Nghệ Thuật', startH: 10, startM: 30, duration: 90, status: 'PENDING' as Status },
      { customer: 'Ava Thompson', service: 'Sơn Móng Cổ Điển', startH: 14, startM: 0, duration: 45, status: 'CONFIRMED' as Status },
    ]
  },
  {
    id: 2,
    name: 'Olivia',
    role: 'KTV làm móng',
    initial: 'O',
    color: '#FEE2E2',
    textColor: '#DC2626',
    bookings: [
      { customer: 'Isabella Lee', service: 'Đắp Bột Móng', startH: 9, startM: 0, duration: 120, status: 'CONFIRMED' as Status },
      { customer: 'Grace Kim', service: 'Sơn Gel Móng', startH: 13, startM: 0, duration: 60, status: 'COMPLETED' as Status },
      { customer: 'Lily Walker', service: 'Ngâm Chân Paraffin', startH: 15, startM: 30, duration: 45, status: 'PENDING' as Status },
    ]
  },
  {
    id: 3,
    name: 'Mia',
    role: 'Chuyên viên Spa Chân',
    initial: 'M',
    color: '#E0E7FF',
    textColor: '#4F46E5',
    bookings: [
      { customer: 'Zoe Harris', service: 'Spa Chăm Sóc Chân', startH: 8, startM: 0, duration: 75, status: 'COMPLETED' as Status },
      { customer: 'Emily Davis', service: 'Spa Chăm Sóc Chân', startH: 11, startM: 0, duration: 75, status: 'CONFIRMED' as Status },
      { customer: 'Hannah White', service: 'Sơn Móng Cổ Điển', startH: 15, startM: 0, duration: 45, status: 'PENDING' as Status },
    ]
  },
  {
    id: 4,
    name: 'Sophia',
    role: 'Thợ làm móng',
    initial: 'S',
    color: '#FFE4E6',
    textColor: '#E11D48',
    bookings: [
      { customer: 'Mila Clark', service: 'Vẽ Móng Nghệ Thuật', startH: 9, startM: 30, duration: 90, status: 'CONFIRMED' as Status },
      { customer: 'Ella Robinson', service: 'Sơn Gel Móng', startH: 12, startM: 30, duration: 60, status: 'CONFIRMED' as Status },
      { customer: 'Nora Lewis', service: 'Đắp Bột Móng', startH: 15, startM: 0, duration: 120, status: 'PENDING' as Status },
    ]
  }
];

const COLORS = {
  CONFIRMED: { bg: '#FDF2F8', border: '#EC4899' },
  PENDING: { bg: '#FFFBEB', border: '#F59E0B' },
  COMPLETED: { bg: '#ECFDF5', border: '#10B981' },
};

const TIMES = [
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM'
];

function formatTime(h: number, m: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function calculateEndTime(h: number, m: number, dur: number) {
  const totalMins = h * 60 + m + dur;
  const endH = Math.floor(totalMins / 60);
  const endM = totalMins % 60;
  return formatTime(endH, endM);
}

export function AdminBookingsPage() {
  const [filterStatus, setFilterStatus] = useState('ALL');

  return (
    <div style={{ paddingTop: '8px', paddingBottom: '32px' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 600, color: '#0F172A' }}>
            Lịch hẹn
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
            12 lịch hẹn trên 4 nhân viên · 29/09/2026
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 16px',
            borderRadius: '24px', fontSize: '14px', fontWeight: 500, color: '#334155',
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
          }}>
            <Icon name="calendar" />
            29/09/2026
          </button>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '10px 16px', borderRadius: '24px', border: '1px solid #E2E8F0',
              fontSize: '14px', fontWeight: 500, color: '#334155', outline: 'none', background: '#FFFFFF', cursor: 'pointer'
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="PENDING">Chờ xác nhận</option>
            <option value="COMPLETED">Hoàn thành</option>
          </select>
          <button
            style={{
              background: '#EC4899', color: '#FFFFFF', border: 'none', padding: '10px 20px',
              borderRadius: '24px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)'
            }}
          >
            + Tạo lịch hẹn mới
          </button>
        </div>
      </div>

      {/* Legend Container */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '16px', borderRadius: '4px', background: COLORS.CONFIRMED.border }}></div>
          Đã xác nhận
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '16px', borderRadius: '4px', background: COLORS.PENDING.border }}></div>
          Chờ xác nhận
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '16px', borderRadius: '4px', background: COLORS.COMPLETED.border }}></div>
          Hoàn thành
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '16px', height: '16px', borderRadius: '4px', border: '1px solid #CBD5E1',
            background: 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(148, 163, 184, 0.2) 3px, rgba(148, 163, 184, 0.2) 6px)'
          }}></div>
          15p Dọn dẹp/Nghỉ
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', minWidth: '900px' }}>
          {/* Times Column */}
          <div style={{ width: '80px', flexShrink: 0, borderRight: '1px solid #F1F5F9', background: '#FFFFFF', zIndex: 20 }}>
            {/* Header placeholder */}
            <div style={{ height: '70px', borderBottom: '1px solid #F1F5F9' }}></div>
            {/* Times */}
            <div style={{ position: 'relative', height: '1200px' }}>
              {TIMES.map((time, i) => (
                <div key={i} style={{
                  position: 'absolute', top: `${i * 60}px`, right: '12px', transform: 'translateY(-50%)',
                  fontSize: '11px', color: '#94A3B8', fontWeight: 500, textAlign: 'right', lineHeight: 1.2,
                  whiteSpace: 'pre-wrap'
                }}>
                  {time.replace(' ', '\n')}
                </div>
              ))}
            </div>
          </div>

          {/* Staff Columns Wrapper */}
          <div style={{ flex: 1, display: 'flex', overflowX: 'auto' }}>
            {STAFF_DATA.map((staff, idx) => (
              <div key={staff.id} style={{
                flex: 1, minWidth: '220px', borderRight: idx < STAFF_DATA.length - 1 ? '1px solid #F1F5F9' : 'none'
              }}>
                {/* Staff Header */}
                <div style={{
                  height: '70px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center',
                  padding: '0 16px', gap: '12px', background: '#FFFFFF', position: 'sticky', top: 0, zIndex: 30
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: staff.color, color: staff.textColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '14px'
                  }}>
                    {staff.initial}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{staff.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{staff.role}</div>
                  </div>
                </div>

                {/* Staff Body (Grid) */}
                <div style={{
                  position: 'relative',
                  height: '1200px',
                  backgroundImage: 'linear-gradient(to bottom, #F1F5F9 1px, transparent 1px)',
                  backgroundSize: '100% 60px',
                  backgroundPosition: '0 0'
                }}>
                  {staff.bookings.filter(b => filterStatus === 'ALL' || b.status === filterStatus).map((b, i) => {
                    const topPx = (b.startH - 8) * 120 + b.startM * 2;
                    const durationPx = b.duration * 2;
                    const colors = COLORS[b.status];
                    
                    return (
                      <div key={i} style={{
                        position: 'absolute',
                        top: `${topPx}px`,
                        left: '12px',
                        right: '12px',
                        height: `${durationPx + 30}px`,
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 10
                      }}>
                        {/* Main Booking Card */}
                        <div style={{
                          flex: 1,
                          background: colors.bg,
                          borderLeft: `4px solid ${colors.border}`,
                          borderRadius: '8px',
                          borderBottomLeftRadius: 0,
                          borderBottomRightRadius: 0,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                            {b.customer}
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                            {b.service}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                            {formatTime(b.startH, b.startM)} - {calculateEndTime(b.startH, b.startM, b.duration)} · {b.duration} mins
                          </div>
                        </div>
                        {/* Buffer Block */}
                        <div style={{
                          height: '30px',
                          backgroundColor: '#F8FAFC',
                          background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(148, 163, 184, 0.15) 4px, rgba(148, 163, 184, 0.15) 8px)',
                          borderLeft: `4px solid #E2E8F0`,
                          borderBottomLeftRadius: '8px',
                          borderBottomRightRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: '#64748B',
                          boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)'
                        }}>
                          15p Dọn dẹp
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
