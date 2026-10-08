/* ===== Trang Chi tiết lịch hẹn =====

   Một màn hình nhìn hết một lịch: khách, dịch vụ, nhân viên, yêu cầu, dịch
   vụ phát sinh, thanh toán — và bên phải là tóm tắt cùng tiến trình.

   Phân quyền rõ ràng: hai bước CONFIRMED → PROCESSING và
   PROCESSING → COMPLETED là việc của nhân viên đang phục vụ, nên trang này
   không có nút cho hai bước đó. Backend cũng chặn, không chỉ ẩn nút.
   Vì vậy Admin chỉ phản ánh trạng thái sau khi nhân viên cập nhật. */

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatusBadge } from '../components/Primitives';
import { BookingStatusFlow } from '../components/BookingStatusFlow';
import { BookingTimeline, type BookingEvent } from '../components/BookingTimeline';
import { ReferenceImages } from '../components/ReferenceImages';
import { AdjustBookingDrawer } from '../components/AdjustBookingDrawer';
import {
  CancelDialog, ChangeStaffDialog, ConfirmDialog, NoShowDialog,
  sendBookingRequest,
} from '../components/BookingDialogs';
import { useApp, type Booking } from '../store';
import { fmtDate, fmtRating, fmtTime, formatVND } from '../lib/utils';

interface Addon { id: string; name: string; quantity: number; price: number }

interface Detail {
  id: string; code: string;
  startsAt: string; endsAt: string;
  /** Mốc hết dịch vụ, chưa tính buffer. */
  serviceEndsAt: string;
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
  shiftStart: string | null; shiftEnd: string | null;
  availability: { ok: boolean; reason: string | null } | null;
  paymentId: string | null; paymentStatus: string | null; paymentText: string | null;
  methodText: string | null; paidAmount: number | null; paymentDate: string | null;
  addonTotal: number; total: number;
  addons: Addon[]; images: { id: string; url: string }[]; events: BookingEvent[];
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
}

/* Nút thao tác theo trạng thái. Khung chi tiết chỉ hiện những việc quản
   trị được phép; bắt đầu và hoàn thành dịch vụ thuộc về nhân viên. */
