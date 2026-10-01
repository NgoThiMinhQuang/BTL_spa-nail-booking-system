/* ==========================================================================
   HỘP TẠO LỊCH KHÁCH WALK-IN
   ==========================================================================

   Khách đến trực tiếp cửa hàng, không đặt qua ứng dụng. Lịch tạo ra vẫn
   đi vào bảng `booking` với nguồn WALK_IN, dùng CHUNG bộ luật khả dụng với
   lịch đặt từ ứng dụng: cùng ca làm việc, cùng chuyên môn dịch vụ, cùng
   tính thời gian dọn dẹp (buffer). Không có một đường kiểm tra riêng cho
   walk-in — nếu có, hai đường sớm muộn sẽ cho ra hai kết quả khác nhau.

   Ba nguyên tắc dẫn đến cách bố trí bốn khối bên dưới:

     1. Số điện thoại đứng trước tên. Nếu lấy tên trước thì mỗi lần gõ
        lại tên là một lần nhập sai. Nhập số điện thoại xong hệ thống tìm
        hồ sơ sẵn có: thấy có thì khách đã có, không có mới hiện ô tên.

     2. Thứ tự chọn là Dịch vụ → Ngày → Nhân viên → Khung giờ. Chọn dịch
        vụ trước để danh sách nhân viên chỉ còn người thực hiện được dịch
        vụ đó, thay vì hiện cả tiệm rồi khoá từng dòng.

     3. Khung giờ lấy từ backend mỗi khi dịch vụ / ngày / nhân viên đổi.
        Giao diện không tự tính lịch trống, vì tính sai một lần là tạo
        nhầm lịch cho khách đang đứng tại quầy.

   Giao diện chỉ kiểm tra để báo sớm; lúc bấm "Tạo lịch hẹn", backend kiểm
   lại và giữ chỗ trong giao dịch, nên khung giờ vừa bị khách ứng dụng lấy mất
   sẽ báo lỗi chứ không tạo ra hai lịch trùng nhau. */

import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Drawer } from './Drawer';
import { Avatar } from './Avatar';
import { money } from '../lib/utils';
import { customerHash, today, useApp } from '../store';

/* ---- Kiểu dữ liệu trả về từ các đường dẫn walk-in ---- */

interface FoundCustomer {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
}

interface EligibleStaff {
  id: string;
  name: string;
  avatarUrl: string | null;
  specialty: string | null;
  experienceYears: number;
  rating: number | null;
  /** Số khung giờ còn trống, backend đếm sẵn để giao diện không phải tự đo. */
  slotCount?: number;
}

/** ANY_STAFF là giá trị riêng, không trùng với mã nhân viên nào. */
const ANY_STAFF = 'any';

/* ---- Kiểm tra số điện thoại ----
   Dùng đúng bộ quy tắc backend dùng khi tra cứu, nếu không sẽ có lúc giao
   diện báo hợp lệ rồi backend trả lỗi. */
export function normalisePhone(value: string): string {
  const digits = value.replace(/[\s.\-()]/g, '');
  if (/^\+?84\d{9}$/.test(digits)) return `0${digits.slice(-9)}`;
  return digits;
}

export function isValidPhone(value: string): boolean {
  return /^0\d{9}$/.test(normalisePhone(value));
}

