/* ===== Hộp thoại tạo lịch hẹn tại quầy (khách walk-in) =====

   Khách walk-in chưa có hồ sơ trong hệ thống nên có thể nhập thẳng họ tên và
   số điện thoại; backend tạo luôn user + customer rồi mới ghi booking. */

import { useState } from 'react';
import { Icon } from './Icon';
import { useApp } from '../store';
import { today } from '../store';

const TIME_SLOTS = Array.from({ length: 22 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export function WalkInDialog({
  onClose, onDone,
}: { onClose: () => void; onDone: () => void }) {
  const { state } = useApp();
  const { services, customers, staff } = state;

  const [customerId, setCustomerId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [day, setDay] = useState(today());
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /* Nhân viên chỉ nhận những dịch vụ bản thân thực hiện được. */
  const service = services.find((item) => item.id === serviceId);
  const eligibleStaff = service
    ? staff.filter((person) => service.staffNames.includes(person.name))
    : staff;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!serviceId) return setError('Vui lòng chọn dịch vụ.');
    if (!customerId && (!newName.trim() || !newPhone.trim())) {
      return setError('Chọn khách có sẵn hoặc nhập tên và số điện thoại của khách mới.');
    }

    setBusy(true);
    try {
      const response = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || undefined,
          newCustomer: customerId ? undefined : { name: newName.trim(), phone: newPhone.trim() },
          serviceId, staffId: staffId || null, day, time, note,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? 'Không tạo được lịch hẹn.');
        return;
      }
      onDone();
    } catch {
      setError('Mất kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  const field = { width: '100%', padding: '9px 11px', font: 'inherit', fontSize: 12.5 } as const;
  const label = { display: 'grid', gap: 5, fontSize: 12, color: 'var(--nh-muted)' } as const;

  return (
    <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
      onClick={onClose}>
      <div className="adm-modal adm-modal-form" onClick={(e) => e.stopPropagation()}>
        <h3><Icon name="calendarCheck" /> Tạo lịch hẹn tại quầy</h3>
        <p>Dành cho khách đến trực tiếp, không đặt qua ứng dụng.</p>

        <form onSubmit={submit} className="adm-form">
          <div className="adm-form-row">
            <label style={label}>
              <span>Khách hàng có sẵn</span>
              <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setNewName(''); setNewPhone(''); }}
                style={field}>
                <option value="">— Khách mới —</option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>
                ))}
              </select>
            </label>
            <label style={label}>
              <span>Dịch vụ</span>
              <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setStaffId(''); }}
                style={field} required>
                <option value="">Chọn dịch vụ…</option>
                {services.filter((item) => item.status === 'ACTIVE').map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>

          {!customerId && (
            <div className="adm-form-row">
              <label style={label}>
                <span>Tên khách mới</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nguyễn Thị Mai" style={field} />
              </label>
              <label style={label}>
                <span>Số điện thoại</span>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0900000000" style={field} inputMode="tel" />
              </label>
            </div>
          )}

          <div className="adm-form-row">
            <label style={label}>
              <span>Nhân viên phục vụ</span>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={field}>
                <option value="">Để phân công sau</option>
                {eligibleStaff.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            <label style={label}>
              <span>Ngày</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={field} />
            </label>
          </div>

          <div className="adm-form-row">
            <label style={label}>
              <span>Giờ bắt đầu</span>
              <select value={time} onChange={(e) => setTime(e.target.value)} style={field}>
                {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </label>
            <label style={label}>
              <span>Ghi chú</span>
              <input value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Khách yêu thích màu nude" style={field} />
            </label>
          </div>

          {service && (
            <p className="adm-form-note">
              {service.name} · {service.duration} phút
              {service.bufferTime > 0 && ` + ${service.bufferTime} phút dọn dẹp`}
              {' · '}{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
                .format(service.price)}
            </p>
          )}

          {error && <p className="login-admin-error" role="alert">{error}</p>}

          <div className="adm-modal-foot">
            <button type="button" className="button secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="button" disabled={busy}>
              {busy ? 'Đang tạo…' : 'Tạo lịch hẹn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
