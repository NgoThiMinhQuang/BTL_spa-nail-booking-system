/* ===== Các hộp thoại xử lý lịch hẹn =====

   Mỗi hộp thoại gọi API rồi báo lý do thất bại nguyên văn từ server — vì
   nguyên nhân từ chối luôn do backend kiểm tra lại (nhân viên còn làm không,
   ca có mở không, khung giờ có trùng không) chứ không phải suy đoán ở client.
*/

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { fmtDate, fmtRating, fmtTime } from '../lib/utils';
import type { Booking } from '../store';

/* ------------------------------------------------------------------ */
/* Gọi API và hiển thị lỗi                                            */
/* ------------------------------------------------------------------ */
export async function sendBookingRequest(
  url: string, options: RequestInit,
): Promise<{ ok: true; data?: unknown } | { ok: false; message: string; reason?: string }> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        message: payload.reason ?? payload.message ?? 'Máy chủ không nhận yêu cầu.',
      };
    }
    /* Giữ lại data để hộp thoại đọc được nội dung kiểm tra (ví dụ POST
       availability luôn 200 kèm { data: { ok, reason, conflict } } — chỉ
       nhìn HTTP ok thì pre-check không bao giờ chặn được). */
    return { ok: true, data: (payload as { data?: unknown }).data };
  } catch {
    return { ok: false, message: 'Mất kết nối tới máy chủ. Vui lòng thử lại.' };
  }
}

/** Khung chung của mọi hộp thoại: nền mờ, tiêu đề, nội dung, chân nút. */
function Modal({
  title, icon, wide, children, onClose,
}: {
  title: string; icon: Parameters<typeof Icon>[0]['name'];
  wide?: boolean; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="adm-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`adm-modal${wide ? ' adm-modal-wide' : ''} adm-modal-booking`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3><Icon name={icon} /> {title}</h3>
        {children}
      </div>
    </div>
  );
}

