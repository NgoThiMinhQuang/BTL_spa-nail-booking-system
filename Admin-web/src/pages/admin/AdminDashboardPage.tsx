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

  // Mock revenue data for 7-day chart matching attached design
  const chartData = [
    { day: 'T2', amount: 350, height: 45 },
    { day: 'T3', amount: 320, height: 40 },
    { day: 'T4', amount: 550, height: 68 },
    { day: 'T5', amount: 480, height: 60 },
    { day: 'T6', amount: 720, height: 85 },
    { day: 'T7', amount: 880, height: 95 },
    { day: 'CN', amount: 620, height: 75, active: true },
  ];

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

      {/* MIDDLE SECTION: 2 COLUMNS (Revenue Overview & Upcoming Appointments) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Column: Revenue Overview (Bar Chart) */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '28px',
          border: '1px solid #F1F5F9',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 600, color: '#0F172A' }}>
                Tổng quan Doanh thu
              </h2>
              <span style={{ fontSize: '13px', color: '#94A3B8' }}>7 ngày gần đây</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A' }}>18.450.000 đ</div>
              <div style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>+8.4% so với tuần trước</div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 20px 20px 40px', position: 'relative' }}>
            {/* Horizontal Grid lines */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '0px', borderBottom: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', position: 'absolute', left: 0 }}>$0</span>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '50px', borderBottom: '1px dashed #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', position: 'absolute', left: 0, bottom: '-8px' }}>$250</span>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100px', borderBottom: '1px dashed #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', position: 'absolute', left: 0, bottom: '-8px' }}>$500</span>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '150px', borderBottom: '1px dashed #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', position: 'absolute', left: 0, bottom: '-8px' }}>$750</span>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '200px', borderBottom: '1px dashed #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', position: 'absolute', left: 0, bottom: '-8px' }}>$1000</span>
            </div>

            {/* Bars */}
            {chartData.map((item) => (
              <div key={item.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '10px' }}>
                <div style={{
                  width: '28px',
                  height: `${item.height * 1.8}px`,
                  background: item.active ? '#E63980' : '#F9A8D4',
                  borderRadius: '14px',
                  transition: 'all 0.3s'
                }} />
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Upcoming Appointments */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '28px',
          border: '1px solid #F1F5F9',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0F172A' }}>
              Lịch hẹn sắp tới
            </h2>
            <button
              onClick={() => dispatch({ type: 'view', view: 'admin-bookings' })}
              style={{ background: 'none', border: 'none', color: '#EC4899', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Xem tất cả
            </button>
          </div>

          {/* Appointment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Item 1 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '1px solid #F1F5F9',
              background: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  textAlign: 'center'
                }}>
                  09:00<br /><small style={{ fontSize: '10px', color: '#94A3B8' }}>Sáng</small>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>Nguyễn Phương Thảo</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Sơn Gel Móng · KTV Linh</div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#FCE7F3', color: '#EC4899', padding: '4px 10px', borderRadius: '12px' }}>
                Đang làm
              </span>
            </div>

            {/* Item 2 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '1px solid #F1F5F9',
              background: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  textAlign: 'center'
                }}>
                  10:30<br /><small style={{ fontSize: '10px', color: '#94A3B8' }}>Sáng</small>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>Trần Thu Trang</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Đắp Gel Trọn Bộ · KTV Mai</div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '4px 10px', borderRadius: '12px' }}>
                Đã xác nhận
              </span>
            </div>

            {/* Item 3 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '1px solid #F1F5F9',
              background: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  textAlign: 'center'
                }}>
                  11:15<br /><small style={{ fontSize: '10px', color: '#94A3B8' }}>Sáng</small>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>Lê Ngọc Anh</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Spa Pedicure Chăm Sóc Chân · KTV Anna</div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '12px' }}>
                Chờ xác nhận
              </span>
            </div>

            {/* Item 4 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '1px solid #F1F5F9',
              background: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  textAlign: 'center'
                }}>
                  01:00<br /><small style={{ fontSize: '10px', color: '#94A3B8' }}>Chiều</small>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>Phạm Quỳnh Chi</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Vẽ Móng Nghệ Thuật · KTV Linh</div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '4px 10px', borderRadius: '12px' }}>
                Đã xác nhận
              </span>
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
