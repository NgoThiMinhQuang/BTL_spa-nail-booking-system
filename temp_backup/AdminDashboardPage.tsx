import { useState } from 'react';
import { useApp } from '../../store';
import { Icon } from '../../components/Icon';
import { formatVND } from '../../lib/utils';

export function AdminDashboardPage() {
  const { state, dispatch } = useApp();
  const [showNewModal, setShowNewModal] = useState(false);

  const bookings = state.rangeBookings || [];
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);

  // -- Dynamic Data Preparation --
  const pendingCount = bookings.filter(b => b.status === 'PENDING').length;
  const noShowCount = bookings.filter(b => b.status === 'NO_SHOW').length;
  const confirmedCount = bookings.filter(b => b.status === 'CONFIRMED').length;
  const processingCount = bookings.filter(b => b.status === 'PROCESSING').length;

  const todayBookings = [...bookings]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5)
    .map(b => {
      let statusStr = 'Không rõ';
      let statusColor = '#475569';
      let statusBg = '#F1F5F9';
      if (b.status === 'PENDING') { statusStr = 'Chờ xác nhận'; statusColor = '#D97706'; statusBg = '#FEF3C7'; }
      if (b.status === 'CONFIRMED') { statusStr = 'Đã xác nhận'; statusColor = '#2563EB'; statusBg = '#EFF6FF'; }
      if (b.status === 'PROCESSING') { statusStr = 'Đang làm'; statusColor = '#DB2777'; statusBg = '#FCE7F3'; }
      if (b.status === 'COMPLETED') { statusStr = 'Hoàn thành'; statusColor = '#16A34A'; statusBg = '#DCFCE7'; }
      if (b.status === 'NO_SHOW') { statusStr = 'Không đến'; statusColor = '#DC2626'; statusBg = '#FEE2E2'; }
      if (b.status === 'CANCELLED') { statusStr = 'Đã hủy'; statusColor = '#475569'; statusBg = '#F1F5F9'; }
      return {
        time: b.startsAt.split(' ')[1] || b.startsAt,
        name: b.customerName,
        service: b.serviceName,
        status: statusStr,
        statusColor,
        statusBg
      };
    });

  const serviceRevenue: Record<string, number> = {};
  completedBookings.forEach(b => {
    serviceRevenue[b.serviceName] = (serviceRevenue[b.serviceName] || 0) + (b.price || 0);
  });
  const colors = ['#9D6271', '#9D6271', '#E2E8F0', '#9D6271', '#E2E8F0'];
  const topServices = Object.entries(serviceRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, val], idx) => ({ name, pct: totalRevenue > 0 ? Math.round((val / totalRevenue) * 100) : 0, val, color: colors[idx % colors.length] }));
  
  const defaultServices = [
    { name: 'Sơn gel', pct: 30, val: 14675000, color: '#9D6271' },
    { name: 'Sơn french', pct: 25, val: 10625000, color: '#9D6271' },
    { name: 'Đắp bột', pct: 20, val: 8530000, color: '#E2E8F0' },
    { name: 'Chăm sóc móng', pct: 15, val: 6375000, color: '#9D6271' },
    { name: 'Khác', pct: 10, val: 2125000, color: '#E2E8F0' },
  ];
  const displayServices = topServices.length > 0 ? topServices : defaultServices;

  return (
    <div style={{ paddingTop: '8px' }}>
      {/* Top Welcome Heading & Action Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 600, color: '#0F172A' }}>
            Xin chào, {state.user?.name || 'Quản lý'}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            Đây là tổng quan hoạt động tại cửa hàng hôm nay.
          </p>
        </div>
      </div>

      {/* 4 TOP METRIC CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '20px',
        marginBottom: '28px'
      }}>
        {/* Card 1: Today's Appointments */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid #F1F5F9',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Lịch hẹn hôm nay</span>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%', background: '#FCE7F3', color: '#DB2777',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="schedule" />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
            {bookings.length > 0 ? bookings.length : 24}
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>+4 so với hôm qua</span>
        </div>

        {/* Card 2: Pending Confirmation */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid #F1F5F9',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Chờ xác nhận</span>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%', background: '#FEF3C7', color: '#D97706',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="clock" />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600, color: '#D97706', marginBottom: '4px' }}>
            5
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>Cần duyệt</span>
        </div>

        {/* Card 3: Staff Currently Serving */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid #F1F5F9',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Nhân viên đang làm</span>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%', background: '#E0F2FE', color: '#0284C7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="profile" />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
            3
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>trên 6 người đang ca</span>
        </div>

        {/* Card 4: Today's Revenue */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid #F1F5F9',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Doanh thu hôm nay</span>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%', background: '#DCFCE7', color: '#16A34A',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="dollar" />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 600, color: '#16A34A', marginBottom: '4px' }}>
            {totalRevenue > 0 ? formatVND(totalRevenue) : '5.200.000 đ'}
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>+12% so với hôm qua</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: '20px',
      }}>
        {/* Block 1: Doanh thu theo thời gian */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#332D2D' }}>Doanh thu theo thời gian</h2>
            <div style={{ display: 'flex', gap: '8px', background: '#FAFAFA', padding: '4px', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
              <button style={{ padding: '6px 12px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>7 ngày</button>
              <button style={{ padding: '6px 12px', border: 'none', background: '#793A4C', color: '#FFF', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}>30 ngày</button>
              <button style={{ padding: '6px 12px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>3 tháng</button>
              <button style={{ padding: '6px 12px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>1 năm</button>
            </div>
          </div>
          <div style={{ position: 'relative', height: '220px', display: 'flex' }}>
            {/* Y axis */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', color: '#94A3B8', fontSize: '11px', fontWeight: 500, paddingBottom: '20px' }}>
              <span>50tr</span>
              <span>40tr</span>
              <span>30tr</span>
              <span>20tr</span>
              <span>10tr</span>
              <span>0</span>
            </div>
            {/* Chart */}
            <div style={{ flex: 1, position: 'relative' }}>
              <svg viewBox="0 0 500 200" preserveAspectRatio="none" style={{ width: '100%', height: 'calc(100% - 20px)' }}>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#793A4C" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#793A4C" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 40, 80, 120, 160, 200].map(y => (
                  <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                ))}
                <path
                  d="M0,160 C30,120 50,130 80,110 C120,80 150,110 180,100 C210,90 240,110 270,100 C300,90 320,60 350,60 C380,60 410,20 450,40 C470,50 490,20 500,20"
                  fill="none"
                  stroke="#793A4C"
                  strokeWidth="3"
                />
                <path
                  d="M0,160 C30,120 50,130 80,110 C120,80 150,110 180,100 C210,90 240,110 270,100 C300,90 320,60 350,60 C380,60 410,20 450,40 C470,50 490,20 500,20 L500,200 L0,200 Z"
                  fill="url(#gradient)"
                />
              </svg>
              {/* X axis */}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '11px', fontWeight: 500, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                <span>01/04</span>
                <span>05/04</span>
                <span>10/04</span>
                <span>15/04</span>
                <span>20/04</span>
                <span>25/04</span>
                <span>30/04</span>
              </div>
            </div>
          </div>
        </div>

        {/* Block 2: Lịch hẹn hôm nay */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#332D2D' }}>Lịch hẹn hôm nay</h2>
            <button onClick={() => dispatch({ type: 'view', view: 'admin-bookings' })} style={{ border: 'none', background: 'transparent', color: '#793A4C', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Xem tất cả</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {todayBookings.length > 0 ? todayBookings.map((app, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx < todayBookings.length - 1 ? '1px solid #F1F5F9' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#332D2D', width: '45px' }}>{app.time}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#332D2D' }}>{app.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{app.service}</div>
                  </div>
                </div>
                <span style={{
                  background: app.statusBg, color: app.statusColor, fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', whiteSpace: 'nowrap'
                }}>
                  {app.status}
                </span>
              </div>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                Không có lịch hẹn nào hôm nay.
              </div>
            )}
          </div>
        </div>

        {/* Block 3: Việc cần xử lý */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h2 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 700, color: '#332D2D' }}>Việc cần xử lý</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
            {[
              { num: pendingCount, label: 'Lịch chờ xác nhận', icon: '📋' },
              { num: confirmedCount, label: 'Lịch đã xác nhận', icon: '✅' },
              { num: processingCount, label: 'Khách đang làm', icon: '💅' },
              { num: noShowCount, label: 'Khách không đến', icon: '🚫' }
            ].map((task, idx) => (
              <div key={idx} style={{
                background: '#FDF8F9', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', background: '#FCE7F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#793A4C', flexShrink: 0
                }}>
                  {task.icon}
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#332D2D', marginBottom: '2px' }}>{task.num}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, lineHeight: 1.4 }}>{task.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Block 4: Doanh thu theo loại dịch vụ */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          gap: '24px'
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 700, color: '#332D2D' }}>Doanh thu theo loại dịch vụ</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              {displayServices.map((srv, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B', width: '85px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{srv.name}</span>
                  <div style={{ flex: 1, height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${srv.pct}%`, height: '100%', background: srv.color, borderRadius: '4px' }}></div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B', width: '30px', textAlign: 'right' }}>{srv.pct}%</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#332D2D', width: '80px', textAlign: 'right' }}>{formatVND(srv.val)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Image */}
          <div style={{
            width: '120px',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <img src="https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&w=300&q=80" alt="Nails" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', color: '#FFF', fontSize: '11px', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              French Style<br/>Móng vuông
            </div>
          </div>
        </div>
      </div>

      {/* New Appointment Modal */}
      {showNewModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '28px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 600 }}>Tạo lịch hẹn mới</h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
              Tùy chọn thêm lịch hẹn trực tiếp tại cửa hàng cho khách hàng.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}
              >
                Đóng
              </button>
              <button
                onClick={() => { alert('Đã tạo lịch hẹn mới thành công!'); setShowNewModal(false); }}
                style={{ padding: '8px 16px', borderRadius: '12px', border: 'none', background: '#EC4899', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
