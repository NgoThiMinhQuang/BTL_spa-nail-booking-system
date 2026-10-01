/* ===== Hộp điều chỉnh lịch hẹn =====

   Trượt ra từ bên phải thay vì hộp thoại nhỏ ở giữa, vì đây là hộp có
   nhiều trường và cần ngay nhìn thấy lịch đang sửa.

   Nguyên tắc quan trọng: mỗi lần đổi nhân viên hoặc giờ đều hỏi lại
   backend xem người đó có nhận lịch được không, và nút Lưu bị khoá khi
   chưa hợp lệ. Chỉ kiểm ở giao diện thì Admin vẫn bấm Lưu rồi mới biết
   là xung đột. Backend cũng kiểm lại lần nữa lúc lưu. */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Drawer } from './Drawer';
import { fmtDate, fmtTime } from '../lib/utils';
import { sendBookingRequest } from './BookingDialogs';
import type { Booking } from '../store';

interface StaffOption { id: string; name: string; avatarUrl: string | null }

interface Check {
  state: 'idle' | 'checking' | 'ok' | 'no';
  reason?: string;
}

export function AdjustBookingDrawer({
  booking, duration, bufferTime, staffOptions, actorName, onClose, onDone,
}: {
  booking: Booking;
  /** Thời lượng và buffer lấy từ snapshot của lịch, để mốc tính ra khớp
      với dữ liệu đã đặt chứ không phải giá trị s��n dụng hiện tại. */
  duration: number;
  bufferTime: number;
  staffOptions: StaffOption[];
  actorName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [staffId, setStaffId] = useState(booking.staffId ?? '');
  const [day, setDay] = useState(booking.startsAt.slice(0, 10));
  const [time, setTime] = useState(booking.startsAt.slice(11, 16));
  const [slots, setSlots] = useState<string[]>([]);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* Tổng thời gian nhân viên bị chiếm: dịch vụ cộng buffer. */
  const totalMinutes = duration + bufferTime;

  /* Danh sách khung giờ còn trống của nhân viên trong ngày đã chọn. */
  useEffect(() => {
    if (!staffId || !day) { setSlots([]); return; }
    let cancelled = false;

    const params = new URLSearchParams({ staffId, serviceId: booking.serviceId, day });
    fetch(`/api/admin/bookings/free-slots?${params}`)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const list: string[] = payload.data ?? [];
        setSlots(list);
        /* Giờ đang chọn không còn khả dụng thì nhảy sang giờ trống đầu tiên,
           để Admin không phải tự tìm. */
        if (!list.includes(time)) setTime(list[0] ?? '');
      })
      .catch(() => { if (!cancelled) setSlots([]); });

    return () => { cancelled = true; };
  }, [staffId, day, booking.serviceId]);

  /* Hỏi backend người vừa chọn có nhận lịch ở khung giờ này được không.
     Dùng danh sách khả dụng thay vì kiểm tra lịch hiện tại, vì người chọn
     trong hộp này có thể khác người đang được gán. */
  useEffect(() => {
    if (!staffId || !time || !day) { setCheck({ state: 'idle' }); return; }
    let cancelled = false;
    setCheck({ state: 'checking' });

    const start = new Date(`${day}T${time}:00`);
    const params = new URLSearchParams({
      serviceId: booking.serviceId,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + totalMinutes * 60000).toISOString(),
      bookingId: booking.id,
    });

    fetch(`/api/admin/bookings/availability?${params}`)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const blocked = (payload.data?.blocked ?? []) as { id: string; reason: string }[];
        const mine = blocked.find((item) => item.id === staffId);
        if (mine) setCheck({ state: 'no', reason: mine.reason });
        else if ((payload.data?.available ?? []).some((item: { id: string }) => item.id === staffId)) {
          setCheck({ state: 'ok' });
        } else {
          setCheck({ state: 'no', reason: 'Khung giờ này không còn khả dụng.' });
        }
      })
      .catch(() => { if (!cancelled) setCheck({ state: 'no', reason: 'Không kiểm tra được khung giờ.' }); });

    return () => { cancelled = true; };
  }, [staffId, day, time, booking.id, booking.serviceId, totalMinutes]);

  const canSave = Boolean(staffId && day && time
    && check.state === 'ok' && !busy);

  async function save() {
    setBusy(true);
    setError('');
    const result = await sendBookingRequest(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ staffId: staffId || null, date: day, time, actorName }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  }

  const startAt = time ? new Date(`${day}T${time}:00`) : null;
  const serviceEnds = startAt ? new Date(startAt.getTime() + duration * 60000) : null;
  const occupiedUntil = startAt ? new Date(startAt.getTime() + totalMinutes * 60000) : null;

  return (
    <Drawer
      title="Điều chỉnh lịch hẹn"
      subtitle={`${booking.code} · ${booking.customerName}`}
      onClose={onClose}
      width={560}
      footer={(
        <div className="adm-drawer-actions">
          <button className="button secondary" onClick={onClose}>Hủy thay đổi</button>
          <button className="button" disabled={!canSave} onClick={save}>
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      )}
    >
      <div className="adm-adj">
        <p className="adm-adj-now">
          Hiện tại: {fmtDate(booking.startsAt)} · {fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}
        </p>

        {/* Dịch vụ không cho đổi ở màn hình này: đổi dịch vụ sẽ làm sai
            giá khách đã trả nên cần nghiệp vụ riêng. */}
        <label className="adm-field">
          <span>Dịch vụ</span>
          <input value={booking.serviceName} readOnly disabled />
        </label>

        <label className="adm-field">
          <span>Nhân viên *</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Chưa phân công</option>
            {staffOptions.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>

        <label className="adm-field">
          <span>Ngày *</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>

        <label className="adm-field">
          <span>Giờ bắt đầu *</span>
          {!staffId && <p className="adm-field-note">Chọn nhân viên để xem giờ trống.</p>}
          {staffId && slots.length === 0 && (
            <p className="adm-field-note is-warn">
              Nhân viên này không còn khung giờ trống nào trong ngày đã chọn.
            </p>
          )}
          {staffId && slots.length > 0 && (
            <div className="adm-slots">
              {slots.map((slot) => (
                <button key={slot} className={time === slot ? 'is-on' : ''}
                  onClick={() => setTime(slot)}>{slot}</button>
              ))}
            </div>
          )}
        </label>

        {/* Số liệu chỉ đọc, tách rõ mốc hết dịch vụ với mốc hết chiếm lịch. */}
        <div className="adm-adj-read">
          <div><small>Thời lượng</small><strong>{duration} phút</strong></div>
          <div><small>Buffer</small><strong>{bufferTime} phút</strong></div>
          <div>
            <small>Dự kiến kết thúc dịch vụ</small>
            <strong>{serviceEnds ? fmtTime(serviceEnds.toISOString()) : '—'}</strong>
          </div>
          <div>
            <small>Chiếm lịch đến</small>
            <strong>{occupiedUntil ? fmtTime(occupiedUntil.toISOString()) : '—'}</strong>
          </div>
        </div>

        {check.state === 'checking' && (
          <div className="adm-adj-check"><Icon name="clock" /><span>Đang kiểm tra khung giờ…</span></div>
        )}
        {check.state === 'ok' && (
          <div className="adm-adj-check is-ok"><Icon name="check" /><span>Khung giờ khả dụng.</span></div>
        )}
        {check.state === 'no' && (
          <div className="adm-adj-check is-no">
            <Icon name="ban" />
            <span>{check.reason} Vui lòng điều chỉnh lịch hẹn.</span>
          </div>
        )}

        {error && <p className="login-admin-error" role="alert">{error}</p>}
      </div>
    </Drawer>
  );
}