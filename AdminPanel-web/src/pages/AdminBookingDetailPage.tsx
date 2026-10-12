/* ===== Ngăn chi tiết lịch hẹn (trượt từ phải sang) =====

   Bấm vào dòng lịch thì danh sách vẫn nằm nguyên phía sau (làm mờ), ngăn
   chi tiết trượt ra từ mép phải — giống hệt ngăn khách hàng, ngăn thanh
   toán, ngăn điều chỉnh. Người dùng không phải học kiểu mới, bấm lần mấy
   cũng mở, Esc hoặc bấm nền là đóng.

   Thứ tự trong ngăn theo đúng luồng thu ngân: hồ sơ lịch → dải tiền
   (tổng/đã thu/còn lại) → thao tác → khách → dịch vụ → nhân viên →
   yêu cầu → phát sinh → thanh toán (+ nút In hóa đơn khi đã PAID) →
   đánh giá → tiến trình → lịch sử.

   Phân quyền giữ nguyên: CONFIRMED → PROCESSING và PROCESSING →
   COMPLETED là việc của nhân viên, trang này không có nút cho hai bước
   đó (backend cũng chặn, không chỉ ẩn nút). */

import { useCallback, useEffect, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/Primitives';
import { Drawer } from '../components/Drawer';
import { BookingStatusFlow } from '../components/BookingStatusFlow';
import { BookingTimeline, type BookingEvent } from '../components/BookingTimeline';
import { BookingInvoice } from '../components/BookingInvoice';
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
  receiptNo: string | null;
  transactions: {
    id: string; type: string; amount: number; method: string | null; paidAt: string;
    txnStatus?: string; isMock?: boolean; gatewayMessage?: string | null;
  }[];
  addonTotal: number; total: number;
  addons: Addon[]; images: { id: string; url: string }[]; events: BookingEvent[];
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
}

