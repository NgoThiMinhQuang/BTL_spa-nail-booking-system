/* ===== Khung chi tiết một lịch hẹn =====

   Mở từ cột Mã lịch. Ngoài thông tin lịch còn cho thêm/xoá dịch vụ phát
   sinh ngay tại chỗ, vì tổng tiền của lịch là tổng của dịch vụ chính cộng
   các dịch vụ phát sinh. */

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { StatusBadge } from './Primitives';
import { sendBookingRequest } from './BookingDialogs';
import { fmtDate, fmtRating, fmtTime, formatVND } from '../lib/utils';

interface Addon {
  id: string; name: string; quantity: number; price: number; duration: number;
}

interface Detail {
  id: string; code: string;
  startsAt: string; endsAt: string;
  status: string; statusText: string;
  note: string | null; source: string; sourceText: string;
  cancelReason: string | null; cancelledAt: string | null;
  serviceId: string; serviceName: string; duration: number; price: number;
  customerName: string; customerPhone: string; customerEmail: string | null;
  staffId: string | null; staffName: string | null;
  paymentStatus: string | null; paymentText: string | null;
  methodText: string | null; paidAmount: number | null; paymentDate: string | null;
  addonTotal: number; total: number;
  addons: Addon[];
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="adm-bk-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

export function BookingDetail({
  bookingId, services, onClose, onChanged,
}: {
  bookingId: string;
  services: { id: string; name: string; price: number }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`);
      const payload = await response.json();
      if (!response.ok) return setError(payload.message ?? 'Không tải được chi tiết lịch hẹn.');
      setData(payload.data);
      setError('');
    } catch {
      setError('Mất kết nối tới máy chủ.');
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  async function addAddon(serviceId: string) {
    if (!serviceId) return;
    setBusy(true);
    const result = await sendBookingRequest(`/api/admin/bookings/${bookingId}/addons`, {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    });
    setBusy(false);
    if (result.ok) { setPicking(''); await load(); onChanged(); } else setError(result.message);
  }

  async function removeAddon(addonId: string) {
    setBusy(true);
    const result = await sendBookingRequest(
      `/api/admin/bookings/${bookingId}/addons/${addonId}`, { method: 'DELETE' });
    setBusy(false);
    if (result.ok) { await load(); onChanged(); } else setError(result.message);
  }

  const locked = data ? ['CANCELLED', 'NO_SHOW'].includes(data.status) : false;
  const available = services.filter((service) =>
    service.id !== data?.serviceId && !data?.addons.some((addon) => addon.id === service.id));

  return (
    <div className="adm-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="adm-modal adm-modal-booking adm-modal-detail" onClick={(e) => e.stopPropagation()}>
        <div className="adm-bk-detail-head">
          <div>
            <span className="adm-tag">Chi tiết lịch hẹn</span>
            <h3>{data?.code ?? '…'}</h3>
          </div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Đóng">
            <Icon name="ban" />
          </button>
        </div>

        {error && <p className="login-admin-error" role="alert">{error}</p>}

        {!data && !error && <div className="adm-skel adm-skel-panel" />}

        {data && (
          <>
            {data.status === 'CANCELLED' && (
              <div className="adm-warn">
                <Icon name="ban" />
                <span>
                  <strong>Lịch đã hủy{data.cancelledAt ? ` · ${fmtDate(data.cancelledAt)}` : ''}.</strong>
                  {data.cancelReason ?? 'Không có lý do được ghi nhận.'}
                </span>
              </div>
            )}

            <div className="adm-bk-columns">
              <div>
                <h4>Lịch hẹn</h4>
                <dl className="adm-bk-list">
                  <Row label="Ngày">{fmtDate(data.startsAt)}</Row>
                  <Row label="Thời gian">{fmtTime(data.startsAt)} – {fmtTime(data.endsAt)}</Row>
                  <Row label="Trạng thái"><StatusBadge status={data.status} /></Row>
                  <Row label="Nguồn">{data.sourceText}</Row>
                  <Row label="Nhân viên">{data.staffName ?? 'Chưa phân công'}</Row>
                  <Row label="Ghi chú">{data.note ?? '—'}</Row>
                </dl>
              </div>

              <div>
                <h4>Khách hàng</h4>
                <dl className="adm-bk-list">
                  <Row label="Họ tên">
                    <span className="adm-cell-name">
                      <Avatar name={data.customerName} url={null} size={26} />
                      <span style={{ minWidth: 0 }}><strong>{data.customerName}</strong></span>
                    </span>
                  </Row>
                  <Row label="Điện thoại">{data.customerPhone}</Row>
                  {data.customerEmail && <Row label="Email">{data.customerEmail}</Row>}
                </dl>
              </div>
            </div>

            {/* Dịch vụ phát sinh */}
            <h4>Dịch vụ phát sinh</h4>
            <div className="adm-bk-addons">
              {data.addons.length === 0
                ? <p className="adm-field-note">Lịch này chưa có dịch vụ phát sinh.</p>
                : data.addons.map((addon) => (
                  <div key={addon.id} className="adm-bk-addon">
                    <span>
                      <strong>{addon.name}</strong>
                      <small>{formatVND(addon.price)}</small>
                    </span>
                    <button className="adm-icon-btn" disabled={busy || locked}
                      aria-label={`Bỏ ${addon.name}`}
                      onClick={() => removeAddon(addon.id)}>
                      <Icon name="trash" />
                    </button>
                  </div>
                ))}
            </div>

            {!locked && (
              <div className="adm-field">
                <span>Thêm dịch vụ phát sinh</span>
                <select value={picking} disabled={busy || available.length === 0}
                  onChange={(e) => setPicking(e.target.value)}>
                  <option value="">
                    {available.length === 0 ? 'Không còn dịch vụ nào để thêm' : 'Chọn dịch vụ…'}
                  </option>
                  {available.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {formatVND(service.price)}
                    </option>
                  ))}
                </select>
                <button className="button secondary adm-bk-addon-btn" disabled={busy || !picking}
                  onClick={() => addAddon(picking)}>
                  <Icon name="plus" /> Thêm vào lịch
                </button>
              </div>
            )}

            {/* Tổng tiền */}
            <div className="adm-bk-total">
              <Row label={`Dịch vụ chính · ${data.serviceName}`}>
                {formatVND(data.price)}
              </Row>
              <Row label="Dịch vụ phát sinh">{formatVND(data.addonTotal)}</Row>
              <Row label="Tổng cộng"><strong>{formatVND(data.total)}</strong></Row>
            </div>

            {/* Thanh toán */}
            <h4>Thanh toán</h4>
            <dl className="adm-bk-list">
              <Row label="Trạng thái">
                {data.paymentText
                  ? <span className={`badge ${data.paymentStatus === 'PAID' ? 'completed'
                    : data.paymentStatus === 'DEPOSITED' ? 'pending' : 'cancelled'}`}>
                    <i />{data.paymentText}
                  </span>
                  : <span className="adm-none">Chưa ghi nhận thanh toán</span>}
              </Row>
              {data.methodText && <Row label="Hình thức">{data.methodText}</Row>}
              {data.paidAmount != null && <Row label="Số tiền">{formatVND(data.paidAmount)}</Row>}
            </dl>

            {data.review && (
              <>
                <h4>Đánh giá</h4>
                <div className="adm-bk-review">
                  <span className="adm-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={n <= data.review!.rating ? 'is-on' : ''}>★</span>
                    ))}
                  </span>
                  <strong>{fmtRating(data.review.rating)} / 5</strong>
                  {data.review.comment && <p>{data.review.comment}</p>}
                </div>
              </>
            )}

            <div className="adm-modal-foot">
              <button className="button secondary" onClick={onClose}>Đóng</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