const ACTIONS: Record<string, { key: string; label: string; icon: Parameters<typeof Icon>[0]['name'] }[]> = {
  PENDING: [
    { key: 'confirm', label: 'Xác nhận lịch', icon: 'check' },
    { key: 'adjust', label: 'Điều chỉnh lịch', icon: 'calendar' },
    { key: 'cancel', label: 'Hủy lịch', icon: 'ban' },
  ],
  CONFIRMED: [
    { key: 'noshow', label: 'Đánh dấu vắng mặt', icon: 'ban' },
    { key: 'adjust', label: 'Điều chỉnh lịch', icon: 'calendar' },
    { key: 'cancel', label: 'Hủy lịch', icon: 'ban' },
  ],
  /* Đã bắt đầu rồi thì không còn việc nào của quản trị nữa. */
  PROCESSING: [],
  COMPLETED: [{ key: 'payment', label: 'Xem thanh toán', icon: 'card' }],
  CANCELLED: [],
  NO_SHOW: [],
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="adm-bd-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

function Card({ title, icon, children, action }: {
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
  const { state, dispatch, reload, closeBookingDetail, openCustomerDetail } = useApp();
  const { bookingDetailId } = state;

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<string | null>(null);
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

  async function removeAddon(addonId: string) {
    await send({}, `/api/admin/bookings/${data!.id}/addons/${addonId}`, 'DELETE');
  }

  if (!bookingDetailId) return null;

  if (loading) {
    return (
      <div className="adm-bd-grid">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="adm-skel adm-skel-panel" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState title="Không tìm thấy lịch hẹn"
        detail="Lịch hẹn này không tồn tại hoặc đã không còn khả dụng.">
        <button className="button" onClick={closeBookingDetail}>
          Quay lại danh sách lịch hẹn
        </button>
      </EmptyState>
    );
  }

  const actions = ACTIONS[data.status] ?? [];
  const readOnly = actions.length === 0;
  const addonLocked = ['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(data.status);

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
      {/* ---- Đầu trang ---- */}
      <button className="adm-back" onClick={closeBookingDetail}>
        <Icon name="chevronDown" /> Quay lại danh sách lịch hẹn
      </button>

      <div className="adm-bd-head">
        <div className="adm-bd-title">
          <div>
            <h1>
              Chi tiết lịch hẹn
              <em>
                {data.code}
                <StatusBadge status={data.status} />
              </em>
            </h1>
            <p className="subtitle">
              {data.customerName} · {data.serviceName} · {fmtDate(data.startsAt)}{' '}
              {fmtTime(data.startsAt)}
            </p>
          </div>

          {/* Chỉ hiện thao tác hợp lệ với trạng thái hiện tại. */}
          {!readOnly && (
            <div className="adm-bd-head-actions">
              {actions.map((item, index) => (
                <button key={item.key} disabled={busy}
                  className={index === 0 ? 'button' : 'button secondary'}
                  onClick={() => runAction(item.key)}>
                  <Icon name={item.icon} /> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="adm-bd-grid">
        {/* ================= Cột trái ================= */}
        <div className="adm-bd-main">
          {data.availability && !data.availability.ok && (
            <div className="adm-warn adm-bd-warn">
              <Icon name="ban" />
              <span>
                <strong>Nhân viên không còn khả dụng cho lịch này.</strong>
                {data.availability.reason}
                <button className="button secondary" onClick={() => setDialog('adjust')}>
                  Điều chỉnh lịch
                </button>
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

          {/* ---- Khách hàng ---- */}
          <Card title="Thông tin khách hàng" icon="customers">
            <div className="adm-bd-person">
              <Avatar name={data.customerName} url={data.customerAvatarUrl} size={44} />
              <span>
                <strong>{data.customerName}</strong>
                <small>{data.customerPhone}</small>
                {data.customerEmail && <small>{data.customerEmail}</small>}
              </span>
              {data.customerId ? (
                <button className="button secondary"
                  onClick={() => openCustomerDetail(data.customerId!)}>
                  Xem hồ sơ khách hàng →
                </button>
              ) : (
                <span className="badge pending"><i />Khách Walk-in</span>
              )}
            </div>
            {!data.customerId && (
              <p className="adm-field-note">
                Khách không có tài khoản nên không có hồ sơ để xem.
              </p>
            )}
          </Card>

          {/* ---- Dịch vụ và thời gian ----
              Phân biệt rõ lúc dịch vụ kết thúc với lúc nhân viên hết bị
              chiếm lịch: buffer tính vào ca làm việc nên không được bỏ. */}
          <Card title="Thông tin dịch vụ" icon="services">
            <div className="adm-bd-service">
              {data.serviceImage && (
                <img src={data.serviceImage} alt="" className="adm-bd-service-img" />
              )}
              <div>
                <strong>{data.serviceName}</strong>
                <dl className="adm-bk-list adm-bd-facts">
                  <Row label="Danh mục">{data.serviceCategory ?? '—'}</Row>
                  <Row label="Thời lượng">{data.duration} phút</Row>
                  <Row label="Giá tại lúc đặt">
                    <strong>{formatVND(data.price)}</strong>
                  </Row>
                  <Row label="Buffer Time">{data.bufferTime} phút</Row>
                  <Row label="Bắt đầu">{fmtTime(data.startsAt)}</Row>
                  <Row label="Kết thúc dịch vụ">
                    <strong>{fmtTime(data.serviceEndsAt)}</strong>
                  </Row>
                  <Row label="Nhân viên bận đến">{fmtTime(data.endsAt)}</Row>
                  <Row label="Trạng thái">
                    <span className={`badge ${data.serviceStatus === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
                      <i />{data.serviceStatusText}
                    </span>
                  </Row>
                </dl>
              </div>
            </div>
            <p className="adm-field-note">
              Giá, thời lượng và buffer lấy từ lúc đặt lịch. Sau này cửa hàng
              đổi giá dịch vụ thì lịch này vẫn hiện đúng số tiền khách đã trả.
            </p>
          </Card>

          {/* ---- Nhân viên ---- */}
          <Card title="Nhân viên thực hiện" icon="adminStaff">
            {data.staffId ? (
              <>
                <div className="adm-bd-person">
                  <Avatar name={data.staffName ?? ''} url={data.staffAvatarUrl} size={44} />
                  <span>
                    <strong>{data.staffName}</strong>
                    {data.staffExperience != null && (
                      <small>{data.staffExperience} năm kinh nghiệm</small>
                    )}
                    {data.specialty && <small>{data.specialty}</small>}
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
                  <button className="button secondary"
                    onClick={() => dispatch({ type: 'view', view: 'admin-staff' })}>
                    Xem nhân viên →
                  </button>
                </div>
                {data.availability?.ok && (
                  <p className="adm-bd-ok">
                    <Icon name="check" /> Nhân viên khả dụng cho khung giờ này.
                  </p>
                )}
              </>
            ) : (
              <div className="adm-bd-unassigned">
                <Icon name="ban" />
                <span>
                  <strong>Chưa phân công nhân viên</strong>
                  Lịch này cần gán người thực hiện trước khi bắt đầu.
                </span>
                <button className="button" onClick={() => setDialog('adjust')}>
                  Phân công nhân viên
                </button>
              </div>
            )}
          </Card>

          {/* ---- Yêu cầu của khách: ghi chú và ảnh mẫu gộp chung ---- */}
          <Card title="Yêu cầu của khách hàng" icon="tag">
            <h5 className="adm-bd-sub">Ghi chú</h5>
            <p className={data.note ? 'adm-bd-note' : 'adm-field-note'}>
              {data.note ?? 'Khách hàng không có ghi chú.'}
            </p>

            <h5 className="adm-bd-sub">Ảnh mẫu</h5>
            {/* Chỉ xem: ảnh do khách gửi lúc đặt lịch, quản trị không thêm
                ảnh tại đây. */}
            <ReferenceImages images={data.images} />
          </Card>

          {/* ---- Dịch vụ phát sinh ---- */}
          <Card title="Dịch vụ phát sinh" icon="plus">
            {data.addons.length === 0 ? (
              <p className="adm-field-note">Chưa có dịch vụ phát sinh.</p>
            ) : (
              <div className="table-scroll adm-bd-addon-table">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th className="adm-stt">STT</th><th>Dịch vụ</th><th className="adm-cs-num">Số lượng</th>
                      <th className="adm-cs-num">Đơn giá</th>
                      <th className="adm-cs-num">Thành tiền</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.addons.map((addon, index) => (
                      <tr key={addon.id}>
                        <td className="adm-stt">{index + 1}</td>
                        <td>{addon.name}</td>
                        <td className="adm-cs-num">{addon.quantity}</td>
                        <td className="adm-cs-num">{formatVND(addon.price)}</td>
                        <td className="adm-cs-num">
                          <strong>{formatVND(addon.price * addon.quantity)}</strong>
                        </td>
                        <td>
                          {!addonLocked && (
                            <button className="adm-icon-btn" disabled={busy}
                              aria-label={`Bỏ ${addon.name}`}
                              onClick={() => removeAddon(addon.id)}>
                              <Icon name="trash" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <dl className="adm-bk-list adm-bd-sum">
              <Row label="Dịch vụ chính">{formatVND(data.price)}</Row>
              <Row label="Add-on">{formatVND(data.addonTotal)}</Row>
              <Row label="Tổng cộng"><strong>{formatVND(data.total)}</strong></Row>
            </dl>
          </Card>

          {/* ---- Thanh toán ----
              Trạng thái lịch và trạng thái thanh toán là hai thứ khác nhau:
              một lịch có thể đã hoàn thành mà vẫn chưa thu tiền. */}
          <Card title="Thanh toán" icon="card">
            <dl className="adm-bk-list adm-bd-facts">
              <Row label="Trạng thái thanh toán">
                {data.paymentStatus
                  ? (
                    <span className={`badge ${data.paymentStatus === 'PAID' ? 'completed'
                      : data.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                      <i />{data.paymentStatus}
                    </span>
                  )
                  : <span className="adm-none">Chưa ghi nhận</span>}
              </Row>
              <Row label="Tổng tiền">{formatVND(data.total)}</Row>
              {data.paymentId && <Row label="Mã thanh toán">PAY{data.paymentId}</Row>}
              {data.methodText && <Row label="Phương thức">{data.methodText}</Row>}
              <Row label="Mã giao dịch">
                <span className="adm-none">{data.paidAmount != null ? `#${data.paymentId}` : '—'}</span>
              </Row>
              {data.paymentDate && (
                <Row label="Ngày thanh toán">
                  {fmtDate(data.paymentDate)} {fmtTime(data.paymentDate)}
                </Row>
              )}
            </dl>

            {data.status === 'COMPLETED' && data.paymentStatus !== 'PAID' && (
              <div className="adm-warn">
                <Icon name="ban" />
                <span>
                  <strong>Dịch vụ đã hoàn thành nhưng chưa thanh toán.</strong>
                  Kiểm tra lại với khách trước khi chốt.
                </span>
              </div>
            )}
            <button className="button secondary adm-bd-full"
              onClick={() => dispatch({ type: 'view', view: 'admin-payments' })}>
              Xem chi tiết thanh toán →
            </button>
          </Card>

          {/* ---- Đánh giá ---- */}
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
                </div>
              ) : (
                <p className="adm-field-note">Khách hàng chưa đánh giá Booking này.</p>
              )}
            </Card>
          )}

          {/* ---- Lịch sử ---- */}
          <Card title="Lịch sử hoạt động" icon="clock">
            <BookingTimeline events={data.events} />
          </Card>
        </div>

        {/* ================= Cột phải ================= */}
        <aside className="adm-bd-side">
          {/* Tóm tắt: hai trạng thái tách riêng, tổng tiền nổi bật. */}
          <Panel className="adm-bd-card">
            <SectionHeading icon={<Icon name="schedule" />} title="Tóm tắt lịch hẹn" />
            <div className="adm-bd-body">
              <dl className="adm-bk-list">
                <Row label="Mã lịch">{data.code}</Row>
                <Row label="Ngày hẹn">{fmtDate(data.startsAt)}</Row>
                <Row label="Thời gian">
                  {fmtTime(data.startsAt)} – {fmtTime(data.endsAt)}
                </Row>
                <Row label="Nhân viên">
                  {data.staffName ?? <span className="adm-none">Chưa phân công</span>}
                </Row>
                <Row label="Nguồn">
                  {data.source === 'WALK_IN'
                    ? <span className="badge pending"><i />Khách Walk-in</span>
                    : <span className="badge confirmed"><i />Mobile</span>}
                </Row>
                <Row label="Booking Status"><StatusBadge status={data.status} /></Row>
                <Row label="Payment Status">
                  {data.paymentStatus
                    ? (
                      <span className={`badge ${data.paymentStatus === 'PAID' ? 'completed'
                        : data.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                        <i />{data.paymentStatus}
                      </span>
                    )
                    : <span className="adm-none">—</span>}
                </Row>
              </dl>

              <div className="adm-bd-total">
                <small>Tổng tiền</small>
                <strong>{formatVND(data.total)}</strong>
              </div>

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
                  {data.cancelledAt ? ` · ${fmtDate(data.cancelledAt)}` : ''}.
                </p>
              )}
              {readOnly && (
                <p className="adm-field-note">
                  Lịch hẹn đã kết thúc nên chỉ xem, không thao tác thay đổi.
                </p>
              )}
            </div>
          </Panel>

          {/* Tiến trình: chỉ hiện vị trí hiện tại, không bịa mốc thời gian. */}
          <Panel className="adm-bd-card">
            <SectionHeading icon={<Icon name="clock" />} title="Tiến trình lịch hẹn" />
            <div className="adm-bd-body">
              <BookingStatusFlow status={data.status} />
            </div>
          </Panel>
        </aside>
      </div>

      {dialog === 'confirm' && (
        <ConfirmDialog booking={asBooking} onClose={() => setDialog(null)}
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
      {dialog === 'staff' && (
        <ChangeStaffDialog booking={asBooking} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); reload(); }} />
      )}
      {dialog === 'adjust' && (
        <AdjustBookingDrawer
          booking={asBooking}
          duration={data.duration}
          bufferTime={data.bufferTime}
          staffOptions={state.staff.map((item) => ({
            id: item.id, name: item.name, avatarUrl: item.avatarUrl,
          }))}
          actorName={actorName}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); reload(); }}
        />
      )}
    </>
  );
}