/* Nút thao tác theo trạng thái. Ngăn chi tiết chỉ hiện những việc quản
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

/** Ô số liệu trong dải tiền: tổng / đã thu / còn lại. */
function MiniStat({ icon, value, label, tone }: {
  icon: IconName; value: React.ReactNode; label: string;
  tone: 'rose' | 'gold' | 'sage';
}) {
  return (
    <div className={`adm-dstat is-${tone}`}>
      <Icon name={icon} />
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

/* Một dòng thông tin: biểu tượng, nhãn nhỏ, giá trị lớn. */
function Info({ icon, label, value }: {
  icon: IconName; label: string; value: React.ReactNode;
}) {
  return (
    <div className="adm-di-row">
      <span className="adm-di-icon"><Icon name={icon} /></span>
      <span>
        <small>{label}</small>
        <strong>{value ?? '—'}</strong>
      </span>
    </div>
  );
}

/** Nhãn thanh toán: trạng thái lịch và trạng thái tiền là hai thứ khác
    nhau, một lịch có thể đã hoàn thành mà vẫn chưa thu tiền. */
function PayBadge({ status }: { status: string | null }) {
  if (!status) return <span className="adm-none">Chưa ghi nhận</span>;
  return (
    <span className={`badge ${status === 'PAID' ? 'completed'
      : status === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
      <i />{status}
    </span>
  );
}

const TXN_TYPE_TEXT: Record<string, string> = {
  DEPOSIT: 'Đặt cọc', FINAL: 'Thu đủ', REFUND: 'Hoàn tiền',
};
const TXN_STATUS_TEXT: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Chờ hoàn', cls: 'pending' },
  PROCESSING: { label: 'Đang hoàn', cls: 'pending' },
  SUCCEEDED: { label: 'Hoàn xong', cls: 'completed' },
  FAILED: { label: 'Hoàn lỗi', cls: 'cancelled' },
};

/* Dòng tiền từng khoản: trạng thái hoàn thật (PENDING → SUCCEEDED qua
   cổng hoặc tay), gắn nhãn Mô phỏng cho tiền giả lập. Dòng REFUND chờ
   thì Admin thử lại qua cổng hoặc chốt đã hoàn tay ngay tại đây. */
function CashflowSection({ transactions, onChanged }: {
  transactions: Detail['transactions'];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  if (transactions.length === 0) return null;

  async function act(txnId: string, action: 'retry' | 'confirm') {
    let note: string | null = null;
    if (action === 'confirm') {
      note = window.prompt('Ghi chú xác nhận đã hoàn (VD: đã đưa tiền mặt):', '') ?? '';
      if (note !== '' && !note.trim()) {
        setMessage('Xác nhận hoàn tay cần ghi chú.');
        return;
      }
    }
    setBusyId(txnId);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/payments/refunds/${txnId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'confirm' ? JSON.stringify({ note: note?.trim() || null }) : undefined,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.message ?? 'Không thực hiện được.');
        return;
      }
      onChanged();
    } catch {
      setMessage('Mất kết nối tới máy chủ.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="adm-dblock">
      <h4>Dòng tiền <em>{transactions.length} khoản</em></h4>
      <ul className="adm-cashflow">
        {transactions.map((t) => {
          const meta = TXN_STATUS_TEXT[t.txnStatus ?? 'SUCCEEDED']
            ?? { label: t.txnStatus ?? '', cls: '' };
          const actionable = t.type === 'REFUND'
            && ['PENDING', 'FAILED'].includes(t.txnStatus ?? 'SUCCEEDED');
          return (
            <li key={t.id}>
              <span className="adm-cashflow-main">
                <strong>{TXN_TYPE_TEXT[t.type] ?? t.type} · {formatVND(t.amount)}</strong>
                <small>
                  {t.method ?? '—'} · {fmtDate(t.paidAt)} {fmtTime(t.paidAt)}
                  {t.isMock && ' · Mô phỏng'}
                  {t.gatewayMessage ? ` · ${t.gatewayMessage}` : ''}
                </small>
              </span>
              {t.type === 'REFUND' && (
                <span className={`badge ${meta.cls}`}><i />{meta.label}</span>
              )}
              {actionable && (
                <span className="adm-cashflow-actions">
                  <button className="button secondary" disabled={busyId === t.id}
                    onClick={() => act(t.id, 'retry')}>
                    Thử lại qua cổng
                  </button>
                  <button className="button secondary" disabled={busyId === t.id}
                    onClick={() => act(t.id, 'confirm')}>
                    Chốt đã hoàn
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {message && <p className="adm-error">{message}</p>}
      <p className="adm-field-note">
        Chờ hoàn = đã xác định khoản phải hoàn; Hoàn xong = cổng xác nhận hoặc Admin chốt tay.
        Dòng Mô phỏng là tiền giả lập, không trừ/chuyển tiền thật.
      </p>
    </section>
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
  const [showInvoice, setShowInvoice] = useState(false);

  /* Dọn class in ấn khi hộp thoại in đóng (kể cả bấm Hủy trong hộp
     thoại hệ thống) để giao diện không kẹt ở chế độ ẩn. */
  useEffect(() => {
    const done = () => document.body.classList.remove('printing-invoice');
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  function printInvoice() {
    document.body.classList.add('printing-invoice');
    window.setTimeout(() => window.print(), 60);
  }

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

  useEffect(() => {
    /* Mở lịch khác (kể cả mở lần 2 sau khi quay lại danh sách) phải xóa
       sạch dữ liệu/error/hộp thoại của lần xem trước. Nếu không, lúc tải
       lịch mới mà gặp lỗi, ngăn sẽ kẹt ở trạng thái nửa cũ nửa mới. */
    setData(null);
    setError('');
    setDialog(null);
    setShowInvoice(false);
    setLoading(true);
    load();
  }, [load]);

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
      <Drawer title="Chi tiết lịch hẹn" onClose={closeBookingDetail} width={660}>
        <div className="adm-ds">
          <div className="adm-skel adm-skel-panel" />
          <div className="adm-skel adm-skel-panel" />
          <div className="adm-skel adm-skel-panel" />
        </div>
      </Drawer>
    );
  }

  if (error || !data) {
    return (
      <Drawer title="Chi tiết lịch hẹn" onClose={closeBookingDetail} width={660}
        footer={(
          <div className="adm-drawer-actions">
            <button className="button secondary" onClick={closeBookingDetail}>Đóng</button>
          </div>
        )}>
        <p className="login-admin-error">{error || 'Lịch hẹn này không tồn tại hoặc đã không còn khả dụng.'}</p>
      </Drawer>
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

  const collected = data.paidAmount ?? 0;
  const remaining = Math.max(0, data.total - collected);

  return (
    <Drawer
      title={`Chi tiết lịch hẹn ${data.code}`}
      subtitle={`${data.customerName} · ${data.serviceName} · ${fmtDate(data.startsAt)} ${fmtTime(data.startsAt)}`}
      onClose={closeBookingDetail}
      width={660}
      footer={(
        <div className="adm-drawer-actions">
          <button className="button secondary" onClick={closeBookingDetail}>Đóng</button>
          {data.paymentStatus === 'PAID' && (
            <button className="button" onClick={() => setShowInvoice(true)}>
              <Icon name="card" /> In hóa đơn
            </button>
          )}
        </div>
      )}
    >
      {/* Hồ sơ lịch: dịch vụ + các nhãn trạng thái */}
      <div className="adm-dprofile">
        <Avatar name={data.serviceName} url={data.serviceImage} size={58} />
        <div className="adm-dprofile-copy">
          <h3>{data.serviceName}</h3>
          <p>{data.code} · {fmtTime(data.startsAt)} – {fmtTime(data.endsAt)}</p>
          <div className="adm-dprofile-tags">
            <StatusBadge status={data.status} />
            <PayBadge status={data.paymentStatus} />
            {data.source === 'WALK_IN'
              ? <span className="badge pending"><i />Khách Walk-in</span>
              : <span className="badge confirmed"><i />Mobile</span>}
          </div>
        </div>
      </div>

      {/* Dải tiền: ba con số thu ngân nhìn đầu tiên */}
      <div className="adm-dstats">
        <MiniStat tone="gold" icon="dollar" value={formatVND(data.total)} label="Tổng tiền" />
        <MiniStat tone="sage" icon="check" value={formatVND(collected)} label="Đã thu" />
        <MiniStat tone={remaining > 0 ? 'rose' : 'sage'} icon="card"
          value={formatVND(remaining)} label="Còn lại" />
      </div>

      {/* Thao tác hợp lệ với trạng thái hiện tại */}
      {!readOnly && (
        <section className="adm-dblock">
          <h4>Thao tác</h4>
          <div className="adm-dactions">
            {actions.map((item, index) => (
              <button key={item.key} disabled={busy}
                className={index === 0 ? 'button' : 'button secondary'}
                onClick={() => runAction(item.key)}>
                <Icon name={item.icon} /> {item.label}
              </button>
            ))}
          </div>
        </section>
      )}

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

      {/* Khách hàng */}
      <section className="adm-dblock">
        <h4>Thông tin khách hàng</h4>
        <div className="adm-dinfo">
          <Info icon="user" label="Tên khách" value={data.customerName} />
          <Info icon="phone" label="Số điện thoại" value={data.customerPhone} />
          <Info icon="email" label="Email" value={data.customerEmail} />
        </div>
        {data.customerId ? (
          <button className="button secondary adm-bd-full"
            onClick={() => openCustomerDetail(data.customerId!)}>
            Xem hồ sơ khách hàng →
          </button>
        ) : (
          <p className="adm-field-note">Khách Walk-in không có tài khoản nên không có hồ sơ để xem.</p>
        )}
      </section>

      {/* Dịch vụ và thời gian: phân biệt lúc dịch vụ kết thúc với lúc nhân
          viên hết bị chiếm lịch (buffer tính vào ca làm việc). */}
      <section className="adm-dblock">
        <h4>Thông tin dịch vụ</h4>
        <div className="adm-dinfo">
          <Info icon="tag" label="Danh mục" value={data.serviceCategory} />
          <Info icon="clock" label="Thời lượng" value={`${data.duration} phút`} />
          <Info icon="dollar" label="Giá tại lúc đặt" value={formatVND(data.price)} />
          <Info icon="pause" label="Buffer Time" value={`${data.bufferTime} phút`} />
          <Info icon="calendar" label="Bắt đầu" value={fmtTime(data.startsAt)} />
          <Info icon="check" label="Kết thúc dịch vụ" value={fmtTime(data.serviceEndsAt)} />
          <Info icon="schedule" label="Nhân viên bận đến" value={fmtTime(data.endsAt)} />
          <Info icon="info" label="Trạng thái dịch vụ" value={(
            <span className={`badge ${data.serviceStatus === 'ACTIVE' ? 'completed' : 'cancelled'}`}>
              <i />{data.serviceStatusText}
            </span>
          )} />
        </div>
        <p className="adm-field-note">
          Giá, thời lượng và buffer lấy từ lúc đặt lịch. Sau này cửa hàng
          đổi giá dịch vụ thì lịch này vẫn hiện đúng số tiền khách đã trả.
        </p>
      </section>

      {/* Nhân viên */}
      <section className="adm-dblock">
        <h4>Nhân viên thực hiện</h4>
        {data.staffId ? (
          <>
            <div className="adm-dprofile">
              <Avatar name={data.staffName ?? ''} url={data.staffAvatarUrl} size={58} />
              <div className="adm-dprofile-copy">
                <h3>{data.staffName}</h3>
                <p>
                  {[data.staffExperience != null ? `${data.staffExperience} năm kinh nghiệm` : null,
                    data.specialty,
                    data.staffRating != null
                      ? `${fmtRating(data.staffRating)} / 5 (${data.staffReviewCount} đánh giá)`
                      : 'chưa có đánh giá',
                    `Ca: ${data.shiftStart ? `${String(data.shiftStart).slice(0, 5)} – ${String(data.shiftEnd).slice(0, 5)}` : 'không có ca trong ngày này'}`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {data.availability?.ok && (
              <p className="adm-bd-ok">
                <Icon name="check" /> Nhân viên khả dụng cho khung giờ này.
              </p>
            )}
            <button className="button secondary adm-bd-full"
              onClick={() => dispatch({ type: 'view', view: 'admin-staff' })}>
              Xem nhân viên →
            </button>
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
      </section>

      {/* Yêu cầu của khách: ghi chú và ảnh mẫu gộp chung, chỉ xem */}
      <section className="adm-dblock">
        <h4>Yêu cầu của khách hàng</h4>
        <p className={data.note ? 'adm-bd-note' : 'adm-field-note'}>
          {data.note ?? 'Khách hàng không có ghi chú.'}
        </p>
        <ReferenceImages images={data.images} />
      </section>

      {/* Dịch vụ phát sinh */}
      <section className="adm-dblock">
        <h4>Dịch vụ phát sinh <em>{data.addons.length} món</em></h4>
        {data.addons.length === 0 ? (
          <p className="adm-field-note">Chưa có dịch vụ phát sinh.</p>
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="adm-stt">STT</th><th>Dịch vụ</th><th className="adm-cs-num">SL</th>
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
        <div className="adm-dinfo">
          <Info icon="tag" label="Dịch vụ chính" value={formatVND(data.price)} />
          <Info icon="plus" label="Add-on" value={formatVND(data.addonTotal)} />
          <Info icon="dollar" label="Tổng cộng" value={formatVND(data.total)} />
        </div>
      </section>

      {/* Thanh toán + nút In hóa đơn (chỉ khi đã PAID) */}
      <section className="adm-dblock">
        <h4>Thanh toán</h4>
        <div className="adm-dinfo">
          <Info icon="card" label="Trạng thái thanh toán" value={<PayBadge status={data.paymentStatus} />} />
          <Info icon="dollar" label="Tổng tiền" value={formatVND(data.total)} />
          {data.paymentId && <Info icon="tag" label="Mã thanh toán" value={`PAY${data.paymentId}`} />}
          {data.methodText && <Info icon="card" label="Phương thức" value={data.methodText} />}
          {data.paymentDate && (
            <Info icon="calendar" label="Ngày thanh toán"
              value={`${fmtDate(data.paymentDate)} ${fmtTime(data.paymentDate)}`} />
          )}
        </div>
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
        {data.paymentStatus === 'PAID' && (
          <button className="button adm-bd-full" style={{ marginTop: 8 }}
            onClick={() => setShowInvoice(true)}>
            <Icon name="card" /> In hóa đơn
          </button>
        )}
      </section>

      <CashflowSection transactions={data.transactions ?? []} onChanged={() => { load(); reload(); }} />

      {/* Đánh giá */}
      {data.status === 'COMPLETED' && (
        <section className="adm-dblock">
          <h4>Đánh giá của khách</h4>
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
        </section>
      )}

      {/* Tiến trình: chỉ hiện vị trí hiện tại, không bịa mốc thời gian. */}
      <section className="adm-dblock">
        <h4>Tiến trình lịch hẹn</h4>
        <BookingStatusFlow status={data.status} />
      </section>

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
      {readOnly && !['CANCELLED', 'NO_SHOW'].includes(data.status) && (
        <p className="adm-field-note">
          Lịch hẹn đã kết thúc nên chỉ xem, không thao tác thay đổi.
        </p>
      )}

      {/* Lịch sử */}
      <section className="adm-dblock">
        <h4>Lịch sử hoạt động</h4>
        <BookingTimeline events={data.events} />
      </section>

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

      {showInvoice && (
        <div className="invoice-print">
          <div className="invoice-overlay">
            <div className="invoice-actions no-print">
              <button className="button secondary" onClick={() => setShowInvoice(false)}>
                Đóng
              </button>
              <button className="button" onClick={printInvoice}>
                <Icon name="card" /> In ngay
              </button>
            </div>
            <BookingInvoice
              data={{
                code: data.code,
                receiptNo: data.receiptNo,
                startsAt: data.startsAt,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                staffName: data.staffName,
                serviceName: data.serviceName,
                duration: data.duration,
                price: data.price,
                addons: data.addons,
                addonTotal: data.addonTotal,
                total: data.total,
                paidAmount: data.paidAmount,
                paymentText: data.paymentText,
                methodText: data.methodText,
                paymentDate: data.paymentDate,
                transactions: data.transactions ?? [],
              }}
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}
