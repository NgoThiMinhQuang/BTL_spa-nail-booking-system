/* ===== Trang thông tin cá nhân =====
   Bố cục: thẻ tiêu đề gộp luôn đánh giá → số liệu → hai khối nội dung chính
   → cột phải dánh. Mọi con số lấy từ dữ liệu đang tải, không đặt số bịa. */

import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Primitives';
import { Icon, type IconName } from '../components/Icon';
import { Stars } from '../components/Stars';
import { useApp } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { fmtNum, localDate, money } from '../lib/utils';
import { serviceCode, statusLabel } from '../lib/services';

const PREVIEW = 5;
/* Giữ đúng cách gọi của .wk-day trong WeekGrid ("Thứ 2", "Chủ nhật") để
   cột phải không lệch với lưới tuần. */
const DAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const STAT_CARDS: { label: string; symbol: IconName; tone: string; note: string }[] = [
  { label: 'Lượt đặt', symbol: 'schedule', tone: 'rose', note: 'khách đã ghé' },
  { label: 'Khách hàng', symbol: 'customers', tone: 'lavender', note: 'người đã quen' },
  { label: 'Dịch vụ', symbol: 'services', tone: 'sage', note: 'đang phục vụ' },
  { label: 'Kinh nghiệm', symbol: 'done', tone: 'gold', note: 'năm tại NailHouse' },
];

/** '2026-09-30' -> 'Thứ 4' + '30/09'.
    Ngày cắt từ chuỗi rồi đảo lại, đồng bộ với mọi bảng khác trong app —
    `toLocaleDateString` ra "30-09" (dấu gạch ngang) lệch với chuẩn "30/09".
    Bỏ năm vì tên thứ đã ghi rõ tháng nào, thêm năm chỉ làm dòng dài ra. */
function shiftDay(date: string, today: string): { day: string; date: string } {
  if (date === today) return { day: 'Hôm nay', date: '' };
  return {
    day: DAY[new Date(`${date}T12:00:00`).getDay()],
    date: date.split('-').reverse().join('/').slice(0, 5),
  };
}

