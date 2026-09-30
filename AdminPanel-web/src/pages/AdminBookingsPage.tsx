/* ===== Trang Quản lý lịch hẹn =====

   Trang nghiệp vụ trung tâm: Admin mở ra là phải thấy ngay có lịch nào
   chờ xác nhận, hôm nay có những lịch nào, và bấm được ngay.

   Hai chế độ hiển thị:
     - Danh sách: bảng, hợp với tìm kiếm / lọc / xử lý trạng thái
     - Lịch: lưới theo cột nhân viên và trục giờ, để thấy ai bận ai trống

   Lưu ý: Booking Calendar và Lịch làm việc là hai thứ khác nhau. Bản đồ lịch
   ở đây chỉ vẽ các lịch hẹn đang tồn tại, không thay thế ca làm việc. */

import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatusBadge } from '../components/Primitives';
import {
  CancelDialog, ChangeStaffDialog, ConfirmDialog, NoShowDialog,
  RescheduleDialog, sendBookingRequest,
} from '../components/BookingDialogs';
import { BookingCalendar } from '../components/BookingCalendar';
import { BookingDetail } from '../components/BookingDetail';
import { WalkInDialog } from '../components/WalkInDialog';
import { useApp, type Booking, type BookingScope } from '../store';
import { fmtDate, fmtTime, formatVND } from '../lib/utils';

const SCOPES: { key: BookingScope; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'tomorrow', label: 'Ngày mai' },
  { key: 'week', label: '7 ngày tới' },
  { key: 'all', label: 'Tất cả' },
];

const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'PROCESSING', label: 'Đang làm' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
];

const PAYMENTS = [
  { key: '', label: 'Tất cả thanh toán' },
  { key: 'UNPAID', label: 'Chưa thanh toán' },
  { key: 'DEPOSITED', label: 'Đã đặt cọc' },
  { key: 'PAID', label: 'Đã thanh toán' },
  { key: 'NONE', label: 'Chưa ghi nhận' },
];

const SOURCES = [
  { key: '', label: 'Mọi nguồn' },
  { key: 'MOBILE', label: 'Mobile App' },
  { key: 'WALK_IN', label: 'Khách trực tiếp' },
];

/* Thứ tự ưu tiên nhìn của Admin: việc cần làm trước, xong sau. */
const MENU_BY_STATUS: Record<string, { key: string; label: string; icon: IconName; danger?: boolean }[]> = {
  PENDING: [
    { key: 'confirm', label: 'Xác nhận lịch', icon: 'check' },
    { key: 'staff', label: 'Đổi nhân viên', icon: 'adminStaff' },
    { key: 'reschedule', label: 'Đổi thời gian', icon: 'calendar' },
    { key: 'cancel', label: 'Hủy lịch', icon: 'ban', danger: true },
  ],
  CONFIRMED: [
    { key: 'confirm', label: 'Bắt đầu', icon: 'play' },
    { key: 'staff', label: 'Đổi nhân viên', icon: 'adminStaff' },
    { key: 'reschedule', label: 'Đổi thời gian', icon: 'calendar' },
    { key: 'noshow', label: 'Đánh dấu không đến', icon: 'ban' },
    { key: 'cancel', label: 'Hủy lịch', icon: 'ban', danger: true },
  ],
  /* Dịch vụ đã bắt đầu: chỉ xem và ghi nhận kết quả, không đổi người, đổi
     giờ hay hủy (mục 25). Backend cũng chặn, không chỉ ẩn nút ở đây. */
  PROCESSING: [
    { key: 'confirm', label: 'Hoàn thành', icon: 'done' },
    { key: 'noshow', label: 'Đánh dấu không đến', icon: 'ban' },
  ],
  /* Xong rồi thì chỉ xem (mục 26). */
  COMPLETED: [
    { key: 'payment', label: 'Xem thanh toán', icon: 'card' },
    { key: 'review', label: 'Xem đánh giá', icon: 'star' },
  ],
  CANCELLED: [],
  NO_SHOW: [],
};

const PAGE_SIZE = 20;

