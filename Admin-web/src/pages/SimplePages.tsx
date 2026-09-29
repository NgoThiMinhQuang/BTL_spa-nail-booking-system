/* ===== Trang dịch vụ và trang hồ sơ cá nhân ===== */

import { EmptyState } from '../components/Primitives';
import { PageBar } from '../components/PageBar';
import { Avatar } from '../components/Avatar';
import { useApp } from '../store';
import { usePager } from '../hooks/usePager';
import { fmtNum } from '../lib/utils';

const PAGE_SIZE = 8;

export function ServicesPage() {
  const { state, dispatch } = useApp();
  const all = state.data!.services;
  const query = state.query.toLocaleLowerCase('vi');
  const rows = all.filter((s) => s.name.toLocaleLowerCase('vi').includes(query));
  const info = usePager('services', rows, PAGE_SIZE);

  return (
    <section className="panel lower-panel">
      <div className="section-heading">
        <div>
          <h2>Dịch vụ của tôi</h2>
          <p>{fmtNum(all.length)} dịch vụ chuyên môn của bạn</p>
        </div>
        <label className="search">
          <span>⌕</span>
          <input
            aria-label="Tìm dịch vụ"
            placeholder="Tìm dịch vụ…"
            value={state.query}
            onChange={(e) => dispatch({ type: 'query', query: e.target.value })}
          />
        </label>
      </div>

      {rows.length ? (
        <>
          <div className="table-scroll">
            <table className="admin-table service-admin-table">
              <thead>
                <tr>
                  <th className="col-stt">STT</th>
                  <th className="txt">Dịch vụ</th>
                  <th className="txt">Loại</th>
                  <th className="num">Thời lượng</th>
                  <th className="num">Giá</th>
                </tr>
              </thead>
              <tbody>
                {info.rows.map((s, i) => (
                  <tr key={s.id}>
                    <td className="col-stt num">{fmtNum(info.start + i + 1)}</td>
                    <td className="txt">
                      <strong>{s.name}</strong>
                      <small>{s.description || 'Chăm sóc tỉ mỉ bởi chuyên viên NailHouse.'}</small>
                    </td>
                    <td className="txt">{s.category || 'Dịch vụ NailHouse'}</td>
                    <td className="num">{fmtNum(s.duration)} phút</td>
                    <td className="num"><strong>{fmtNum(s.price)}đ</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PageBar info={info} onChange={info.goTo} unit="dịch vụ" />
        </>
      ) : (
        <EmptyState
          title="Chưa được phân công dịch vụ"
          detail="Dịch vụ chuyên môn sẽ hiển thị khi được cập nhật trong hệ thống."
        />
      )}
    </section>
  );
}

export function ProfilePage() {
  const { state } = useApp();
  const { profile, services } = state.data!;
  return (
    <section className="panel profile">
      <div className="profile-cover" />
      <Avatar name={profile.name} url={profile.avatar} large />
      <p className="eyebrow">CHUYÊN VIÊN NAILHOUSE</p>
      <h2>{profile.name}</h2>
      <p>{profile.specialty || 'Chuyên viên chăm sóc sắc đẹp'}</p>
      <div className="profile-stats">
        <div><strong>{profile.experienceYears}</strong><span>Năm kinh nghiệm</span></div>
        <div><strong>{profile.rating} / 5</strong><span>Đánh giá</span></div>
        <div><strong>{services.length}</strong><span>Dịch vụ chuyên môn</span></div>
      </div>
      <dl>
        <div><dt>Số điện thoại</dt><dd>{profile.phone || 'Chưa cập nhật'}</dd></div>
        <div><dt>Email</dt><dd>{profile.email || 'Chưa cập nhật'}</dd></div>
        <div><dt>Chuyên môn</dt><dd>{profile.specialty || 'Chưa cập nhật'}</dd></div>
      </dl>
    </section>
  );
}
