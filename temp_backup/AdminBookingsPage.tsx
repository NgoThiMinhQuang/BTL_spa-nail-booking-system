import { useState } from 'react';
import { Icon } from '../../components/Icon';

type Status = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface MockBooking {
  id: string;
  customer: string;
  phone?: string;
  service: string;
  startH: number;
  startM: number;
  duration: number;
  status: Status;
  note?: string;
}

interface Staff {
  id: number;
  name: string;
  role: string;
  avatar: string;
  bookings: MockBooking[];
}

const INITIAL_STAFF_DATA: Staff[] = [
  {
    id: 1,
    name: 'Nguyễn Thị Lan',
    role: 'Chuyên gia móng',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    bookings: [
      { id: 'b1', customer: 'Nguyễn Mai', phone: '0905 123 456', service: 'Sơn gel', startH: 8, startM: 0, duration: 60, status: 'CONFIRMED' },
      { id: 'b2', customer: 'Ngọc Anh', phone: '0912 345 678', service: 'Chăm sóc móng', startH: 14, startM: 0, duration: 90, status: 'CANCELLED' },
    ]
  },
  {
    id: 2,
    name: 'Trần Thị Mai',
    role: 'KTV làm móng',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    bookings: [
      { id: 'b3', customer: 'Trần Thị Mai', phone: '0988 777 666', service: 'Đắp bột', startH: 8, startM: 30, duration: 120, status: 'CANCELLED' },
      { id: 'b4', customer: 'Hoàng Yến Dư', phone: '0935 888 999', service: 'Sơn gel', startH: 15, startM: 0, duration: 60, status: 'PROCESSING' },
    ]
  },
  {
    id: 3,
    name: 'Lê Phương Anh',
    role: 'Chuyên gia móng',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
    bookings: [
      { id: 'b5', customer: 'Lê Thị Hương', phone: '0977 111 222', service: 'Sơn gel', startH: 9, startM: 30, duration: 120, status: 'PROCESSING' },
      { id: 'b6', customer: 'Hoàng Yến Dư', phone: '0935 888 999', service: 'Sơn gel', startH: 13, startM: 0, duration: 120, status: 'COMPLETED' },
    ]
  },
  {
    id: 4,
    name: 'Hoàng Yến Dư',
    role: 'KTV vẽ móng',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
    bookings: [
      { id: 'b7', customer: 'Phạm Thị Lan', phone: '0903 222 333', service: 'Vẽ móng', startH: 11, startM: 0, duration: 60, status: 'PENDING' },
      { id: 'b8', customer: 'Lê Văn C', phone: '0914 555 444', service: 'Sơn french', startH: 16, startM: 0, duration: 60, status: 'CANCELLED' },
    ]
  }
];