export function AdminBookingsPage() {
  const { state, dispatch, reload, setBookingQuery } = useApp();
  const {
    bookings, bookingCounts, bookingQuery, staff, services, shifts, loading,
  } = state;

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: string; booking: Booking } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [flash, setFlash] = useState('');

  /* Đóng menu khi bấm ra ngoài vùng của nó. Phải bỏ qua cú bấm ngay trong vùng
     menu, vì listener ở document chạy sau React nên không bỏ qua thì chính
     cú bấm mở menu sẽ đóng menu lại trước khi kịp hiện. */
  useEffect(() => {
    if (!openMenu) return;
    const close = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.adm-row-actions')) return;
      setOpenMenu(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  const patch = (value: Parameters<typeof setBookingQuery>[0]) => {
    setPage(1);
    setBookingQuery(value);
  };

  /* Nhãn khoảng đang xem, luôn kèm ngày cụ thể — "Hôm nay" mà không có ngày
     thì Admin vẫn phải tự đi tìm lịch là của hôm nào. */
  const scopeDay = bookingQuery.day
    ? fmtDate(bookingQuery.day)
    : SCOPES.find((item) => item.key === bookingQuery.scope)?.label;
  const scopeRange = bookingQuery.scope === 'week' && !bookingQuery.day
    ? `${fmtDate(new Date().toISOString())} – ${fmtDate(new Date(Date.now() + 6 * 86400000).toISOString())}`
    : bookingQuery.scope === 'today' && !bookingQuery.day
      ? fmtDate(new Date().toISOString())
      : null;

  const totalPages = Math.max(1, Math.ceil(bookings.length / PAGE_SIZE));
  const rows = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function runMenu(booking: Booking, key: string) {
    setOpenMenu(null);
    /* Lịch đã xong thì hai mục này chỉ là chuyển sang trang tương ứng. */
    if (key === 'payment') return dispatch({ type: 'view', view: 'admin-payments' });
    if (key === 'review') return dispatch({ type: 'view', view: 'admin-reviews' });
    setDialog({ kind: key, booking });
  }

  /* Xác nhận nhanh ngay trên dòng, không cần mở menu (mục 23). */
  async function quickConfirm(booking: Booking) {
    setFlash('');
    const result = await sendBookingRequest(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    if (result.ok) {
      setFlash(`Đã xác nhận ${booking.code}.`);
      reload();
    } else {
      setFlash(`${booking.code}: ${result.message}`);
    }
  }

  const hasFilter = Boolean(
    bookingQuery.q || bookingQuery.status || bookingQuery.payment || bookingQuery.source
    || bookingQuery.staffId || bookingQuery.serviceId || bookingQuery.day);

  return (
    <>
      {/* Bộ chọn nhanh + chế độ xem */}
      <div className="adm-bk-bar">
        <div className="mode-tabs">
          {SCOPES.map((item) => (
            <button key={item.key}
              className={!bookingQuery.day && bookingQuery.scope === item.key ? 'active' : ''}
              onClick={() => patch({ scope: item.key, day: '' })}>
              {item.label}
            </button>
          ))}
        </div>
        <span className="adm-bk-scope">
          {scopeDay}{scopeRange && <em> · {scopeRange}</em>}
        </span>

        <div className="mode-tabs adm-bk-views">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            <Icon name="services" /> Danh sách
          </button>
          <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>
            <Icon name="calendar" /> Lịch
          </button>
        </div>

        <button className="button adm-primary" onClick={() => setWalkIn(true)}>
          <Icon name="plus" /> Tạo lịch khách trực tiếp
        </button>
      </div>

      {flash && (
        <p className={`adm-flash${flash.startsWith('Đã') ? ' is-ok' : ' is-warn'}`} role="status">
          <Icon name={flash.startsWith('Đã') ? 'check' : 'ban'} /> {flash}
        </p>
      )}

      {/* Tab đếm nhanh theo trạng thái */}
      <div className="adm-bk-tabs">
        {STATUS_TABS.map((tab) => {
          const count = tab.key ? bookingCounts[tab.key] ?? 0 : bookingCounts.ALL ?? 0;
          return (
            <button key={tab.key || 'ALL'}
              className={bookingQuery.status === tab.key ? 'active' : ''}
              onClick={() => patch({ status: tab.key })}>
              {tab.label}<span>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Bộ lọc */}
      <Panel className="adm-bk-filters">
        <div className="adm-bk-filter-grid">
          <label className="adm-field">
            <span>Tìm khách hàng</span>
            <input
              value={bookingQuery.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Tên, số điện thoại hoặc mã lịch…"
            />
          </label>

          <label className="adm-field">
            <span>Dịch vụ</span>
            <select value={bookingQuery.serviceId}
              onChange={(e) => patch({ serviceId: e.target.value })}>
              <option value="">Tất cả dịch vụ</option>
              {services.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label className="adm-field">
            <span>Nhân viên</span>
            <select value={bookingQuery.staffId}
              onChange={(e) => patch({ staffId: e.target.value })}>
              <option value="">Tất cả nhân viên</option>
              {staff.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label className="adm-field">
            <span>Ngày</span>
            <input type="date" value={bookingQuery.day}
              onChange={(e) => patch({ day: e.target.value })} />
          </label>

          <label className="adm-field">
            <span>Trạng thái lịch</span>
            <select value={bookingQuery.status}
              onChange={(e) => patch({ status: e.target.value })}>
              {STATUS_TABS.map((tab) => (
                <option key={tab.key} value={tab.key}>
                  {tab.key === '' ? 'Tất cả' : tab.label}
                </option>
              ))}
            </select>
          </label>

          <label className="adm-field">
            <span>Thanh toán</span>
            <select value={bookingQuery.payment}
              onChange={(e) => patch({ payment: e.target.value })}>
              {PAYMENTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>

          <label className="adm-field">
            <span>Nguồn đặt lịch</span>
            <select value={bookingQuery.source}
              onChange={(e) => patch({ source: e.target.value })}>
              {SOURCES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>

          <button className="button secondary adm-bk-reset" onClick={() => {
            patch({
              q: '', status: '', payment: '', source: '',
              staffId: '', serviceId: '', day: '',
            });
          }}>
            <Icon name="refresh" /> Đặt lại
          </button>
        </div>
      </Panel>

      {view === 'calendar'
        ? <BookingCalendar bookings={bookings} staff={staff} shifts={shifts} />
        : (
          <Panel>
            <SectionHeading
              icon={<Icon name="schedule" />}
              title="Danh sách lịch hẹn"
              subtitle={`${bookings.length} lịch${hasFilter ? ' theo bộ lọc' : ''}`}
            />

            {loading && bookings.length === 0 ? (
              <div className="adm-bk-skeleton">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="adm-skel adm-skel-row" />)}
              </div>
            ) : bookings.length === 0 ? (
              <EmptyState
                title={hasFilter || bookingQuery.scope !== 'today'
                  ? 'Chưa có lịch hẹn'
                  : 'Hôm nay chưa có lịch hẹn'}
                detail={hasFilter
                  ? 'Không tìm thấy lịch hẹn phù hợp với bộ lọc hiện tại.'
                  : 'Các lịch hẹn mới sẽ xuất hiện tại đây.'}
              >
                {hasFilter ? (
                  <button className="button secondary" onClick={() => patch({
                    q: '', status: '', payment: '', source: '',
                    staffId: '', serviceId: '', day: '',
                  })}>Đặt lại bộ lọc</button>
                ) : (
                  <button className="button" onClick={() => setWalkIn(true)}>
                    <Icon name="plus" /> Tạo lịch khách trực tiếp
                  </button>
                )}
              </EmptyState>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="adm-table adm-table-booking">
                    <thead>
                      <tr>
                        <th>Mã lịch</th><th>Thời gian</th><th>Khách hàng</th>
                        <th>Dịch vụ</th><th>Nhân viên</th><th>Nguồn</th>
                        <th>Tổng tiền</th><th>Trạng thái</th><th>Thanh toán</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((booking) => {
                        const menu = MENU_BY_STATUS[booking.status] ?? [];
                        const done = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(booking.status);
                        return (
                          <tr key={booking.id} className={done ? 'is-done' : undefined}>
                            <td>
                              <button className="adm-link" onClick={() => setDetailId(booking.id)}>
                                {booking.code}
                              </button>
                              {booking.note && <small title={booking.note}><Icon name="tag" /></small>}
                            </td>
                            <td>
                              <strong>{fmtDate(booking.startsAt)}</strong>
                              <small>{fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}</small>
                            </td>
                            <td>
                              <span className="adm-cell-name">
                                <Avatar name={booking.customerName}
                                  url={booking.customerAvatarUrl ?? null} size={30} />
                                <span style={{ minWidth: 0 }}>
                                  <strong>{booking.customerName}</strong>
                                  <small>{booking.customerPhone}</small>
                                </span>
                              </span>
                            </td>
                            <td>
                              <strong>{booking.serviceName}</strong>
                              {booking.addonCount > 0
                                ? <small className="adm-addon">+{booking.addonCount} phát sinh</small>
                                : <small>{booking.duration} phút</small>}
                            </td>
                            <td>
                              {booking.staffId ? (
                                <span className="adm-cell-name">
                                  <Avatar name={booking.staffName ?? ''}
                                    url={booking.staffAvatarUrl ?? null} size={26} />
                                  <span style={{ minWidth: 0 }}>
                                    <strong>{booking.staffName}</strong>
                                  </span>
                                </span>
                              ) : (
                                <span className="adm-warn-inline">
                                  <Icon name="ban" /> Chưa phân công
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="badge confirmed"><i />{booking.sourceText}</span>
                            </td>
                            <td><strong>{formatVND(booking.total)}</strong></td>
                            <td>
                              <StatusBadge status={booking.status} />
                              {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                                <small className="adm-warn-inline">
                                  <Icon name="ban" /> Chưa thanh toán
                                </small>
                              )}
                            </td>
                            <td>
                              {booking.paymentText
                                ? (
                                  <span className={`badge ${booking.paymentStatus === 'PAID' ? 'completed'
                                    : booking.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                                    <i />{booking.paymentText}
                                  </span>
                                )
                                : <span className="adm-none">Chưa ghi nhận</span>}
                            </td>
                            <td>
                              <span className="adm-row-actions">
                                {booking.status === 'PENDING' && (
                                  <button className="adm-text-btn"
                                    onClick={() => quickConfirm(booking)}>Xác nhận</button>
                                )}
                                <button className="adm-icon-btn" aria-label="Thao tác với lịch hẹn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenMenu(openMenu === booking.id ? null : booking.id);
                                  }}>
                                  <Icon name="settings" />
                                </button>
                                {openMenu === booking.id && (
                                  <span className="adm-row-menu" onClick={(e) => e.stopPropagation()}>
                                    <button className="adm-link" onClick={() => setDetailId(booking.id)}>
                                      Xem chi tiết
                                    </button>
                                    {menu.map((item) => (
                                      <button key={item.key}
                                        className={item.danger ? 'is-danger' : undefined}
                                        onClick={() => runMenu(booking, item.key)}>
                                        <Icon name={item.icon} /> {item.label}
                                      </button>
                                    ))}
                                    {menu.length === 0 && (
                                      <span className="adm-row-menu-empty">
                                        {booking.status === 'CANCELLED' && booking.cancelReason
                                          ? `Lý do hủy: ${booking.cancelReason}`
                                          : booking.status === 'NO_SHOW'
                                            ? 'Khách không đến lịch hẹn.'
                                            : 'Không còn thao tác nào.'}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="adm-pager">
                    <button className="adm-icon-btn" disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)} aria-label="Trang trước">‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button key={n} className={n === page ? 'is-on' : ''}
                        onClick={() => setPage(n)}>{n}</button>
                    ))}
                    <button className="adm-icon-btn" disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)} aria-label="Trang sau">›</button>
                    <span>{PAGE_SIZE} lịch / trang</span>
                  </div>
                )}
              </>
            )}
          </Panel>
        )}

      {dialog?.kind === 'confirm' && (
        <ConfirmDialog booking={dialog.booking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); reload(); }} />
      )}
      {dialog?.kind === 'staff' && (
        <ChangeStaffDialog booking={dialog.booking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); reload(); }} />
      )}
      {dialog?.kind === 'reschedule' && (
        <RescheduleDialog booking={dialog.booking}
          staffOptions={staff.map((item) => ({ id: item.id, name: item.name, avatarUrl: item.avatarUrl }))}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); reload(); }} />
      )}
      {dialog?.kind === 'cancel' && (
        <CancelDialog booking={dialog.booking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); reload(); }} />
      )}
      {dialog?.kind === 'noshow' && (
        <NoShowDialog booking={dialog.booking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); reload(); }} />
      )}

      {detailId && (
        <BookingDetail
          bookingId={detailId}
          services={services.map((item) => ({ id: item.id, name: item.name, price: item.price }))}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}

      {walkIn && (
        <WalkInDialog onClose={() => setWalkIn(false)} onDone={() => { setWalkIn(false); reload(); }} />
      )}
    </>
  );
}
