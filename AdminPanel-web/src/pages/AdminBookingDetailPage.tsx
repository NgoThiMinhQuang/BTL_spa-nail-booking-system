/* ===== Trang Chi tiết lịch hẹn =====

   Một màn hình nhìn hết một lịch: khách, dịch vụ, nhân viên, ghi chú, ảnh
   mẫu, dịch vụ phát sinh, thanh toán, lịch sử — và ngay bên cạnh là những
   thao tác hợp lệ với trạng thái hiện tại.

   Nguyên tắc quan trọng: thao tác không hợp lệ với trạng thái vừa bị ẩn ở
   đây vừa bị backend từ chối, nên giao diện không bao giờ đưa Admin vào
   tình huống phải bấm rồi mới nhận ra là không được phép. */

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatusBadge } from '../components/Primitives';
import { BookingStatusFlow } from '../components/BookingStatusFlow';
import { BookingTimeline, type BookingEvent } from '../components/BookingTimeline';
import { ReferenceImages } from '../components/ReferenceImages';
import {
  CancelDialog, ChangeStaffDialog, ConfirmDialog, NoShowDialog,
  RescheduleDialog, sendBookingRequest,
} from '../components/BookingDialogs';
import { useApp, type Booking } from '../store';
import { fmtDate, fmtRating, fmtTime, formatVND } from '../lib/utils';

interface Addon {
  id: string; name: string; quantity: number; price: number; duration: number;
}

interface Detail {
  id: string; code: string;
  startsAt: string; endsAt: string;
  status: string; statusText: string;
  note: string | null; source: string; sourceText: string;
  createdAt: string;
  cancelReason: string | null; cancelledAt: string | null;
  serviceId: string; serviceName: string; serviceImage: string | null;
  serviceCategory: string | null; serviceStatus: string; serviceStatusText: string;
  price: number; duration: number; bufferTime: number; totalMinutes: number;
  customerId: string | null; customerName: string; customerPhone: string;
  customerEmail: string | null; customerAvatarUrl: string | null;
  staffId: string | null; staffName: string | null; staffAvatarUrl: string | null;
  staffPhone: string | null; staffStatus: string; specialty: string | null;
  staffExperience: number | null;
  staffRating: number | null; staffReviewCount: number;
  shiftStart: string | null; shiftEnd: string | null; shiftStatus: string | null;
  availability: { ok: boolean; reason: string | null; conflict: { id: string } | null } | null;
  paymentId: string | null; paymentStatus: string | null; paymentText: string | null;
  methodText: string | null; paidAmount: number | null; paymentDate: string | null;
  addonTotal: number; total: number;
  addons: Addon[]; images: { id: string; url: string }[]; events: BookingEvent[];
  review: { id: string; rating: number; comment: string | null; image: string | null;
            createdAt: string } | null;
}

/* Nút thao tác theo trạng thái. Thứ tự cũng là thứ tự ưu tiên: việc nên làm
   trước nằm trên cùng, thao tác phá huỷ lịch nằm cuối và tách riêng. */
