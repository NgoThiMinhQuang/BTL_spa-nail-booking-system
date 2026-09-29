import { Icon } from '../../components/Icon';

type CellType = 'SHIFT' | 'TIME_OFF' | 'DAY_OFF';

interface ScheduleCell {
  type: CellType;
  shift?: string;
  lunch?: string;
  reason?: string;
}

const SCHEDULE_DATA = [
  {
    staff: { name: 'Emma Wilson', id: 'NV-001', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100&h=100' },
    schedule: [
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'TIME_OFF', reason: 'Nghỉ ốm' },
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'SHIFT', shift: '09:00-14:00' },
      { type: 'DAY_OFF' },
    ] as ScheduleCell[]
  },
  {
    staff: { name: 'Olivia Chen', id: 'NV-002', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100&h=100' },
    schedule: [
      { type: 'SHIFT', shift: '11:00-20:00', lunch: '15:00-16:00' },
      { type: 'SHIFT', shift: '11:00-20:00', lunch: '15:00-16:00' },
      { type: 'DAY_OFF' },
      { type: 'SHIFT', shift: '11:00-20:00', lunch: '15:00-16:00' },
      { type: 'SHIFT', shift: '11:00-20:00', lunch: '15:00-16:00' },
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'SHIFT', shift: '09:00-14:00' },
    ] as ScheduleCell[]
  },
  {
    staff: { name: 'Mia Brooks', id: 'NV-003', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=100&h=100' },
    schedule: [
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'DAY_OFF' },
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'SHIFT', shift: '08:00-17:00', lunch: '12:00-13:00' },
      { type: 'SHIFT', shift: '11:00-20:00', lunch: '15:00-16:00' },
      { type: 'DAY_OFF' },
    ] as ScheduleCell[]
  }
];

const DAYS = [
  { day: 'T2', date: '28' },
  { day: 'T3', date: '29' },
  { day: 'T4', date: '30' },
  { day: 'T5', date: '01' },
  { day: 'T6', date: '02' },
  { day: 'T7', date: '03' },
  { day: 'CN', date: '04' },
];

function CellContent({ cell }: { cell: ScheduleCell }) {
  if (cell.type === 'DAY_OFF') {
    return (
      <div style={{ padding: '8px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontWeight: 500, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Ngày nghỉ
      </div>
    );
  }

  if (cell.type === 'TIME_OFF') {
    return (
      <div style={{
        background: '#FEF2F2', borderLeft: '4px solid #EF4444', borderRadius: '6px',
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px', height: '100%', boxSizing: 'border-box'
      }}>
        <div style={{ color: '#DC2626', fontSize: '13px', fontWeight: 700 }}>Xin nghỉ</div>
        <div style={{ color: '#F87171', fontSize: '12px', fontWeight: 500 }}>{cell.reason}</div>
      </div>
    );
  }

  // SHIFT
  return (
    <div style={{
      background: '#F0FDF4', borderLeft: '4px solid #10B981', borderRadius: '6px',
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', boxSizing: 'border-box'
    }}>
      <div>
        <div style={{ color: '#059669', fontSize: '13px', fontWeight: 700 }}>Ca làm</div>
        <div style={{ color: '#059669', fontSize: '12px', fontWeight: 500 }}>{cell.shift}</div>
      </div>
      {cell.lunch && (
        <div>
          <div style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 600 }}>Nghỉ trưa</div>
          <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 500 }}>{cell.lunch}</div>
        </div>
      )}
    </div>
  );
}

export function AdminWorkSchedulePage() {
  return (
    <div style={{ paddingTop: '8px', paddingBottom: '32px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 600, color: '#0F172A' }}>
          Lịch làm việc
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
          Lên kế hoạch ca làm việc, thời gian nghỉ trưa và ngày nghỉ phép.
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)', overflow: 'hidden'
      }}>
        
        {/* Toolbar */}
        <div style={{ 
          padding: '20px 24px', display: 'flex', justifyContent: 'space-between', 
          borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '16px', alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button style={{ 
              padding: '10px 16px', borderRadius: '24px', border: '1px solid #E2E8F0', 
              background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '16px', 
              color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '14px'
            }}>
              <span style={{ color: '#94A3B8' }}>&lt;</span>
              28 Thg 9 – 4 Thg 10, 2026
              <span style={{ color: '#94A3B8' }}>&gt;</span>
            </button>
            
            <button style={{ 
              padding: '10px 16px', borderRadius: '24px', border: '1px solid #E2E8F0', 
              background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '12px', 
              color: '#334155', fontWeight: 500, cursor: 'pointer', fontSize: '14px'
            }}>
              Tất cả nhân viên <Icon name="chevronDown" />
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></div>
              Ca làm
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#CBD5E1' }}></div>
              Nghỉ trưa
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></div>
              Xin nghỉ
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '1000px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '16px', textAlign: 'left', width: '200px', fontWeight: 600, fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase' }}>
                  Nhân viên
                </th>
                {DAYS.map((d, i) => (
                  <th key={i} style={{ padding: '12px', fontWeight: 600, fontSize: '13px', color: '#334155', borderLeft: '1px solid #F1F5F9' }}>
                    <div style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>{d.day}</div>
                    <div style={{ fontSize: '16px', color: '#0F172A' }}>{d.date}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCHEDULE_DATA.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: idx < SCHEDULE_DATA.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding: '20px 16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={row.staff.avatar} alt={row.staff.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>{row.staff.name}</div>
                        <div style={{ color: '#94A3B8', fontSize: '12px' }}>{row.staff.id}</div>
                      </div>
                    </div>
                  </td>
                  {row.schedule.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '8px', borderLeft: '1px solid #F1F5F9', verticalAlign: 'top', height: '110px' }}>
                      <CellContent cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
