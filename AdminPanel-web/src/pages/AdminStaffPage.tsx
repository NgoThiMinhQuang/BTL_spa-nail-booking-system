/* ===== Trang Nhân viên của quản trị =====
   Mỗi thẻ là một nhân viên thật, kèm số liệu từ booking/review của riêng nhân
   viên đó: số ca đã nhận, doanh thu, điểm đánh giá và danh sách chuyên môn. */

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { EmptyState, Panel, SectionHeading, StatTile } from '../components/Primitives';
import { useApp } from '../store';
import { sendAdmin } from '../lib/admin-api';
import { fmtNum, fmtRating, formatVND, moneyShort } from '../lib/utils';
import type { StaffItem } from '../store';

export function AdminStaffPage() {
  const { state, reload } = useApp();
  const { staff, services } = state;

  const [term, setTerm] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');
  const [sort, setSort] = useState<'name' | 'revenue' | 'rating' | 'bookings'>('revenue');

  const activeStaff = staff.filter((item) => (item.status ?? 'ACTIVE') === 'ACTIVE');

  const [editing, setEditing] = useState<StaffItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [svcTerm, setSvcTerm] = useState('');
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', password: '',
    specialty: '', experienceYears: '1', baseSalary: '0', commissionRate: '10',
    serviceIds: [] as string[],
  });

  const set = (key: 'fullName' | 'phone' | 'email' | 'password' | 'specialty' | 'experienceYears' | 'baseSalary' | 'commissionRate') => (
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
    setSvcTerm('');
    setForm({
      fullName: '', phone: '', email: '', password: '',
      specialty: '', experienceYears: '1', baseSalary: '0', commissionRate: '10', serviceIds: [],
    });
    setFeedback('');
    setCreating(true);
  }

  function openEdit(item: StaffItem) {
    setEditing(item);
    setSvcTerm('');
    setForm({
      fullName: item.name, phone: item.phone, email: item.email ?? '', password: '',
      specialty: item.specialty ?? '', experienceYears: String(item.experienceYears),
      baseSalary: String(item.baseSalary ?? 0), commissionRate: String(item.commissionRate ?? 0),
      serviceIds: services.filter((s) => item.serviceNames.includes(s.name)).map((s) => s.id),
    });
    setFeedback('');
    setCreating(true);
  }

  /* Nhóm dịch vụ theo danh mục để chọn nhanh, kèm ô tìm kiếm. Danh sách
     phẳng 18 tên dài bọc lung tung là không đọc được. */
  const svcGroups = (() => {
    const key = svcTerm.toLowerCase();
    const matched = services.filter((s) => s.name.toLowerCase().includes(key));
    const groups = new Map<string, typeof services>();
    for (const service of matched) {
      const group = service.category ?? 'Chưa phân loại';
      const list = groups.get(group);
      if (list) list.push(service);
      else groups.set(group, [service]);
    }
    return [...groups.entries()];
  })();

  async function submitStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    const baseSalary = Number(form.baseSalary) || 0;
    const commissionRate = Number(form.commissionRate) || 0;
    if (baseSalary < 0 || baseSalary > 1000000000) {
      setBusy(false);
      setFeedback('Lương cơ bản không hợp lệ.');
      return;
    }
    if (commissionRate < 0 || commissionRate > 100) {
      setBusy(false);
      setFeedback('Hoa hồng phải từ 0 đến 100%.');
      return;
    }
    const body: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      specialty: form.specialty.trim(),
      experienceYears: Number(form.experienceYears) || 0,
      baseSalary: Math.round(baseSalary),
      commissionRate,
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
      && (statusFilter === 'all' || (item.status ?? 'ACTIVE') === statusFilter)
      && (item.name.toLowerCase().includes(term.toLowerCase())
        || (item.specialty ?? '').toLowerCase().includes(term.toLowerCase())))
    .sort((a, b) => {
      if (sort === 'revenue') return b.revenue - a.revenue;
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'bookings') return b.bookingCount - a.bookingCount;
      return a.name.localeCompare(b.name, 'vi');
    });

  function SortTh({ label, sortKey, numeric }: {
    label: string; sortKey: typeof sort; numeric?: boolean;
  }) {
    const active = sort === sortKey;
    return (
      <th className={numeric ? 'adm-cs-num' : undefined} aria-sort={active ? 'descending' : undefined}>
        <button className={`adm-sort-th${active ? ' is-on' : ''}`} onClick={() => setSort(sortKey)}
          title={`Sắp xếp theo ${label}`}>
          {label} <span aria-hidden="true">{active ? '▼' : ''}</span>
        </button>
      </th>
    );
  }

  const onShift = staff.filter((item) => item.worksToday).length;
  const totalRevenue = staff.reduce((sum, item) => sum + item.revenue, 0);
  const rated = staff.filter((item) => item.reviewCount > 0);
  const avgRating = rated.length
    ? rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length : null;

  return (
    <>
      <div className="adm-tiles adm-tiles-4">
        <StatTile tone="rose" icon="adminStaff" label="Nhân viên" value={`${activeStaff.length}/${staff.length}`} note="đang làm việc" />
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
          <select aria-label="Lọc theo trạng thái" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang làm việc</option>
            <option value="INACTIVE">Đã khoá</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Không tìm thấy nhân viên" detail="Thử một từ khoá khác." />
        ) : (
          <div className="table-scroll">
            <table className="adm-table adm-table-wide">
              <thead>
                <tr>
                  <th className="adm-stt">STT</th>
                  <SortTh label="Nhân viên" sortKey="name" />
                  <th>Kinh nghiệm</th>
                  <th>Lương</th>
                  <SortTh label="Hoàn thành" sortKey="bookings" numeric />
                  <SortTh label="Doanh thu" sortKey="revenue" numeric />
                  <SortTh label="Đánh giá" sortKey="rating" numeric />
                  <th>Dịch vụ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => {
                  const locked = (item.status ?? 'ACTIVE') !== 'ACTIVE';
                  const rate = item.bookingCount > 0
                    ? Math.round((item.completedCount / item.bookingCount) * 100) : 0;
                  return (
                    <tr key={item.id}>
                      <td className="adm-stt">{index + 1}</td>
                      <td>
                        <span className="adm-cell-name">
                          <Avatar name={item.name} url={item.avatarUrl} size={32} />
                          <span style={{ minWidth: 0 }}>
                            <strong>{item.name}</strong>
                            <small>{item.specialty ?? '—'}</small>
                            <small>{item.phone}</small>
                          </span>
                        </span>
                      </td>
                      <td className="adm-cs-num">{item.experienceYears} năm</td>
                      <td className="adm-cs-num" title="Lương cơ bản + % hoa hồng">
                        <strong>{moneyShort(item.baseSalary)}</strong>
                        <small> + {item.commissionRate}%</small>
                      </td>
                      <td className="adm-cs-num" title="Lịch đã hoàn thành / tổng lịch">
                        {fmtNum(item.completedCount)}/{fmtNum(item.bookingCount)}
                        <small> · {rate}%</small>
                      </td>
                      <td className="adm-cs-num"><strong>{moneyShort(item.revenue)}</strong></td>
                      <td className="adm-cs-num">
                        {item.reviewCount > 0 ? `★ ${fmtRating(item.rating)} (${item.reviewCount})` : '—'}
                      </td>
                      <td title={item.serviceNames.join(', ')}>
                        {item.serviceCount} món
                        {item.serviceNames.length > 0 && (
                          <small> · {item.serviceNames.slice(0, 2).join(', ')}
                            {item.serviceNames.length > 2 && ` +${item.serviceNames.length - 2}`}</small>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${locked ? 'cancelled' : item.worksToday ? 'completed' : 'pending'}`}
                          title={locked ? 'Tài khoản đã khoá, không đăng nhập được' : undefined}>
                          <i />{locked ? 'Đã khoá' : item.worksToday ? 'Trong ca' : 'Ngoài ca'}
                        </span>
                      </td>
                      <td>
                        <span className="adm-cat-actions">
                          <button className="button secondary" onClick={() => openEdit(item)}
                            title={`Sửa ${item.name}`}><Icon name="edit" /> Sửa</button>
                          <button className="button secondary" onClick={() => toggleStatus(item)}
                            title={(item.status ?? 'ACTIVE') === 'ACTIVE' ? `Khoá ${item.name}` : `Mở khoá ${item.name}`}>
                            {(item.status ?? 'ACTIVE') === 'ACTIVE' ? 'Khoá' : 'Mở'}
                          </button>
                          <button className="button secondary is-danger" onClick={() => removeStaff(item)}
                            title={`Xoá ${item.name}`}><Icon name="trash" /> Xoá</button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Hộp thêm / sửa nhân viên */}
      {creating && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={() => setCreating(false)}>
          <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="adm-staff-form-head">
              {editing && <Avatar name={editing.name} url={editing.avatarUrl} size={44} />}
              <div>
                <h3>{editing ? `Sửa nhân viên "${editing.name}"` : 'Thêm nhân viên mới'}</h3>
                {editing && (
                  <small>
                    {(editing.status ?? 'ACTIVE') === 'ACTIVE' ? 'Đang làm việc' : 'Đã khoá'}
                    {' · '}{editing.serviceCount} dịch vụ · {editing.completedCount} lịch hoàn thành
                  </small>
                )}
              </div>
            </div>
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
              <div className="adm-form-row">
                <label className="adm-field">
                  <span>Lương cơ bản (VND/tháng)</span>
                  <input value={form.baseSalary} onChange={set('baseSalary')}
                    disabled={busy} inputMode="numeric" placeholder="Ví dụ: 7000000" />
                </label>
                <label className="adm-field">
                  <span>Hoa hồng (% doanh thu COMPLETED+PAID)</span>
                  <input value={form.commissionRate} onChange={set('commissionRate')}
                    disabled={busy} inputMode="decimal" placeholder="Ví dụ: 10" />
                </label>
              </div>
              <div className="adm-field">
                <span>Dịch vụ thực hiện được ({form.serviceIds.length}/{services.length})</span>
                <div className="adm-svc-tools">
                  <input
                    aria-label="Tìm dịch vụ"
                    placeholder="Tìm dịch vụ…"
                    value={svcTerm}
                    onChange={(e) => setSvcTerm(e.target.value)}
                    disabled={busy}
                  />
                  <button type="button" className="button secondary" disabled={busy}
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      serviceIds: services
                        .filter((s) => s.name.toLowerCase().includes(svcTerm.toLowerCase()))
                        .map((s) => s.id),
                    }))}>
                    Chọn theo tìm kiếm
                  </button>
                  <button type="button" className="button secondary" disabled={busy}
                    onClick={() => { setSvcTerm(''); setForm((prev) => ({ ...prev, serviceIds: [] })); }}>
                    Bỏ chọn hết
                  </button>
                </div>
                <div className="adm-svc-groups">
                  {svcGroups.map(([group, items]) => (
                    <div key={group} className="adm-svc-group">
                      <strong>{group} <small>({items.filter((s) => form.serviceIds.includes(s.id)).length}/{items.length})</small></strong>
                      <ul>
                        {items.map((service) => (
                          <li key={service.id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={form.serviceIds.includes(service.id)}
                                disabled={busy}
                                onChange={() => toggleService(service.id)}
                              />
                              <span>{service.name}</span>
                              <em>{formatVND(service.price)}</em>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {svcGroups.length === 0 && (
                    <p className="adm-none">Không tìm thấy dịch vụ phù hợp.</p>
                  )}
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