/** "09:30" → số phút kể từ đầu ngày. */
function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function minutesToClock(total: number): string {
  const h = Math.floor(total / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Định dạng ngày theo kiểu Việt Nam: 01/10/2026 */
function ddmmyyyy(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/** Ngày kế tiếp, dùng cho nút "Chọn ngày khác" khi hôm nay đã kín. */
function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dom = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dom}`;
}

/** Buổi sáng / chiều / tối: chia khung giờ thành từng hàng cho dễ đọc. */
const PERIODS: { label: string; from: number; to: number }[] = [
  { label: 'Buổi sáng', from: 0, to: 12 * 60 },
  { label: 'Buổi chiều', from: 12 * 60, to: 18 * 60 },
  { label: 'Buổi tối', from: 18 * 60, to: 24 * 60 },
];

export interface WalkInResult {
  id: string;
  code: string;
  customerId: string | null;
  guestName: string | null;
}

export function WalkInDrawer({
  actorName, onClose, onDone,
}: {
  actorName: string;
  onClose: () => void;
  onDone: (result: WalkInResult) => void;
}) {
  /* Danh mục dịch vụ lấy từ kho dữ liệu dùng chung, không gọi lại API: hai
     nơi cùng nạp thì dễ lệch nhau khi một bên được làm mới. */
  const { state } = useApp();
  const activeServices = useMemo(
    () => state.services.filter((item) => item.status === 'ACTIVE'),
    [state.services],
  );

  /* ---- Khách ---- */
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<FoundCustomer | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneSearched, setPhoneSearched] = useState(false);
  const [guestName, setGuestName] = useState('');

  /* ---- Dịch vụ → ngày → nhân viên → khung giờ ---- */
  const [serviceId, setServiceId] = useState('');
  const [day, setDay] = useState(today);
  const [staffChoice, setStaffChoice] = useState(ANY_STAFF);
  const [candidates, setCandidates] = useState<EligibleStaff[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState('');

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Lỗi do khung giờ vừa bị lấy: giữ nguyên form, chỉ bỏ giờ đang chọn. */
  const [conflict, setConflict] = useState('');
  /** Tăng lên khi cần nạp lại khả dụng thật, không phải dựa vào dữ liệu cũ. */
  const [refreshKey, setRefreshKey] = useState(0);

  const service = activeServices.find((item) => item.id === serviceId) ?? null;
  const chosenStaff = candidates.find((item) => item.id === staffChoice) ?? null;

  /* Mỗi lần đổi dịch vụ, ngày hoặc nhân viên thì giờ đang chọn có thể không
     còn hợp lệ. Bỏ luôn thay vì giữ lại rồi báo lỗi: giá trị cũ chỉ gây
     hiểu nhầm rằng lịch sắp tạo vẫn ở giờ đó. */
  useEffect(() => { setTime(''); }, [serviceId, day, staffChoice]);

  /* Đổi dịch vụ hoặc ngày có thể làm người đang chọn không còn khung giờ nào,
     lúc đó backend đã loại họ khỏi danh sách. Giữ mã cũ lại sẽ ra một ô
     chọn không khớp với danh sách, nên quay về "bất kỳ ai phù hợp" — vẫn là
     một lựa chọn hợp lệ thay vì bắt Admin đoán. */
useEffect(() => {
  if (staffChoice === ANY_STAFF || loadingStaff) return;
  if (candidates.length && !candidates.some((item) => item.id === staffChoice)) {
    setStaffChoice(ANY_STAFF);
  }
}, [candidates, staffChoice, loadingStaff]);

/* ---- Tìm khách theo số điện thoại ----
     Chờ ngừng gõ khoảng 400 ms rồi mới hỏi. Gõ "0910" sẽ hỏi tới bốn lần mà
     không lần nào trả lời đúng; chờ im thì chỉ hỏi một lần, lúc đó số điện
     thoại gần như đã xong. */
  useEffect(() => {
    const clean = normalisePhone(phone);
    if (!isValidPhone(clean)) {
      setCustomer(null);
      setPhoneSearched(false);
      setCheckingPhone(false);
      return;
    }
    let cancelled = false;
    setCheckingPhone(true);

    const timer = setTimeout(() => {
      fetch(`/api/admin/walkin/customer?phone=${encodeURIComponent(clean)}`)
        .then((r) => (r.ok ? r.json() : { data: null }))
        .then((payload: { data: FoundCustomer | null }) => {
          if (cancelled) return;
          setCustomer(payload.data);
          setPhoneSearched(true);
        })
        .catch(() => { if (!cancelled) { setCustomer(null); setPhoneSearched(true); } })
        .finally(() => { if (!cancelled) setCheckingPhone(false); });
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [phone]);

  /* Đổi số điện thoại thì tên khách vãng lai cũ không còn liên quan. */
  useEffect(() => { setGuestName(''); }, [phone]);

  /* ---- Nhân viên làm được dịch vụ và còn ca trong ngày ----
     `freeOnly` đã lọc sẵn cả những người không còn khung giờ nào trống, để
     Admin không phải mở ra rồi thấy trống. */
  useEffect(() => {
    if (!serviceId || !day) { setCandidates([]); return; }
    let cancelled = false;
    setLoadingStaff(true);

    const params = new URLSearchParams({ serviceId, day, freeOnly: '1' });
    fetch(`/api/admin/walkin/staff?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((payload: { data: EligibleStaff[] }) => {
        if (!cancelled) setCandidates(payload.data ?? []);
      })
      .catch(() => { if (!cancelled) setCandidates([]); })
      .finally(() => { if (!cancelled) setLoadingStaff(false); });

    return () => { cancelled = true; };
  }, [serviceId, day, refreshKey]);

  /* ---- Khung giờ khả dụng ----
     Không truyền staffId thì lấy giờ mà bất kỳ ứng viên nào cũng nhận được,
     tức là lựa chọn "Bất kỳ nhân viên phù hợp". Người thật sự nhận lịch do
     backend quyết lúc tạo, vì đó mới là lúc giữ chỗ thật. */
  useEffect(() => {
    if (!serviceId || !day) { setSlots([]); return; }
    let cancelled = false;
    setLoadingSlots(true);

    const params = new URLSearchParams({ serviceId, day });
    if (staffChoice !== ANY_STAFF) params.set('staffId', staffChoice);

    fetch(`/api/admin/walkin/slots?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((payload: { data: string[] }) => {
        if (!cancelled) setSlots(payload.data ?? []);
      })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });

    return () => { cancelled = true; };
  }, [serviceId, day, staffChoice, refreshKey]);

  /* ---- Điều kiện cho phép bấm "Tạo lịch hẹn" ---- */
  const phoneOk = isValidPhone(phone);
  const guestOk = Boolean(customer) || guestName.trim().length > 0;
  const canSubmit = phoneOk && guestOk && Boolean(service) && Boolean(time) && !busy;

  /* Mốc thời gian: dịch vụ kết thúc và nhân viên rảnh tay là hai mốc khác
     nhau. Buffer không cộng vào thời gian khách thấy, nhưng vẫn phải tính khi
     xét khung giờ kế tiếp — người sau không được bắt đầu sớm hơn. */
  const endsAt = service && time ? minutesToClock(timeToMinutes(time) + service.duration) : '';
  const freeAt = service && time
    ? minutesToClock(timeToMinutes(time) + service.duration + service.bufferTime)
    : '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setConflict('');

    try {
      const response = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          /* Có hồ sơ thì dùng lại. Không có thì đây là khách vãng lai: KHÔNG
             tạo tài khoản, KHÔNG tạo mật khẩu, tên và số điện thoại nằm
             ngay trên lịch. */
          customerId: customer?.id,
          guestName: customer ? undefined : guestName.trim(),
          guestPhone: customer ? undefined : normalisePhone(phone),
          serviceId,
          staffId: staffChoice === ANY_STAFF ? null : staffChoice,
          day,
          time,
          note: note.trim(),
          actorName,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        /* 409 là tranh chỗ: giữ nguyên khách, dịch vụ, ngày, nhân viên và ghi
           chú. Chỉ bỏ giờ vừa bị lấy và nạp lại khung giờ, để Admin không phải
           gõ lại cả form. */
        if (response.status === 409) {
          setConflict(payload.message ?? 'Khung giờ vừa được đặt.');
          setTime('');
          /* Nạp lại khả dụng thật chứ không lọc tại chỗ: giờ đó chỉ là giờ
             Admin vừa thấy, backend mới là nơi biết còn bao nhiêu chỗ trống. */
          setRefreshKey((key) => key + 1);
        } else {
          setError(payload.message ?? 'Không tạo được lịch hẹn.');
        }
        return;
      }

      onDone({
        id: String(payload.data.id),
        code: payload.data.code,
        customerId: payload.data.customerId,
        guestName: payload.data.guestName,
      });
    } catch {
      setError('Mất kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  /* Sắp khung giờ theo buổi để Admin không phải dò giữa hai chục ô. */
  const grouped = PERIODS
    .map((period) => ({
      label: period.label,
      items: slots.filter((slot) => {
        const m = timeToMinutes(slot);
        return m >= period.from && m < period.to;
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Drawer
      title="Tạo lịch khách Walk-in"
      subtitle="Tạo lịch hẹn cho khách đến trực tiếp cửa hàng."
      onClose={onClose}
      width={640}
      footer={(
        <div className="adm-drawer-actions">
          <button type="button" className="button secondary" onClick={onClose}>Hủy</button>
          {/* Nút nằm ở chân khung, ngoài thẻ form, nên phải trỏ ngược lại bằng
              thuộc tính form — bấm ở đây vẫn chạy đúng kiểm tra của form. */}
          <button type="submit" form="walkin-form" className="button" disabled={!canSubmit}>
            {busy ? 'Đang tạo…' : 'Tạo lịch hẹn'}
          </button>
        </div>
      )}
    >
      <form id="walkin-form" className="adm-walkin" onSubmit={submit}>
        {/* ---------- 1. Thông tin khách hàng ---------- */}
        <section className="adm-walkin-block">
          <h3>Thông tin khách hàng</h3>

          <label className="adm-field">
            <span>Số điện thoại *</span>
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setConflict(''); }}
              placeholder="Nhập số điện thoại khách hàng"
              inputMode="tel"
              autoComplete="off"
            />
          </label>
          {phone.length > 0 && !phoneOk && (
            <p className="adm-field-note is-warn">
              Số điện thoại phải gồm 10 số và bắt đầu bằng 0.
            </p>
          )}
          {checkingPhone && <p className="adm-field-note">Đang tìm khách hàng…</p>}

          {/* Tìm thấy: dùng lại hồ sơ, không hỏi tên nữa. */}
          {customer && (
            <div className="adm-walkin-found">
              <p className="adm-walkin-found-title">
                <Icon name="check" /> Đã tìm thấy khách hàng
              </p>
              <div className="adm-walkin-found-body">
                <Avatar name={customer.name} url={customer.avatarUrl} />
                <div className="adm-walkin-found-copy">
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.phone}
                    {customer.email ? ` · ${customer.email}` : ''}
                  </small>
                </div>
                <code>{customer.code}</code>
              </div>
              {/* Mở tab mới để không mất những gì đang nhập. */}
              <a className="adm-link adm-walkin-found-link" href={customerHash(customer.id)}
                target="_blank" rel="noreferrer">
                Xem hồ sơ khách hàng
              </a>
            </div>
          )}

          {/* Không có hồ sơ: lịch gắn tên ngay trên lịch, không sinh tài
              khoản. Nói rõ điều này để Admin không tưởng đã tạo khách mới. */}
          {phoneOk && !checkingPhone && phoneSearched && !customer && (
            <div className="adm-walkin-none">
              <p>
                Không tìm thấy tài khoản khách hàng. Lịch này sẽ được tạo dưới
                dạng khách Walk-in.
              </p>
              <label className="adm-field">
                <span>Tên khách *</span>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Nhập tên khách hàng"
                  autoComplete="off"
                />
              </label>
            </div>
          )}
        </section>

        {/* ---------- 2. Dịch vụ ---------- */}
        <section className="adm-walkin-block">
          <h3>Dịch vụ</h3>

          <label className="adm-field">
            <span>Dịch vụ *</span>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Chọn dịch vụ</option>
              {/* Chỉ dịch vụ còn hoạt động mới nhận khách tại quầy. */}
              {activeServices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {money(item.price)} · {item.duration} phút
                </option>
              ))}
            </select>
          </label>

          {service && (
            <div className="adm-walkin-svc">
              <strong>{service.name}</strong>
              <span>
                Giá: {money(service.price)} · Thời lượng: {service.duration} phút ·
                Buffer: {service.bufferTime} phút
              </span>
            </div>
          )}
        </section>

        {/* ---------- 3. Nhân viên & thời gian ---------- */}
        <section className="adm-walkin-block">
          <h3>Nhân viên &amp; thời gian</h3>

          <label className="adm-field">
            <span>Ngày *</span>
            <input
              type="date"
              value={day}
              min={today()}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>

          <label className="adm-field">
            <span>Nhân viên *</span>
            {!serviceId && (
              <p className="adm-field-note">Chọn dịch vụ trước để xem nhân viên phù hợp.</p>
            )}
            {serviceId && (
              <select
                value={staffChoice}
                onChange={(e) => setStaffChoice(e.target.value)}
                disabled={loadingStaff}
              >
                <option value={ANY_STAFF}>Bất kỳ nhân viên phù hợp</option>
                {candidates.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.rating != null ? ` · ${String(person.rating).replace('.', ',')} ★` : ''}
                    {person.slotCount != null ? ` · còn ${person.slotCount} khung giờ` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>

          {chosenStaff && (
            <div className="adm-walkin-staff">
              <Avatar name={chosenStaff.name} url={chosenStaff.avatarUrl} />
              <div>
                <strong>{chosenStaff.name}</strong>
                <small>
                  {chosenStaff.experienceYears} năm kinh nghiệm
                  {chosenStaff.rating != null
                    ? ` · ${String(chosenStaff.rating).replace('.', ',')} ★`
                    : ''}
                  {chosenStaff.slotCount != null ? ` · còn ${chosenStaff.slotCount} khung giờ` : ''}
                </small>
              </div>
            </div>
          )}

          <div className="adm-walkin-slots">
            <span className="adm-walkin-slots-label">Khung giờ khả dụng</span>

            {!serviceId && (
              <p className="adm-field-note">Chọn dịch vụ và ngày để xem khung giờ.</p>
            )}
            {serviceId && loadingSlots && (
              <p className="adm-field-note">Đang tải khung giờ…</p>
            )}

            {serviceId && !loadingSlots && slots.length === 0 && (
              <div className="adm-walkin-empty">
                <strong>Không còn khung giờ phù hợp</strong>
                <p>
                  {staffChoice === ANY_STAFF
                    ? 'Không có nhân viên nào còn trống đủ thời gian thực hiện dịch vụ này trong ngày đã chọn.'
                    : 'Nhân viên này không còn thời gian trống đủ để thực hiện dịch vụ trong ngày đã chọn.'}
                </p>
                <div className="adm-walkin-empty-actions">
                  {staffChoice !== ANY_STAFF && (
                    <button type="button" className="button secondary"
                      onClick={() => setStaffChoice(ANY_STAFF)}>Chọn nhân viên khác</button>
                  )}
                  <button type="button" className="button secondary"
                    onClick={() => setDay(nextDay(day))}>Chọn ngày khác</button>
                </div>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.label} className="adm-walkin-group">
                <span className="adm-walkin-group-label">{group.label}</span>
                <div className="adm-walkin-slot-grid">
                  {group.items.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={time === slot ? 'is-on' : ''}
                      onClick={() => { setTime(slot); setConflict(''); }}
                    >{slot}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {time && service && (
            <div className="adm-walkin-when">
              <Icon name="clock" />
              <span>
                Bắt đầu {time} · Dự kiến hoàn thành {endsAt} · Nhân viên bận đến {freeAt}
              </span>
            </div>
          )}
        </section>

        {/* ---------- 4. Ghi chú & xác nhận ---------- */}
        <section className="adm-walkin-block">
          <h3>Ghi chú &amp; xác nhận</h3>

          <label className="adm-field">
            <span>Ghi chú cho nhân viên</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Khách muốn đổi màu, có móng bị gãy…"
            />
          </label>

          <dl className="adm-walkin-sum">
            <div>
              <dt>Khách hàng</dt>
              <dd>{customer ? customer.name : (guestName.trim() ? `${guestName.trim()} · Walk-in` : '—')}</dd>
            </div>
            <div><dt>Dịch vụ</dt><dd>{service?.name ?? '—'}</dd></div>
            <div>
              <dt>Nhân viên</dt>
              <dd>{staffChoice === ANY_STAFF ? 'Bất kỳ nhân viên phù hợp' : chosenStaff?.name ?? '—'}</dd>
            </div>
            <div><dt>Ngày</dt><dd>{day ? ddmmyyyy(day) : '—'}</dd></div>
            <div><dt>Thời gian</dt><dd>{time ? `${time} – ${endsAt}` : '—'}</dd></div>
            <div><dt>Giá</dt><dd>{service ? money(service.price) : '—'}</dd></div>
            <div><dt>Thời lượng</dt><dd>{service ? `${service.duration} phút` : '—'}</dd></div>
            <div><dt>Buffer</dt><dd>{service ? `${service.bufferTime} phút` : '—'}</dd></div>
            <div><dt>Nguồn</dt><dd>WALK_IN</dd></div>
          </dl>

          {/* Lịch mới luôn ở PENDING để Admin xác nhận, dù khách đang đứng tại
              quầy: khách đứng ở cửa hàng không đồng nghĩa với đã bắt đầu làm. */}
          <p className="adm-walkin-note">
            Lịch mới sẽ ở trạng thái <strong>Chờ xác nhận</strong>. Xác nhận ở trang
            chi tiết lịch hẹn sau khi tạo.
          </p>

          {conflict && (
            <p className="adm-walkin-alert" role="alert">
              <Icon name="ban" />
              <span>{conflict}</span>
            </p>
          )}
          {error && <p className="login-admin-error" role="alert">{error}</p>}
        </section>
      </form>
    </Drawer>
  );
}