const ACTIONS: Record<string, { key: string; label: string; icon: Parameters<typeof Icon>[0]['name'] }[]> = {
  PENDING: [
    { key: 'confirm', label: 'Xác nhận lịch', icon: 'check' },
    { key: 'staff', label: 'Đổi nhân viên', icon: 'adminStaff' },
    { key: 'reschedule', label: 'Đổi thời gian', icon: 'calendar' },
    { key: 'cancel', label: 'Hủy lịch', icon: 'ban' },
  ],
  CONFIRMED: [
    { key: 'staff', label: 'Đổi nhân viên', icon: 'adminStaff' },
    { key: 'reschedule', label: 'Đổi thời gian', icon: 'calendar' },
    { key: 'noshow', label: 'Đánh dấu không đến', icon: 'ban' },
    { key: 'cancel', label: 'Hủy lịch', icon: 'ban' },
  ],
  PROCESSING: [
    { key: 'confirm', label: 'Hoàn thành', icon: 'done' },
    { key: 'noshow', label: 'Đánh dấu không đến', icon: 'ban' },
  ],
  COMPLETED: [{ key: 'payment', label: 'Xem thanh toán', icon: 'card' }],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Đã hết giờ hẹn thì mới cho đánh dấu khách không đến. */
function pastStart(booking: Detail): boolean {
  return new Date(booking.startsAt).getTime() <= Date.now();
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="adm-bd-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

function Card({
  title, icon, children, action,
}: {
  title: string; icon: Parameters<typeof Icon>[0]['name'];
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Panel className="adm-bd-card">
      <SectionHeading icon={<Icon name={icon} />} title={title}>{action}</SectionHeading>
      <div className="adm-bd-body">{children}</div>
    </Panel>
  );
}

export function AdminBookingDetailPage() {
  const { state, dispatch, reload, closeBookingDetail } = useApp();
  const { bookingDetailId } = state;

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<string | null>(null);
  const [picking, setPicking] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!bookingDetailId) return;
    try {
      const response = await fetch(`/api/admin/bookings/${bookingDetailId}`);
      const payload = await response.json();
      if (!response.ok) return setError(payload.message ?? 'Không tải được lịch hẹn.');
      setData(payload.data);
      setError('');
    } catch {
      setError('Mất kết nối tới máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [bookingDetailId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  /* Gửi kèm tên người đang đăng nhập để lịch sử ghi đúng ai thao tác. */
  const actorName = state.user?.name ?? 'Quản trị viên';

  async function send(body: Record<string, unknown>, url: string, method: string) {
    setBusy(true);
    const result = await sendBookingRequest(url, {
      method,
      body: JSON.stringify({ ...body, actorName }),
    });
    setBusy(false);
    if (!result.ok) return result;
    await load();
    reload();
    return result;
  }

  async function addAddon(serviceId: string) {
    if (!serviceId) return;
    const result = await send({ serviceId }, `/api/admin/bookings/${data!.id}/addons`, 'POST');
    if (result.ok) setPicking('');
  }

  async function removeAddon(addonId: string) {
    await send({}, `/api/admin/bookings/${data!.id}/addons/${addonId}`, 'DELETE');
  }

  async function removeImage(imageId: string) {
    await send({}, `/api/admin/bookings/${data!.id}/images/${imageId}`, 'DELETE');
  }

  if (!bookingDetailId) return null;

  if (loading) {
    return (
      <div className="adm-bd-grid">
        {[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel adm-skel-panel" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState title="Không tìm thấy lịch hẹn"
        detail={error || 'Lịch hẹn có thể đã bị xóa hoặc bạn không có quyền truy cập.'}>
        <button className="button" onClick={closeBookingDetail}>Quay lại danh sách</button>
      </EmptyState>
    );
  }

  const actions = ACTIONS[data.status] ?? [];
  const primary = actions[0];
  /* Hủy lịch vẽ riêng ở cuối bằng kiểu nút nguy hiểm, nên không để nó trong
     danh sách nút phụ — nếu không sẽ hiện hai nút "Hủy lịch" cạnh nhau. */
  const secondary = actions.slice(1).filter((item) => item.key !== 'cancel');
  const addonLocked = ['CANCELLED', 'NO_SHOW'].includes(data.status);
  const noShowReady = data.status === 'CONFIRMED' && pastStart(data);

  const summary = `${data.customerName} · ${data.serviceName} · `
    + `${fmtDate(data.startsAt)} ${fmtTime(data.startsAt)}`;

  /* Các hộp thoại dùng chung với trang danh sách nên cần đúng kiểu Booking. */
  const asBooking: Booking = {
    id: data.id, code: data.code,
    startsAt: data.startsAt, endsAt: data.endsAt,
    status: data.status, statusText: data.statusText, note: data.note,
    source: data.source, sourceText: data.sourceText,
    cancelReason: data.cancelReason, cancelledAt: data.cancelledAt,
    serviceId: data.serviceId, serviceName: data.serviceName,
    duration: data.duration, price: data.price,
    customerId: data.customerId ?? '', customerName: data.customerName,
    customerPhone: data.customerPhone, customerAvatarUrl: data.customerAvatarUrl,
    staffId: data.staffId, staffName: data.staffName, staffAvatarUrl: data.staffAvatarUrl,
    paymentStatus: data.paymentStatus, paymentMethod: data.methodText,
    paidAmount: data.paidAmount, paymentText: data.paymentText, methodText: data.methodText,
    addonCount: data.addons.length, addonTotal: data.addonTotal, total: data.total,
  };

  const runAction = (key: string) => {
    if (key === 'payment') return dispatch({ type: 'view', view: 'admin-payments' });
    setDialog(key);
  };

  return (
    <>
      {/* Đầu trang: quay lại, mã lịch, trạng thái */}
      <div className="adm-bd-head">
        <button className="adm-back" onClick={closeBookingDetail}>
          <Icon name="chevronDown" /> Quay lại danh sách
        </button>

        <div className="adm-bd-title">
          <div>
            <h1>Chi tiết lịch hẹn <em>{data.code}</em></h1>
            <p className="subtitle">{summary}</p>
            <small className="adm-bd-created">
              Đặt lúc {fmtDate(data.createdAt)} · {fmtTime(data.createdAt)}
            </small>
          </div>

          <div className="adm-bd-head-right">
            <StatusBadge status={data.status} />
            {primary && primary.key !== 'payment' && (
              <button className="button" disabled={busy} onClick={() => runAction(primary.key)}>
                <Icon name={primary.icon} /> {primary.label}
              </button>
            )}
            {primary?.key === 'payment' && (
              <button className="button" onClick={() => runAction(primary.key)}>
                <Icon name={primary.icon} /> {primary.label}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="adm-bd-grid">
        {/* ============ Cột trái: thông tin ============ */}
        <div className="adm-bd-main">
          {/* Cảnh báo: nhân viên / dịch vụ có còn hợp lệ không */}
          {data.availability && !data.availability.ok && (
            <div className="adm-warn adm-bd-warn">
              <Icon name="ban" />
              <span>
                <strong>Nhân viên không còn khả dụng cho lịch này.</strong>
                {data.availability.reason}
                {data.availability.conflict
                  && ` Lịch trùng: #${data.availability.conflict.id}.`}
                <button className="button secondary"
                  onClick={() => setDialog('staff')}>Đổi nhân viên</button>
              </span>
            </div>
          )}
          {data.serviceStatus !== 'ACTIVE' && (
            <div className="adm-warn adm-bd-warn">
              <Icon name="info" />
              <span>
                <strong>Dịch vụ này hiện đã ngừng hoạt động.</strong>
                Lịch hẹn được tạo trước khi dịch vụ bị tắt. Admin quyết định
                vẫn thực hiện hoặc hủy theo nghiệp vụ cửa hàng.
              </span>
            </div>
          )}

          {/* Thông tin lịch — các số liệu ngắn nên xếp hai cột cho đỡ
              khoảng trắng ngang và gọn chiều cao khối. */}
          <Card title="Thông tin lịch" icon="calendar">
            <dl className="adm-bk-list adm-bd-facts">
              <Row label="Mã lịch">{data.code}</Row>
              <Row label="Ngày hẹn">{fmtDate(data.startsAt)}</Row>
              <Row label="Nguồn">
                {data.source === 'WALK_IN'
                  ? <span className="badge pending"><i />Khách trực tiếp</span>
                  : <span className="badge confirmed"><i />Ứng dụng Mobile</span>}
              </Row>
              <Row label="Giờ">
                {fmtTime(data.startsAt)} – {fmtTime(data.endsAt)}
              </Row>
              <Row label="Ngày tạo">{fmtDate(data.createdAt)}</Row>
              <Row label="Thời gian dịch vụ">{data.duration} phút</Row>
              <Row label="Buffer">{data.bufferTime} phút</Row>
              <Row label="Tổng thời gian">
                <strong>{data.totalMinutes} phút</strong>
              </Row>
            </dl>
          </Card>

          {/* Khách hàng */}
          <Card title="Thông tin khách hàng" icon="customers">
            {data.customerId ? (
              <>
                <div className="adm-bd-person">
                  <Avatar name={data.customerName} url={data.customerAvatarUrl} size={44} />
                  <span>
                    <strong>{data.customerName}</strong>
                    <small>Số điện thoại: {data.customerPhone}</small>
                    {data.customerEmail && <small>Email: {data.customerEmail}</small>}
                  </span>
                  <button className="button secondary"
                    onClick={() => dispatch({ type: 'view', view: 'admin-customers' })}>
                    Xem hồ sơ khách hàng
                  </button>
                </div>
              </>
            ) : (
              /* Khách không có tài khoản: chỉ còn tên và số điện thoại. */
              <>
                <div className="adm-bd-person">
                  <Avatar name={data.customerName ?? ''} url={null} size={44} />
                  <span>
                    <strong>{data.customerName}</strong>
                    <small>Số điện thoại: {data.customerPhone}</small>
                  </span>
                  <span className="badge pending"><i />Khách Walk-in</span>
                </div>
                <p className="adm-field-note">
                  Khách này không có tài khoản nên không có hồ sơ để xem.
                </p>
              </>
            )}
          </Card>

          {/* Dịch vụ — giá lấy từ snapshot lúc đặt */}
          <Card title="Dịch vụ" icon="services">
            <div className="adm-bd-service">
              {data.serviceImage && (
                <img src={data.serviceImage} alt="" className="adm-bd-service-img" />
              )}
              <div>
                <strong>{data.serviceName}</strong>
                <dl className="adm-bk-list adm-bd-facts">
                  <Row label="Danh mục">{data.serviceCategory ?? '—'}</Row>
                  <Row label="Thời gian">
                    {data.duration}′ + {data.bufferTime}′ buffer
                  </Row>
                  <Row label="Giá tại lúc đặt">
                    <strong>{formatVND(data.price)}</strong>
                  </Row>
                  <Row label="Trạng thái">
                    <span className={`badge ${data.serviceStatus === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
                      <i />{data.serviceStatusText}
                    </span>
                  </Row>
                </dl>
              </div>
            </div>
            <p className="adm-field-note">
              Giá và thời gian lấy từ lúc đặt lịch, nên sau này cửa hàng đổi giá
              thì lịch này vẫn hiện đúng số tiền khách đã trả.
            </p>
          </Card>

          {/* Nhân viên */}
          <Card title="Nhân viên thực hiện" icon="adminStaff">
            {data.staffId ? (
              <>
                <div className="adm-bd-person">
                  <Avatar name={data.staffName ?? ''} url={data.staffAvatarUrl} size={44} />
                  <span>
                    <strong>{data.staffName}</strong>
                    {data.specialty && <small>Chuyên môn: {data.specialty}</small>}
                    <small>
                      Đánh giá:{' '}
                      {data.staffRating != null
                        ? `${fmtRating(data.staffRating)} / 5 (${data.staffReviewCount} đánh giá)`
                        : 'chưa có đánh giá'}
                    </small>
                    <small>
                      Ca làm: {data.shiftStart
                        ? `${String(data.shiftStart).slice(0, 5)} – ${String(data.shiftEnd).slice(0, 5)}`
                        : 'không có ca trong ngày này'}
                    </small>
                  </span>
                  <button className="button secondary" onClick={() => setDialog('staff')}>
                    Đổi nhân viên
                  </button>
                </div>

                {/* Tình trạng nhân viên với chính lịch này */}
                {data.availability?.ok && (
                  <p className="adm-bd-ok">
                    <Icon name="check" /> Nhân viên khả dụng cho khung giờ này.
                  </p>
                )}
                {data.staffStatus === 'INACTIVE' && (
                  <div className="adm-warn">
                    <Icon name="ban" />
                    <span>
                      <strong>Nhân viên này hiện đã ngừng hoạt động.</strong>
                      Vui lòng phân công nhân viên khác.
                    </span>
                  </div>
                )}
              </>
            ) : (
              /* Lịch để "bất kỳ nhân viên nào" nên chưa có người nhận. */
              <div className="adm-bd-unassigned">
                <Icon name="ban" />
                <span>
                  <strong>Chưa phân công nhân viên</strong>
                  Lịch này cần gán người thực hiện trước khi bắt đầu.
                </span>
                <button className="button" onClick={() => setDialog('staff')}>
                  Phân công nhân viên
                </button>
              </div>
            )}
          </Card>

          {/* Ghi chú của khách */}
          <Card title="Ghi chú của khách" icon="tag">
            <p className={data.note ? 'adm-bd-note' : 'adm-field-note'}>
              {data.note ?? 'Khách hàng không để lại ghi chú.'}
            </p>
          </Card>

          {/* Ảnh mẫu */}
          <Card title="Ảnh mẫu khách gửi" icon="flower">
            <ReferenceImages images={data.images} onRemove={removeImage} />
          </Card>

          {/* Dịch vụ phát sinh */}
          <Card title="Dịch vụ phát sinh" icon="plus">
            <div className="adm-bd-lines">
              <div className="adm-bd-line is-main">
                <span>
                  <strong>{data.serviceName}</strong>
                  <small>Dịch vụ chính</small>
                </span>
                <span>
                  {data.price.toLocaleString('vi-VN')} × {data.duration}′
                  <small>{formatVND(data.price)}</small>
                </span>
              </div>

              {data.addons.length === 0 && !addonLocked && (
                <p className="adm-field-note">Chưa có dịch vụ phát sinh.</p>
              )}

              {data.addons.map((addon) => (
                <div key={addon.id} className="adm-bd-line">
                  <span>
                    <strong>{addon.name}</strong>
                    <small>Dịch vụ phát sinh</small>
                  </span>
                  <span>
                    {addon.quantity} × {addon.price.toLocaleString('vi-VN')}
                    <small>{formatVND(addon.price * addon.quantity)}</small>
                  </span>
                  {!addonLocked && (
                    <button className="adm-icon-btn" disabled={busy}
                      aria-label={`Bỏ ${addon.name}`} onClick={() => removeAddon(addon.id)}>
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!addonLocked && (
              <div className="adm-bd-addon-form">
                <label className="adm-field">
                  <span>Thêm dịch vụ phát sinh</span>
                  <select value={picking} disabled={busy}
                    onChange={(e) => setPicking(e.target.value)}>
                    <option value="">Chọn dịch vụ…</option>
                    {state.services
                      .filter((item) => item.id !== data.serviceId
                        && !data.addons.some((addon) => addon.id === item.id))
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {formatVND(item.price)}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="button secondary" disabled={busy || !picking}
                  onClick={() => addAddon(picking)}>
                  <Icon name="plus" /> Thêm vào lịch
                </button>
              </div>
            )}
            {addonLocked && (
              <p className="adm-field-note">
                Lịch đã {data.statusText.toLowerCase()} nên không thay đổi được dịch vụ phát sinh.
              </p>
            )}
          </Card>

          {/* Đánh giá */}
          {data.status === 'COMPLETED' && (
            <Card title="Đánh giá của khách" icon="star">
              {data.review ? (
                <div className="adm-bk-review">
                  <span className="adm-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={n <= data.review!.rating ? 'is-on' : ''}>★</span>
                    ))}
                  </span>
                  <strong>{fmtRating(data.review.rating)} / 5</strong>
                  {data.review.comment && <p>{data.review.comment}</p>}
                  <small className="adm-field-note">
                    Đánh giá lúc {fmtDate(data.review.createdAt)}
                  </small>
                </div>
              ) : (
                <p className="adm-field-note">Khách hàng chưa đánh giá Booking này.</p>
              )}
            </Card>
          )}

          {/* Lịch sử */}
          <Card title="Lịch sử hoạt động" icon="clock">
            <BookingTimeline events={data.events} />
          </Card>
        </div>

        {/* ============ Cột phải: trạng thái và thao tác ============ */}
        <aside className="adm-bd-side">
          <Panel className="adm-bd-card">
            <SectionHeading icon={<Icon name="schedule" />} title="Trạng thái lịch" />
            <div className="adm-bd-body">
              <BookingStatusFlow status={data.status} />

              {data.status === 'CANCELLED' && (
                <div className="adm-warn">
                  <Icon name="ban" />
                  <span>
                    <strong>Đã hủy{data.cancelledAt ? ` · ${fmtDate(data.cancelledAt)}` : ''}</strong>
                    {data.cancelReason ?? 'Không có lý do được ghi nhận.'}
                  </span>
                </div>
              )}
              {data.status === 'NO_SHOW' && (
                <p className="adm-field-note">
                  Đánh dấu bởi quản trị viên
                  {data.cancelledAt ? ` · ${fmtDate(data.cancelledAt)} ${fmtTime(data.cancelledAt)}` : ''}.
                </p>
              )}
            </div>
          </Panel>

          {data.status === 'COMPLETED' && data.paymentStatus !== 'PAID' && (
            <Panel className="adm-bd-card is-alert">
              <div className="adm-bd-body">
                <div className="adm-warn">
                  <Icon name="ban" />
                  <span>
                    <strong>Dịch vụ đã hoàn thành nhưng chưa thanh toán.</strong>
                    Kiểm tra lại với khách trước khi chốt.
                  </span>
                </div>
                <button className="button secondary adm-bd-full"
                  onClick={() => dispatch({ type: 'view', view: 'admin-payments' })}>
                  <Icon name="card" /> Xem / cập nhật thanh toán
                </button>
              </div>
            </Panel>
          )}

          {/* Tóm tắt tiền */}
          <Panel className="adm-bd-card">
            <SectionHeading icon={<Icon name="dollar" />} title="Tóm tắt thanh toán" />
            <div className="adm-bd-body">
              <dl className="adm-bk-list adm-bd-facts">
                <Row label="Dịch vụ chính">{formatVND(data.price)}</Row>
                <Row label="Phát sinh">{formatVND(data.addonTotal)}</Row>
                <Row label="Tổng cộng"><strong>{formatVND(data.total)}</strong></Row>
                <Row label="Thanh toán">
                  {data.paymentText
                    ? (
                      <span className={`badge ${data.paymentStatus === 'PAID' ? 'completed'
                        : data.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                        <i />{data.paymentText}
                      </span>
                    )
                    : <span className="adm-none">Chưa ghi nhận</span>}
                </Row>
              </dl>

              {data.paymentId && (
                <dl className="adm-bk-list adm-bd-list">
                  <Row label="Mã giao dịch">{data.paymentId}</Row>
                  {data.methodText && <Row label="Phương thức">{data.methodText}</Row>}
                  {data.paidAmount != null && (
                    <Row label="Số tiền">{formatVND(data.paidAmount)}</Row>
                  )}
                  {data.paymentDate && (
                    <Row label="Thanh toán lúc">
                      {fmtDate(data.paymentDate)} · {fmtTime(data.paymentDate)}
                    </Row>
                  )}
                </dl>
              )}
            </div>
          </Panel>

          {/* Thao tác */}
          <Panel className="adm-bd-card">
            <SectionHeading icon={<Icon name="settings" />} title="Thao tác" />
            <div className="adm-bd-body adm-bd-actions">
              {actions.length === 0 ? (
                <p className="adm-field-note">
                  {data.status === 'CANCELLED'
                    ? 'Lịch đã hủy nên chỉ có thể xem thông tin.'
                    : 'Lịch đã kết thúc, không còn thao tác nào.'}
                </p>
              ) : (
                <>
                  {secondary.map((item) => (
                    <button key={item.key} className="button secondary adm-bd-full"
                      disabled={busy} onClick={() => runAction(item.key)}>
                      <Icon name={item.icon} /> {item.label}
                    </button>
                  ))}
                  {noShowReady && !actions.some((item) => item.key === 'noshow') && (
                    <button className="button secondary adm-bd-full" onClick={() => setDialog('noshow')}>
                      <Icon name="ban" /> Đánh dấu không đến
                    </button>
                  )}
                  {actions.some((item) => item.key === 'cancel') && (
                    <button className="button is-danger adm-bd-full"
                      disabled={busy} onClick={() => runAction('cancel')}>
                      <Icon name="ban" /> Hủy lịch
                    </button>
                  )}
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      {dialog === 'confirm' && (
        <ConfirmDialog booking={asBooking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); reload(); }} />
      )}
      {dialog === 'staff' && (
        <ChangeStaffDialog booking={asBooking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); reload(); }} />
      )}
      {dialog === 'reschedule' && (
        <RescheduleDialog booking={asBooking}
          staffOptions={state.staff.map((item) => ({
            id: item.id, name: item.name, avatarUrl: item.avatarUrl,
          }))}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); reload(); }} />
      )}
      {dialog === 'cancel' && (
        <CancelDialog booking={asBooking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); reload(); }} />
      )}
      {dialog === 'noshow' && (
        <NoShowDialog booking={asBooking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); reload(); }} />
      )}
    </>
  );
}
