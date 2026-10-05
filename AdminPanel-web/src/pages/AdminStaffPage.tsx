/* ===== Trang Nhân viên của quản trị =====
   Mỗi thẻ là một nhân viên thật, kèm số liệu từ booking/review của riêng nhân
   viên đó: số ca đã nhận, doanh thu, điểm đánh giá và danh sách chuyên môn. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtNum, fmtRating, moneyShort } from '../lib/utils';
import type { StaffItem } from '../store';

export function AdminStaffPage() {
  const { state, reload } = useApp();
  const { staff, services } = state;

  const [term, setTerm] = useState('');
  const [specialty, setSpecialty] = useState('all');

  const [editing, setEditing] = useState<StaffItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', password: '',
    specialty: '', experienceYears: '1', serviceIds: [] as string[],
  });

  const set = (key: 'fullName' | 'phone' | 'email' | 'password' | 'specialty' | 'experienceYears') => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function toggleService(id: string) {
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter((s) => s !== id)
        : [...prev.serviceIds, id],
    }));
  }

  function openCreate() {
    setEditing(null);
    setForm({
      fullName: '', phone: '', email: '', password: '',
      specialty: '', experienceYears: '1', serviceIds: [],
    });
    setFeedback('');
    setCreating(true);
  }

  function openEdit(item: StaffItem) {
    setEditing(item);
    setForm({
      fullName: item.name, phone: item.phone, email: item.email ?? '', password: '',
      specialty: item.specialty ?? '', experienceYears: String(item.experienceYears),
      serviceIds: services.filter((s) => item.serviceNames.includes(s.name)).map((s) => s.id),
    });
    setFeedback('');
    setCreating(true);
  }

  async function submitStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    const body: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      specialty: form.specialty.trim(),
      experienceYears: Number(form.experienceYears) || 0,
      serviceIds: form.serviceIds.map(Number),
    };
    /* Mật khẩu: tạo mới bắt buộc, sửa thì để trống nghĩa là giữ nguyên. */
    if (!editing || form.password) body.password = form.password;
    const result = editing
      ? await sendAdmin(`/catalog/staff/${editing.id}`, 'PUT', body)
      : await sendAdmin('/catalog/staff', 'POST', body);
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setCreating(false);
    reload();
  }

  async function toggleStatus(item: StaffItem) {
    /* Backend chặn khoá khi còn lịch tương lai (409) nên ở đây chỉ hỏi
       lại cho chắc, thông điệp lỗi hiện nguyên văn. */
    const next = (item.status ?? 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (next === 'INACTIVE'
      && !window.confirm(`Khoá tài khoản "${item.name}"? Nhân viên còn lịch chưa xong thì không khoá được.`)) return;
    const result = await sendAdmin(`/catalog/staff/${item.id}/status`, 'PATCH', { status: next });
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    reload();
  }

  async function removeStaff(item: StaffItem) {
    if (!window.confirm(`Xoá nhân viên "${item.name}"? Người đã từng phục vụ thì không xoá được, chỉ khoá được.`)) return;
    const result = await sendAdmin(`/catalog/staff/${item.id}`, 'DELETE');
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    reload();
  }

  const specialties = Array.from(new Set(
    staff.map((item) => item.specialty).filter((value): value is string => Boolean(value)),
  ));

  const rows = staff
    .filter((item) =>
      (specialty === 'all' || item.specialty === specialty)
      && (item.name.toLowerCase().includes(term.toLowerCase())
        || (item.specialty ?? '').toLowerCase().includes(term.toLowerCase())));

  const onShift = staff.filter((item) => item.worksToday).length;
  const totalRevenue = staff.reduce((sum, item) => sum + item.revenue, 0);
  const rated = staff.filter((item) => item.reviewCount > 0);
  const avgRating = rated.length
    ? rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length : null;

  /** Đếm nhân viên thực hiện được từng danh mục, để đổ danh mục ở bộ lọc. */
  const categoryOf = (serviceId: string) =>
    services.find((service) => service.id === serviceId)?.category;

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="adminStaff" label="Nhân viên" value={staff.length} note="đang hoạt động" />
        <StatTile tone="sage" icon="clock" label="Đang trong ca" value={`${onShift}/${staff.length}`} note="hôm nay" />
        <StatTile tone="gold" icon="dollar" label="Doanh thu nhân sự" value={moneyShort(totalRevenue)} note="lịch hoàn thành" />
        <StatTile tone="lavender" icon="star" label="Điểm đánh giá" value={fmtRating(avgRating)}
          note={`${rated.length} người có phản hồi`} />
      </div>

      <Panel>
        <SectionHeading
          icon={<Icon name="adminStaff" />}
          title="Danh sách nhân viên"
          subtitle={`${rows.length} trong ${staff.length} nhân viên`}
        >
          <button className="button" onClick={openCreate}>＋ Thêm nhân viên</button>
        </SectionHeading>
        {feedback && !creating && <p className="adm-error" style={{ padding: '0 16px' }}>{feedback}</p>}

        <div className="adm-tools">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm nhân viên"
              placeholder="Tìm theo tên hoặc chuyên môn…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <select aria-label="Lọc theo chuyên môn" value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}>
            <option value="all">Tất cả chuyên môn</option>
            {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy nhân viên" detail="Thử một từ khoá khác." />
        ) : (
          <div className="adm-people">
            {rows.map((item) => (
              <article key={item.id} className="adm-person">
                <div className="adm-person-head">
                  <Avatar name={item.name} url={item.avatarUrl} size={44} />
                  <span style={{ minWidth: 0 }}>
                    <h3>{item.name}</h3>
                    <small>{item.specialty ?? 'Chưa cập nhật chuyên môn'}</small>
                  </span>
                </div>

                <div className="adm-person-meta">
                  <span><Icon name="star" /> {fmtRating(item.rating)}
                    {item.reviewCount > 0 ? ` (${item.reviewCount})` : ''}</span>
                  <span><Icon name="schedule" /> {fmtNum(item.bookingCount)} lịch</span>
                  <span><Icon name="dollar" /> {moneyShort(item.revenue)}</span>
                </div>

                <dl className="adm-person-nums">
                  <div><dt>Kinh nghiệm</dt><dd>{item.experienceYears} năm</dd></div>
                  <div><dt>Hoàn thành</dt><dd>{fmtNum(item.completedCount)}</dd></div>
                  <div><dt>Dịch vụ</dt><dd>{item.serviceCount}</dd></div>
                </dl>

                <div className="adm-cell-meta">
                  {item.serviceNames.slice(0, 3).map((name) => {
                    const match = services.find((service) => service.name === name);
                    return <span key={name} className="adm-tag">{categoryOf(match?.id ?? '') ?? name}</span>;
                  })}
                  {item.serviceNames.length > 3 && (
                    <span className="adm-tag">+{item.serviceNames.length - 3}</span>
                  )}
                </div>

                <div className="adm-person-foot">
                  <span className={`badge ${item.worksToday ? 'completed' : 'pending'}`}>
                    <i />{item.worksToday ? 'Đang trong ca' : 'Ngoài ca'}
                  </span>
                  <span className="adm-person-phone">{item.phone}</span>
                </div>
                {(item.status ?? 'ACTIVE') !== 'ACTIVE' && (
                  <p className="adm-error">Tài khoản đang bị khoá — không đăng nhập được.</p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="button secondary" onClick={() => openEdit(item)}>Sửa</button>
                  <button className="button secondary" onClick={() => toggleStatus(item)}>
                    {(item.status ?? 'ACTIVE') === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
                  </button>
                  <button className="button secondary" onClick={() => removeStaff(item)}>Xoá</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {/* Hộp thêm / sửa nhân viên */}
      {creating && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setCreating(false)}>
          <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? `Sửa nhân viên "${editing.name}"` : 'Thêm nhân viên mới'}</h3>
            <form className="adm-form" onSubmit={submitStaff}>
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Họ tên</span>
                  <input value={form.fullName} onChange={set('fullName')} disabled={busy}
                    placeholder="Ví dụ: Nguyễn Thị Lan" />
                </label>
                <label className="adm-field">
                  <span>Số điện thoại (tài khoản đăng nhập)</span>
                  <input value={form.phone} onChange={set('phone')} disabled={busy}
                    placeholder="Ví dụ: 0901000006" inputMode="tel" />
                </label>
              </div>
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Email</span>
                  <input value={form.email} onChange={set('email')} disabled={busy}
                    placeholder="Không bắt buộc" inputMode="email" />
                </label>
                <label className="adm-field">
                  <span>{editing ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Mật khẩu'}</span>
                  <input type="password" value={form.password}
                    onChange={set('password')} disabled={busy} />
                </label>
              </div>
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Chuyên môn</span>
                  <input value={form.specialty} onChange={set('specialty')} disabled={busy}
                    placeholder="Ví dụ: Sơn gel & Nail Art" />
                </label>
                <label className="adm-field">
                  <span>Kinh nghiệm (năm)</span>
                  <input value={form.experienceYears} onChange={set('experienceYears')}
                    disabled={busy} inputMode="numeric" />
                </label>
              </div>
              <div className="adm-field">
                <span>Dịch vụ thực hiện được</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {services.map((service) => (
                    <label key={service.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={form.serviceIds.includes(service.id)}
                        disabled={busy}
                        onChange={() => toggleService(service.id)}
                      />
                      {service.name}
                    </label>
                  ))}
                </div>
              </div>
              {feedback && <p className="adm-error">{feedback}</p>}
              <div className="adm-modal-foot">
                <button className="button secondary" type="button" disabled={busy}
                  onClick={() => setCreating(false)}>Hủy</button>
                <button className="button" type="submit" disabled={busy}>
                  {editing ? 'Lưu thay đổi' : 'Thêm nhân viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