export function ProfilePage() {
  const { state } = useApp();
  const { goView, openBooking } = useNavigation();
  const { profile, customers, services, shifts, bookings, date } = state.data!;

  const visits = customers.reduce((sum, c) => sum + c.visits, 0);
  const values = [
    fmtNum(visits), fmtNum(customers.length),
    fmtNum(services.length), fmtNum(profile.experienceYears),
  ];

  /* Điểm đánh giá lấy từ review thật của những khách đã đánh giá, KHÔNG lấy
     `staff.rating` — cột đó là điểm do cửa hàng chấm nên có thể là 5 dù khách
     chưa đánh giá gì. Lấy cột đó ra sẽ ra "5.0 ★★★★★ / Chưa có đánh giá nào". */
  const rated = customers.filter((c) => c.reviewCount > 0 && c.rating > 0);
  const reviews = rated.reduce((sum, c) => sum + c.reviewCount, 0);
  const rating = rated.length
    ? rated.reduce((sum, c) => sum + c.rating, 0) / rated.length
    : 0;
  const reviewers = rated.slice(0, 3);

  const today = localDate();
  const isToday = date === today;
  /* API chỉ trả 7 ngày tới nên đây là số ca thật trong khung đó. */
  const openShifts = shifts.filter((s) => s.status === 'AVAILABLE');
  const activeServices = services.filter((s) => s.status === 'ACTIVE').length;

  return (
    <div className="pro-layout">
      <div className="pro-main">
        {/* ---- Tiêu đề: ảnh bìa, thông tin và đánh giá ---- */}
        <section className="panel pro-hero">
          <div className="pro-hero-cover" aria-hidden="true">
            <span><Icon name="flower" /></span>
          </div>
          <div className="pro-hero-body">
            <Avatar name={profile.name} url={profile.avatar} large />
            <div className="pro-hero-copy">
              <p className="eyebrow">CHUYÊN VIÊN NAILHOUSE · MÃ #{fmtNum(profile.id)}</p>
              <h2>{profile.name}</h2>
              <p className="pro-hero-scope">{profile.specialty || 'Chuyên viên chăm sóc sắc đẹp'}</p>
              <div className="pro-hero-links">
                {profile.phone && (
                  <a className="pro-chip" href={`tel:${profile.phone}`}>
                    <Icon name="phone" />{profile.phone}
                  </a>
                )}
                {profile.email && (
                  <a className="pro-chip" href={`mailto:${profile.email}`}>
                    <Icon name="email" />{profile.email}
                  </a>
                )}
                <span className="pro-chip is-plain">
                  <Icon name="services" />{activeServices}/{services.length} dịch vụ đang mở
                </span>
              </div>
            </div>

            {/* Đánh giá đặt bên phải thay cho khối riêng, tiết kiệm một hàng.
                Chưa có review thì nói rõ, không hiện điểm của cửa hàng. */}
            <div className={`pro-hero-rate${rating > 0 ? '' : ' is-empty'}`}>
              {rating > 0 ? (
                <>
                  <div className="pro-rate-top">
                    <strong>{rating.toFixed(1)}</strong>
                    <span className="pro-rate-stars"><Stars rating={rating} /></span>
                  </div>
                  <p className="pro-rate-note">
                    {fmtNum(reviews)} đánh giá từ {fmtNum(rated.length)} khách hàng
                  </p>
                  <ul className="pro-rate-faces">
                    {reviewers.map((c) => (
                      <li key={c.id} title={`${c.name} · ${c.rating.toFixed(1)}★`}>
                        <Avatar name={c.name} url={c.avatar} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="pro-rate-empty-title">Chưa có đánh giá</p>
                  <p className="pro-rate-note">
                    Điểm sẽ hiện sau khi khách đánh giá lần đầu.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="pro-stats">
          {STAT_CARDS.map((card, index) => (
            <div key={card.label} className={`pro-stat pro-stat-${card.tone}`}>
              <span className="pro-stat-icon"><Icon name={card.symbol} /></span>
              <span className="pro-stat-copy">
                <span className="pro-stat-label">{card.label}</span>
                <strong>{values[index]}</strong>
                <small>{card.note}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="pro-panels">
          {/* ---- Dịch vụ chuyên môn ---- */}
          <section className="panel pro-panel">
            <div className="pro-panel-head">
              <h3>Dịch vụ chuyên môn</h3>
              <button type="button" className="pro-link" onClick={() => goView('services')}>
                Xem tất cả →
              </button>
            </div>
            {services.length ? (
              <ul className="pro-service-list">
                {services.slice(0, PREVIEW).map((s) => (
                  <li key={s.id}>
                    <span className="pro-service-name" title={s.name}>{s.name}</span>
                    <span className="pro-service-code">{serviceCode(s.id)}</span>
                    <em>{fmtNum(s.duration)}′</em>
                    <strong>{money(s.price)}</strong>
                    <span
                      className={`pro-service-flag${s.status === 'HIDDEN' ? ' is-paused' : ''}`}
                      title={statusLabel(s.status)}
                    />
                  </li>
                ))}
                {services.length > PREVIEW && (
                  <li className="pro-more">
                    Còn {fmtNum(services.length - PREVIEW)} dịch vụ khác
                  </li>
                )}
              </ul>
            ) : (
              <p className="pro-empty">Chưa khai báo dịch vụ nào. Thêm ở trang Dịch vụ để khách đặt lịch với bạn.</p>
            )}
          </section>

          {/* ---- Lịch hẹn trong ngày ---- */}
          <section className="panel pro-panel">
            <div className="pro-panel-head">
              <h3>Lịch hẹn {isToday ? 'hôm nay' : `ngày ${date.split('-').reverse().join('/')}`}</h3>
              <button type="button" className="pro-link" onClick={() => goView('schedule')}>
                Mở lịch →
              </button>
            </div>
            {bookings.length ? (
              <ul className="pro-booking-list">
                {bookings.slice(0, PREVIEW).map((b) => (
                  <li key={b.id}>
                    <span className="pro-booking-time">{b.startsAt.slice(11)}</span>
                    <span className="pro-booking-name">
                      <strong>{b.customerName}</strong>
                      <small>{b.serviceName}</small>
                    </span>
                    <Badge status={b.status} />
                    <button
                      type="button"
                      className="pro-booking-go"
                      aria-label={`Mở lịch hẹn của ${b.customerName}`}
                      onClick={() => openBooking(String(b.id))}
                    >
                      ›
                    </button>
                  </li>
                ))}
                {bookings.length > PREVIEW && (
                  <li className="pro-more">Còn {fmtNum(bookings.length - PREVIEW)} lịch hẹn khác</li>
                )}
              </ul>
            ) : (
              <p className="pro-empty">
                {isToday
                  ? 'Hôm nay bạn chưa có cuộc hẹn nào. Tận dụng khoảng trống để chăm sóc khách quen nhé.'
                  : 'Ngày này bạn chưa có cuộc hẹn nào được đặt.'}
              </p>
            )}
          </section>
        </div>
      </div>

      <aside className="pro-aside">
        {/* ---- Ca làm việc: lịch 7 ngày dạng dải, không lặp ảnh đại diện ---- */}
        <section className="panel pro-shift">
          <div className="pro-panel-head">
            <h3>Ca làm việc</h3>
            <span className="pro-panel-note">{fmtNum(openShifts.length)} ca trong 7 ngày</span>
          </div>
          {openShifts.length ? (
            <ul className="pro-shift-list">
              {openShifts.map((s) => {
                const { day, date: dayNum } = shiftDay(s.date, today);
                return (
                  <li key={`${s.date}-${s.start}`} className={s.date === today ? 'is-today' : ''}>
                    <span className="pro-shift-day">
                      <strong>{day}</strong>
                      {dayNum && <small>{dayNum}</small>}
                    </span>
                    <span className="pro-shift-time">{s.start} – {s.end}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pro-empty">Không có ca làm nào trong 7 ngày tới.</p>
          )}
        </section>

        <section className="quote-card">
          <p>“Những bàn tay<br />tạo nên ngày đẹp”</p>
          <span>NailHouse Studio</span>
        </section>

        <section className="help-card">
          <span className="help-card-icon"><Icon name="bell" /></span>
          <div>
            <h3>Cần cập nhật hồ sơ?</h3>
            <p>Ảnh, số điện thoại và chuyên môn do quản lý cập nhật. Liên hệ quản lý khi cần thay đổi.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