/** Hàng "nhãn / giá trị" dùng trong phần xem chi tiết. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="adm-bk-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Xác nhận lịch (mục 29)                                           */
/* ------------------------------------------------------------------ */
export function ConfirmDialog({
  booking, onClose, onDone,
}: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState<{ reason: string; conflict: { id: string } | null } | null>(null);

  /* Hỏi backend trước xem còn xác nhận được không (mục 30). Lỗi hiện ngay
     trong hộp thoại thay vì mở hộp khác, để Admin thấy nguyên nhân. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await sendBookingRequest('/api/admin/bookings/availability', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: booking.id,
          serviceId: booking.serviceId,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
        }),
      });
      if (cancelled) return;
      if (!result.ok) {
        setBlocked({ reason: result.message, conflict: null });
        return;
      }
      /* POST availability luôn 200 kèm { data: { ok, reason, conflict } } —
         phải đọc data.ok chứ không đọc HTTP ok, nếu không pre-check này
         không bao giờ chặn được và nút Xác nhận vẫn bấm được. */
      const check = (result.data ?? {}) as { ok?: boolean; reason?: string; conflict?: { id: string } | null };
      if (check.ok === false) {
        setBlocked({ reason: check.reason ?? 'Lịch này không còn xác nhận được.', conflict: check.conflict ?? null });
      }
    })();
    return () => { cancelled = true; };
  }, [booking]);

  async function confirm() {
    setBusy(true);
    setError('');
    const result = await sendBookingRequest(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  }

  return (
    <Modal title="Xác nhận lịch hẹn" icon="calendarCheck" onClose={onClose}>
      <p className="adm-bk-lead">
        Xác nhận lịch <strong>{booking.code}</strong> cho khách{' '}
        <strong>{booking.customerName}</strong> vào lúc{' '}
        <strong>{fmtTime(booking.startsAt)}</strong> ngày{' '}
        <strong>{fmtDate(booking.startsAt)}</strong>?
      </p>

      {blocked && (
        <div className="adm-warn">
          <Icon name="ban" />
          <span>
            <strong>Không thể xác nhận lịch.</strong>
            {blocked.reason}
            {blocked.conflict && ` Lịch trùng: #${blocked.conflict.id}.`}
          </span>
        </div>
      )}
      {error && <p className="login-admin-error" role="alert">{error}</p>}

      <div className="adm-modal-foot">
        <button className="button secondary" onClick={onClose}>Quay lại</button>
        <button className="button" disabled={busy || Boolean(blocked)} onClick={confirm}>
          {busy ? 'Đang xác nhận…' : 'Xác nhận lịch'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Đổi nhân viên (mục 32, 33)                                       */
/* ------------------------------------------------------------------ */
interface StaffOption {
  id: string; name: string; specialty: string | null;
  rating: number | null; reviewCount: number; avatarUrl: string | null;
}

export function ChangeStaffDialog({
  booking, onClose, onDone,
}: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [available, setAvailable] = useState<StaffOption[]>([]);
  const [blocked, setBlocked] = useState<(StaffOption & { reason: string })[]>([]);
  const [picked, setPicked] = useState(booking.staffId ?? '');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* Danh sách do backend lọc sẵn: chỉ nhân viên ACTIVE, làm được dịch vụ này,
     có ca, không trùng lịch. Người không đủ điều kiện vẫn hiện nhưng ghi rõ
     lý do, thay vì giấu đi rồi bắt Admin tự đoán (mục 33). */
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      serviceId: booking.serviceId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      bookingId: booking.id,
    });
    (async () => {
      try {
        const response = await fetch(`/api/admin/bookings/availability?${params}`);
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) return setError(payload.message ?? 'Không tải được danh sách nhân viên.');
        setAvailable(payload.data.available);
        setBlocked(payload.data.blocked);
      } catch {
        if (!cancelled) setError('Mất kết nối tới máy chủ.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [booking]);

  async function apply() {
    setBusy(true);
    setError('');
    const result = await sendBookingRequest(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ staffId: picked || null }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  }

  return (
    <Modal title="Đổi nhân viên" icon="adminStaff" wide onClose={onClose}>
      <p className="adm-bk-lead">
        Nhân viên hiện tại: <strong>{booking.staffName ?? 'Chưa phân công'}</strong>
        {' · '}{available.length} nhân viên khả dụng
      </p>

      {loading && <div className="adm-skel adm-skel-row" />}
      {!loading && available.length === 0 && (
        <div className="adm-warn">
          <Icon name="ban" />
          <span><strong>Không còn nhân viên nào nhận lịch này.</strong>
            Kiểm tra lại ca làm việc hoặc đổi sang dịch vụ khác.</span>
        </div>
      )}

      <div className="adm-pick-list">
        {available.map((person) => (
          <label key={person.id} className={`adm-pick${picked === person.id ? ' is-on' : ''}`}>
            <input type="radio" name="staff" value={person.id}
              checked={picked === person.id}
              onChange={() => setPicked(person.id)} />
            <Avatar name={person.name} url={person.avatarUrl} size={32} />
            <span className="adm-pick-body">
              <strong>{person.name}</strong>
              <small>
                {booking.serviceName}
                {person.rating != null && ` · ${fmtRating(person.rating)} ★`}
              </small>
            </span>
          </label>
        ))}
        {blocked.map((person) => (
          <div key={person.id} className="adm-pick is-off">
            <Avatar name={person.name} url={person.avatarUrl} size={32} />
            <span className="adm-pick-body">
              <strong>{person.name}</strong>
              <small>{person.reason}</small>
            </span>
          </div>
        ))}
      </div>

      {error && <p className="login-admin-error" role="alert">{error}</p>}

      <div className="adm-modal-foot">
        <button className="button secondary" onClick={onClose}>Hủy</button>
        <button className="button" disabled={busy || !picked} onClick={apply}>
          {busy ? 'Đang đổi…' : 'Xác nhận thay đổi'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Đổi thời gian (mục 34)                                           */
/* ------------------------------------------------------------------ */
export function RescheduleDialog({
  booking, staffOptions, onClose, onDone,
}: {
  booking: Booking;
  /** Danh sách nhân viên đã có sẵn trong store, dùng để chọn kèm ngày. */
  staffOptions: { id: string; name: string; avatarUrl: string | null }[];
  onClose: () => void; onDone: () => void;
}) {
  const [staffId, setStaffId] = useState(booking.staffId ?? '');
  const [day, setDay] = useState(booking.startsAt.slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(booking.startsAt.slice(11, 16));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* Chỉ hỏi các khung giờ còn trống khi đã chọn đủ nhân viên và ngày. */
  useEffect(() => {
    if (!staffId || !day) { setSlots([]); return; }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      staffId, serviceId: booking.serviceId, day,
    });
    fetch(`/api/admin/bookings/free-slots?${params}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setSlots(data.data ?? []); setError(''); } })
      .catch(() => { if (!cancelled) setError('Không tải được khung giờ trống.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [staffId, day, booking.serviceId]);

  async function apply() {
    setBusy(true);
    setError('');
    const result = await sendBookingRequest(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ staffId: staffId || null, date: day, time }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  }

  return (
    <Modal title="Đổi thời gian" icon="calendar" wide onClose={onClose}>
      <dl className="adm-bk-list adm-bk-list-inline">
        <Row label="Ngày hiện tại">{fmtDate(booking.startsAt)}</Row>
        <Row label="Giờ hiện tại">{fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}</Row>
      </dl>

      <div className="adm-form-row">
        <label className="adm-field">
          <span>Nhân viên</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Chưa phân công</option>
            {staffOptions.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span>Ngày mới</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
      </div>

      <div className="adm-field">
        <span>Các giờ còn trống</span>
        {loading && <p className="adm-field-note">Đang tìm khung giờ trống…</p>}
        {!loading && !staffId && (
          <p className="adm-field-note">Chọn nhân viên trước để xem giờ trống.</p>
        )}
        {!loading && staffId && slots.length === 0 && (
          <p className="adm-field-note is-warn">
            Nhân viên này không còn khung giờ trống nào trong ngày đã chọn.
          </p>
        )}
        {!loading && slots.length > 0 && (
          <div className="adm-slots">
            {slots.map((slot) => (
              <button key={slot} className={time === slot ? 'is-on' : ''}
                onClick={() => setTime(slot)}>{slot}</button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="login-admin-error" role="alert">{error}</p>}

      <div className="adm-modal-foot">
        <button className="button secondary" onClick={onClose}>Hủy</button>
        <button className="button" disabled={busy || loading || slots.length === 0}
          onClick={apply}>
          {busy ? 'Đang đổi…' : 'Đổi lịch'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Hủy lịch (mục 36)                                                */
/* ------------------------------------------------------------------ */
export function CancelDialog({
  booking, onClose, onDone,
}: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    if (!reason.trim()) return setError('Vui lòng nhập lý do hủy.');
    setBusy(true);
    setError('');
    const result = await sendBookingRequest(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED', cancelReason: reason.trim() }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  }

  return (
    <Modal title="Hủy lịch hẹn" icon="ban" onClose={onClose}>
      <p className="adm-bk-lead">
        Bạn có chắc chắn muốn hủy lịch <strong>{booking.code}</strong>?
      </p>
      <dl className="adm-bk-list">
        <Row label="Khách hàng">{booking.customerName}</Row>
        <Row label="Dịch vụ">{booking.serviceName}</Row>
        <Row label="Thời gian">
          {fmtDate(booking.startsAt)} · {fmtTime(booking.startsAt)} –{' '}
          {fmtTime(booking.endsAt)}
        </Row>
      </dl>

      <label className="adm-field">
        <span>Lý do hủy (bắt buộc)</span>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(''); }}
          placeholder="Khách báo dời lịch, nhân viên nghỉ đột xuất…"
        />
      </label>
      {error && <p className="login-admin-error" role="alert">{error}</p>}

      <div className="adm-modal-foot">
        <button className="button secondary" onClick={onClose}>Không</button>
        <button className="button is-danger" disabled={busy} onClick={apply}>
          {busy ? 'Đang hủy…' : 'Xác nhận hủy'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Đánh dấu không đến (mục 37)                                     */
/* ------------------------------------------------------------------ */
export function NoShowDialog({
  booking, onClose, onDone,
}: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    setBusy(true);
    setError('');
    const result = await sendBookingRequest(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'NO_SHOW' }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  }

  return (
    <Modal title="Xác nhận khách không đến" icon="ban" onClose={onClose}>
      <p className="adm-bk-lead">
        Xác nhận khách không đến? Lịch <strong>{booking.code}</strong> sẽ được
        chuyển sang trạng thái <strong>Không đến</strong>.
      </p>
      <dl className="adm-bk-list">
        <Row label="Khách hàng">{booking.customerName}</Row>
        <Row label="Thời gian">
          {fmtDate(booking.startsAt)} · {fmtTime(booking.startsAt)}
        </Row>
      </dl>
      <p className="adm-field-note">
        Lịch sẽ được tính vào thống kê khách không đến.
      </p>
      {error && <p className="login-admin-error" role="alert">{error}</p>}

      <div className="adm-modal-foot">
        <button className="button secondary" onClick={onClose}>Quay lại</button>
        <button className="button is-danger" disabled={busy} onClick={apply}>
          {busy ? 'Đang đánh dấu…' : 'Xác nhận vắng mặt'}
        </button>
      </div>
    </Modal>
  );
}