const STATUS_CONFIG: Record<Status, { bg: string; stripe: string; text: string; label: string }> = {
  PENDING: { bg: '#FFF7ED', stripe: '#EA580C', text: '#EA580C', label: 'Chờ xác nhận' },
  CONFIRMED: { bg: '#EFF6FF', stripe: '#2563EB', text: '#2563EB', label: 'Đã xác nhận' },
  PROCESSING: { bg: '#FDF2F8', stripe: '#DB2777', text: '#DB2777', label: 'Đang thực hiện' },
  COMPLETED: { bg: '#F0FDF4', stripe: '#16A34A', text: '#16A34A', label: 'Hoàn thành' },
  CANCELLED: { bg: '#FEF2F2', stripe: '#DC2626', text: '#DC2626', label: 'Đã hủy' },
  NO_SHOW: { bg: '#F3F4F6', stripe: '#4B5563', text: '#4B5563', label: 'Không đến' },
};

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function formatTime(h: number, m: number) {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function calculateEndTime(h: number, m: number, dur: number) {
  const totalMins = h * 60 + m + dur;
  const endH = Math.floor(totalMins / 60);
  const endM = totalMins % 60;
  return formatTime(endH, endM);
}

export function AdminBookingsPage() {
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF_DATA);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'list'>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState('2025-04-28');
  
  // Modals & Detail page state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeDetailBooking, setActiveDetailBooking] = useState<{
    id: string;
    customer: string;
    phone: string;
    email: string;
    avatar: string;
    service: string;
    serviceImage: string;
    duration: number;
    price: string;
    deposit: string;
    depositStatus: string;
    staffName: string;
    staffCode: string;
    staffAvatar: string;
    date: string;
    timeSlot: string;
    status: Status;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper: Update booking status
  const updateBookingStatus = (bookingId: string, newStatus: Status) => {
    setStaffList(prev => prev.map(staff => ({
      ...staff,
      bookings: staff.bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
    })));
  };

  // Helper: Confirm all Pending bookings
  const handleConfirmAllPending = () => {
    let count = 0;
    setStaffList(prev => prev.map(staff => ({
      ...staff,
      bookings: staff.bookings.map(b => {
        if (b.status === 'PENDING') {
          count++;
          return { ...b, status: 'CONFIRMED' as Status };
        }
        return b;
      })
    })));
    showToast(`Đã xác nhận thành công ${count} lịch hẹn chờ duyệt!`);
    setShowConfirmModal(false);
  };

  // Calculate live dynamic statistics
  const allBookings = staffList.flatMap(s => s.bookings);
  const totalCount = 24; // Simulated daily total or total count
  const completedCount = allBookings.filter(b => b.status === 'COMPLETED').length + 15;
  const pendingBookingsWithStaff = staffList.flatMap(s => s.bookings.filter(b => b.status === 'PENDING').map(b => ({ booking: b, staffName: s.name, avatar: s.avatar })));
  const pendingCount = pendingBookingsWithStaff.length + 4;
  const cancelledCount = allBookings.filter(b => b.status === 'CANCELLED').length;
  const noShowCount = allBookings.filter(b => b.status === 'NO_SHOW').length + 1;

  // Filter staff list
  const filteredStaff = staffList.filter(s => selectedStaffFilter === 'ALL' || s.name === selectedStaffFilter);

  // If viewing detail page
  if (activeDetailBooking) {
    return (
      <AdminBookingDetailPage
        booking={activeDetailBooking}
        onBack={() => setActiveDetailBooking(null)}
        onUpdateStatus={(newStatus) => {
          updateBookingStatus(activeDetailBooking.id, newStatus);
          setActiveDetailBooking(prev => prev ? { ...prev, status: newStatus } : null);
        }}
        onShowToast={showToast}
      />
    );
  }

  return (
    <div style={{ fontFamily: '"Inter", system-ui, -apple-system, sans-serif', color: '#1E293B', paddingBottom: '40px' }}>
      
      {/* Toast notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#7D383E',
          color: '#FFFFFF',
          padding: '12px 24px',
          borderRadius: '12px',
          fontWeight: 600,
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✨</span> {toastMessage}
        </div>
      )}

      {/* TOP CONTROL BAR (HEADER FILTERS & VIEW MODE) */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left Filter Controls Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          
          {/* Search Box Pill */}
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '320px' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm khách hàng, mã lịch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                borderRadius: '24px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: '13px',
                color: '#334155',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            />
          </div>

          {/* Date Picker Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '24px',
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#334155',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <Icon name="calendar" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
            />
          </div>

          {/* Staff Filter Dropdown Pill */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '24px',
                padding: '9px 34px 9px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <option value="ALL">👤 Tất cả nhân viên</option>
              {staffList.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: '#64748B' }}>
              ▼
            </span>
          </div>

          {/* Status Filter Dropdown Pill */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '24px',
                padding: '9px 34px 9px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#334155',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <option value="ALL">📋 Tất cả trạng thái</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="PENDING">Chờ xác nhận</option>
              <option value="PROCESSING">Đang thực hiện</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="NO_SHOW">Không đến</option>
            </select>
            <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: '#64748B' }}>
              ▼
            </span>
          </div>
        </div>

        {/* Right View Switch Tabs (Ngày / Tuần / Danh sách) */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '3px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          gap: '2px'
        }}>
          {(['day', 'week', 'list'] as const).map((mode) => {
            const labels = { day: 'Ngày', week: 'Tuần', list: 'Danh sách' };
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  background: isActive ? '#7D383E' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#64748B',
                  border: 'none',
                  padding: '6px 18px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: CALENDAR GRID + LEGEND */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Calendar Grid Container Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EFECE6',
            overflowY: 'auto',
            overflowX: 'auto',
            maxHeight: '580px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', minWidth: '770px' }}>
              
              {/* Leftmost Time Axis Column */}
              <div style={{
                width: '70px',
                flexShrink: 0,
                borderRight: '1px solid #F1F5F9',
                background: '#FFFFFF',
                zIndex: 20
              }}>
                {/* Blank Header Top Corner (Sticky) */}
                <div style={{
                  height: '64px',
                  borderBottom: '1px solid #F1F5F9',
                  position: 'sticky',
                  top: 0,
                  background: '#FFFFFF',
                  zIndex: 35
                }}></div>
                
                {/* Hours standard labels */}
                <div style={{ position: 'relative', height: '880px' }}>
                  {HOURS.map((hour, idx) => (
                    <div
                      key={hour}
                      style={{
                        position: 'absolute',
                        top: `${idx * 80}px`,
                        right: '12px',
                        transform: 'translateY(-50%)',
                        fontSize: '11px',
                        color: '#94A3B8',
                        fontWeight: 600
                      }}
                    >
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Schedule Grid Columns */}
              <div style={{ flex: 1, display: 'flex', minWidth: '700px' }}>
                {filteredStaff.map((staff, sIdx) => (
                  <div
                    key={staff.id}
                    style={{
                      flex: 1,
                      minWidth: '175px',
                      borderRight: sIdx < filteredStaff.length - 1 ? '1px solid #F1F5F9' : 'none'
                    }}
                  >
                    {/* Staff Header Cell (Sticky Top) */}
                    <div style={{
                      height: '64px',
                      borderBottom: '1px solid #F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '0 12px',
                      background: '#FFFFFF',
                      position: 'sticky',
                      top: 0,
                      zIndex: 30
                    }}>
                      <img
                        src={staff.avatar}
                        alt={staff.name}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #F1F5F9'
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap' }}>
                        {staff.name}
                      </span>
                    </div>

                    {/* Staff Schedule Timeline Body */}
                    <div style={{
                      position: 'relative',
                      height: '880px',
                      backgroundImage: 'linear-gradient(to bottom, #F8FAFC 1px, transparent 1px)',
                      backgroundSize: '100% 80px',
                      backgroundPosition: '0 0'
                    }}>
                      {staff.bookings
                        .filter(b => {
                          const matchesStatus = selectedStatusFilter === 'ALL' || b.status === selectedStatusFilter;
                          const matchesSearch = !searchQuery || 
                            b.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            b.service.toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesStatus && matchesSearch;
                        })
                        .map((b) => {
                          // Height calculation: 80px per hour
                          const topPx = (b.startH - 8) * 80 + (b.startM / 60) * 80;
                          const heightPx = (b.duration / 60) * 80;
                          const cfg = STATUS_CONFIG[b.status];

                          return (
                            <div
                              key={b.id}
                              onClick={() => {
                                setActiveDetailBooking({
                                  id: b.id === 'b1' ? 'DM1258' : b.id.toUpperCase(),
                                  customer: b.customer,
                                  phone: b.phone || '0987 654 321',
                                  email: 'lan.nguyen@gmail.com',
                                  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
                                  service: b.service,
                                  serviceImage: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=200&q=80',
                                  duration: b.duration,
                                  price: '200.000đ',
                                  deposit: '50.000đ',
                                  depositStatus: 'Đã thanh toán',
                                  staffName: staff.name,
                                  staffCode: `NV00${staff.id}`,
                                  staffAvatar: staff.avatar,
                                  date: '30/04/2025 (Thứ 4)',
                                  timeSlot: `${formatTime(b.startH, b.startM)} - ${calculateEndTime(b.startH, b.startM, b.duration)}`,
                                  status: b.status
                                });
                              }}
                              style={{
                                position: 'absolute',
                                top: `${topPx}px`,
                                left: '8px',
                                right: '8px',
                                height: `${heightPx - 4}px`,
                                background: cfg.bg,
                                borderLeft: `4px solid ${cfg.stripe}`,
                                borderRadius: '12px',
                                padding: '8px 10px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                cursor: 'pointer',
                                zIndex: 5,
                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                boxSizing: 'border-box'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {b.customer}
                                </div>
                                <span style={{ fontSize: '10px', opacity: 0.6 }}>📌</span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500, lineHeight: 1.2 }}>
                                {b.service}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                                {formatTime(b.startH, b.startM)} - {calculateEndTime(b.startH, b.startM, b.duration)}
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

          {/* BOTTOM STATUS LEGEND BAR */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #EFECE6',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '20px',
            flexWrap: 'wrap',
            fontSize: '12px',
            fontWeight: 600,
            color: '#475569',
            boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EA580C' }}></span>
              Chờ xác nhận
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563EB' }}></span>
              Đã xác nhận
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#DB2777' }}></span>
              Đang thực hiện
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16A34A' }}></span>
              Hoàn thành
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#DC2626' }}></span>
              Đã hủy
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4B5563' }}></span>
              Không đến
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR STATS & QUICK ACTIONS */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Today's Schedule Stats Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EFECE6',
            padding: '18px 20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Lịch hôm nay
            </h3>

            {/* Total count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Tổng số</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{totalCount}</span>
            </div>

            <div style={{ height: '1px', background: '#F1F5F9', marginBottom: '14px' }}></div>

            {/* Status counts breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16A34A' }}></span>
                  <span>Hoàn thành</span>
                </div>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{completedCount}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EA580C' }}></span>
                  <span>Chờ xác nhận</span>
                </div>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{pendingCount}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#DC2626' }}></span>
                  <span>Đã hủy</span>
                </div>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{cancelledCount}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4B5563' }}></span>
                  <span>Không đến</span>
                </div>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{noShowCount}</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button: Tạo lịch hẹn thủ công */}
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              width: '100%',
              background: '#7D383E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              padding: '14px 20px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(125, 56, 62, 0.3)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#6B2F34';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#7D383E';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>+</span> Tạo lịch hẹn thủ công
          </button>

          {/* Quick Actions Panel */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EFECE6',
            padding: '18px 20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Thao tác nhanh
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Nút 1: Xác nhận lịch -> Mở Cửa sổ duyệt 1-Click */}
              <button
                onClick={() => setShowConfirmModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '12px 14px',
                  background: '#FFF7ED',
                  border: '1px solid #FFEDD5',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#EA580C',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FFEDD5'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#FFF7ED'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px' }}>📋</span>
                  Xác nhận lịch
                </div>
                {pendingBookingsWithStaff.length > 0 && (
                  <span style={{
                    background: '#EA580C',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}>
                    {pendingBookingsWithStaff.length} đơn
                  </span>
                )}
              </button>

              {/* Nút 2: Đổi nhân viên */}
              <button
                onClick={() => showToast('Vui lòng click vào lịch hẹn cụ thể trên lưới để đổi nhân viên')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 14px',
                  background: '#FAFAFA',
                  border: '1px solid #F1F5F9',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#FAFAFA'}
              >
                <span style={{ fontSize: '15px', color: '#7D383E' }}>👤</span>
                Đổi nhân viên
              </button>

              {/* Nút 3: Đổi giờ */}
              <button
                onClick={() => showToast('Vui lòng click vào lịch hẹn cụ thể trên lưới để thay đổi giờ hẹn')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 14px',
                  background: '#FAFAFA',
                  border: '1px solid #F1F5F9',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#FAFAFA'}
              >
                <span style={{ fontSize: '15px', color: '#7D383E' }}>⏰</span>
                Đổi giờ
              </button>

              {/* Nút 4: Hủy lịch */}
              <button
                onClick={() => showToast('Vui lòng chọn lịch hẹn cần hủy')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 14px',
                  background: '#FAFAFA',
                  border: '1px solid #F1F5F9',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#DC2626',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#FAFAFA'}
              >
                <span style={{ fontSize: '15px' }}>🚫</span>
                Hủy lịch
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: TẠO LỊCH HẸN THỦ CÔNG */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '500px',
            padding: '24px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                Tạo lịch hẹn thủ công
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              setShowCreateModal(false);
              showToast('Đã tạo lịch hẹn mới thành công!');
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên khách hàng"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Dịch vụ
                  </label>
                  <select style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}>
                    <option>Sơn Gel Móng</option>
                    <option>Vẽ Móng Nghệ Thuật</option>
                    <option>Đắp Bột Móng</option>
                    <option>Spa Chăm Sóc Chân</option>
                    <option>Ngâm Chân Paraffin</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Nhân viên
                    </label>
                    <select style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}>
                      {staffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Thời gian
                    </label>
                    <input
                      type="time"
                      defaultValue="09:00"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Ghi chú
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ghi chú yêu cầu của khách..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#7D383E',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Xác nhận tạo
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: XÁC NHẬN CÁC LỊCH HẸN CHỜ DUYỆT (1-CLICK CONFIRMATION) */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '560px',
            padding: '24px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                  Duyệt lịch hẹn chờ xác nhận
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                  Danh sách các đơn đặt lịch cần Admin duyệt
                </p>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {pendingBookingsWithStaff.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B', fontSize: '14px' }}>
                🎉 Không có lịch hẹn nào đang chờ xác nhận!
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto', marginBottom: '20px', paddingRight: '4px' }}>
                  {pendingBookingsWithStaff.map(({ booking, staffName, avatar }) => (
                    <div
                      key={booking.id}
                      style={{
                        background: '#FFF7ED',
                        border: '1px solid #FFEDD5',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{booking.customer}</span>
                          <span style={{ fontSize: '11px', color: '#EA580C', background: '#FFEDD5', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                            Chờ duyệt
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                          ✂️ {booking.service} · ⏰ {formatTime(booking.startH, booking.startM)} - {calculateEndTime(booking.startH, booking.startM, booking.duration)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={avatar} alt={staffName} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                          <span>KTV: {staffName}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            updateBookingStatus(booking.id, 'CANCELLED');
                            showToast(`Đã hủy lịch hẹn của ${booking.customer}`);
                          }}
                          style={{
                            background: '#FEF2F2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => {
                            updateBookingStatus(booking.id, 'CONFIRMED');
                            showToast(`Đã xác nhận lịch hẹn của ${booking.customer}!`);
                          }}
                          style={{
                            background: '#2563EB',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                          }}
                        >
                          ✓ Xác nhận ngay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Modal Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    onClick={handleConfirmAllPending}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    ✓ Duyệt tất cả ({pendingBookingsWithStaff.length})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

{/* APPOINTMENT DETAIL PAGE COMPONENT */}
function AdminBookingDetailPage({
  booking,
  onBack,
  onUpdateStatus,
  onShowToast
}: {
  booking: {
    id: string;
    customer: string;
    phone: string;
    email: string;
    avatar: string;
    service: string;
    serviceImage: string;
    duration: number;
    price: string;
    deposit: string;
    depositStatus: string;
    staffName: string;
    staffCode: string;
    staffAvatar: string;
    date: string;
    timeSlot: string;
    status: Status;
  };
  onBack: () => void;
  onUpdateStatus: (newStatus: Status) => void;
  onShowToast: (msg: string) => void;
}) {
  const cfg = STATUS_CONFIG[booking.status];

  return (
    <div style={{ fontFamily: '"Inter", system-ui, -apple-system, sans-serif', color: '#1E293B', paddingBottom: '40px' }}>
      
      {/* Header Bar */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
          Chi tiết lịch hẹn
        </h1>
        <button
          onClick={onBack}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#64748B',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          ← Quay lại danh sách
        </button>
      </div>

      {/* Main Detail Container Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #EFECE6',
        padding: '24px 28px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>

        {/* Top Status & Code Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            background: cfg.bg,
            color: cfg.text,
            padding: '6px 16px',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '13px',
            border: `1px solid ${cfg.stripe}33`
          }}>
            {cfg.label}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
              Mã lịch: <strong style={{ color: '#0F172A' }}>#{booking.id.toUpperCase()}</strong>
            </span>
            <button
              onClick={() => onShowToast('Mở cửa sổ chỉnh sửa thông tin lịch hẹn')}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              Chỉnh sửa
            </button>
          </div>
        </div>

        {/* Top 2 Large Cards Row (Khách hàng & Dịch vụ) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Customer Card */}
          <div style={{
            background: '#FAFAFA',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start'
          }}>
            <img
              src={booking.avatar}
              alt={booking.customer}
              style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFFFFF' }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                {booking.customer}
              </div>
              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📞</span> {booking.phone}
              </div>
              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>✉️</span> {booking.email}
              </div>
              <button
                onClick={() => onShowToast(`Mở hồ sơ khách hàng ${booking.customer}`)}
                style={{
                  marginTop: '10px',
                  alignSelf: 'flex-start',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>👤</span> Xem thông tin khách hàng
              </button>
            </div>
          </div>

          {/* Service Card */}
          <div style={{
            background: '#FAFAFA',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Dịch vụ</span>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{booking.service}</div>
              <div style={{ fontSize: '13px', color: '#475569' }}>Thời gian: {booking.duration} phút</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>Giá: {booking.price}</div>
            </div>

            <img
              src={booking.serviceImage}
              alt={booking.service}
              style={{ width: '80px', height: '80px', borderRadius: '14px', objectFit: 'cover' }}
            />
          </div>

        </div>

        {/* Row 2: 3 Sub Cards (Nhân viên, Thời gian, Tiền cọc) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '20px' }}>
          
          {/* Staff Sub Card */}
          <div style={{
            background: '#FAFAFA',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#7D383E' }}>Nhân viên</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={booking.staffAvatar}
                alt={booking.staffName}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{booking.staffName}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{booking.staffCode}</div>
              </div>
            </div>
          </div>

          {/* Time Sub Card */}
          <div style={{
            background: '#FAFAFA',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Thời gian</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{booking.date}</div>
            <div style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>{booking.timeSlot}</div>
          </div>

          {/* Deposit Sub Card */}
          <div style={{
            background: '#FAFAFA',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Tiền cọc</span>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{booking.deposit}</div>
            <span style={{
              alignSelf: 'flex-start',
              background: '#FCE7F3',
              color: '#DB2777',
              padding: '3px 10px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700
            }}>
              {booking.depositStatus}
            </span>
          </div>

        </div>

        {/* Row 3: Bottom 2 Columns (Lịch sử trạng thái & Thao tác) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', alignItems: 'flex-start' }}>
          
          {/* Left: Status History Timeline */}
          <div style={{
            background: '#FAFAFA',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#7D383E' }}>
              Lịch sử trạng thái
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '8px' }}>
              
              {/* Step 1 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EA580C', marginTop: '4px', flexShrink: 0, boxShadow: '0 0 0 3px #FFEDD5' }}></span>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginRight: '8px' }}>30/04 08:15</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>Khách đặt lịch qua ứng dụng</strong>
                  </div>
                  <span style={{ fontSize: '11px', background: '#FFF7ED', color: '#EA580C', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    Chờ xác nhận
                  </span>
                </div>
              </div>

              {/* Line connector */}
              <div style={{ position: 'absolute', left: '13px', top: '20px', bottom: '20px', width: '2px', background: '#E2E8F0', zIndex: 0 }}></div>

              {/* Step 2 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative', zIndex: 1 }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2563EB', marginTop: '4px', flexShrink: 0, boxShadow: '0 0 0 3px #DBEAFE' }}></span>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginRight: '8px' }}>30/04 08:30</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>Admin xác nhận lịch</strong>
                  </div>
                  <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    Đã xác nhận
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative', zIndex: 1 }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2563EB', marginTop: '4px', flexShrink: 0, boxShadow: '0 0 0 3px #DBEAFE' }}></span>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginRight: '8px' }}>30/04 08:45</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>Phân công nhân viên {booking.staffName}</strong>
                  </div>
                  <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    Đã xác nhận
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Right: Actions Panel */}
          <div style={{
            background: '#FAFAFA',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Thao tác
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => onShowToast('Mở cửa sổ phân công lại nhân viên')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '12px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>👤</span> Đổi nhân viên
              </button>

              <button
                onClick={() => onShowToast('Mở cửa sổ thay đổi thời gian đặt lịch')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '12px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>⏰</span> Đổi thời gian
              </button>

              <button
                onClick={() => {
                  onUpdateStatus('CANCELLED');
                  onShowToast('Đã hủy lịch hẹn này');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '12px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#DC2626',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>🚫</span> Hủy lịch
              </button>

              <button
                onClick={() => onShowToast('Mở cửa sổ cập nhật thông tin thanh toán')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '13px 16px',
                  background: '#7D383E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(125, 56, 62, 0.25)',
                  marginTop: '4px'
                }}
              >
                <span>💳</span> Cập nhật thanh toán
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

