/* ===== Trang hồ sơ cá nhân của nhân viên =====
   Chuẩn một trang profile nhân sự: đầu trang định danh (ảnh bìa, avatar,
   tên, chuyên môn, mã NV, nút gọi/email, điểm đánh giá) → dải số liệu
   công việc → khối Thông tin chung → chuyên môn, lịch hẹn, đánh giá,
   lương → cột phải là thẻ Hôm nay và ca cả tuần. Mọi con số lấy từ dữ
   liệu đang tải, không đặt số bịa. */

import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Primitives';
import { Icon, type IconName } from '../components/Icon';
import { Stars } from '../components/Stars';
import { apiRequest, useApp } from '../store';
import { useNavigation } from '../hooks/useNavigation';
import { fmtNum, localDate, money } from '../lib/utils';
import { serviceCode, statusLabel } from '../lib/services';

const PREVIEW = 5;
/* Giữ đúng cách gọi của .wk-day trong WeekGrid ("Thứ 2", "Chủ nhật") để
   cột phải không lệch với lưới tuần. */
const DAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

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

/** Một dòng trong khối Thông tin chung: biểu tượng, nhãn, giá trị. */
function AboutRow({ icon, label, children }: {
  icon: IconName; label: string; children: React.ReactNode;
}) {
  return (
    <li>
      <span className="pro-about-icon"><Icon name={icon} /></span>
      <span className="pro-about-copy">
        <small>{label}</small>
        <strong>{children}</strong>
      </span>
    </li>
  );
}

export function ProfilePage() {
  const { state } = useApp();
  const { goView, openBooking } = useNavigation();
  const { profile, customers, services, shifts, bookings, date } = state.data!;
  const { recentReviews = [] } = state.data!;

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
  /* Hiện cả ngày nghỉ (OFF), chỉ bỏ ca đã hủy — đúng chuẩn lịch tuần của
     một hồ sơ nhân sự, quản lý nhìn là biết tuần này làm những hôm nào. */
  const weekShifts = shifts.filter((s) => s.status !== 'CANCELLED');
  const activeServices = services.filter((s) => s.status === 'ACTIVE').length;

  /* Ca hôm nay và lịch tiếp theo cho thẻ Hôm nay ở cột phải. */
  const todayShift = shifts.find((s) => s.date === today && s.status !== 'CANCELLED');
  const todayShiftText = !todayShift || todayShift.status === 'OFF'
    ? 'Nghỉ'
    : `${todayShift.start} – ${todayShift.end}`;
  const now = new Date();
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nextBooking = isToday
    ? [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .find((b) => b.startsAt.slice(11, 16) >= nowHM
        && ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(b.status))
    : undefined;

  const STAT_CARDS: { label: string; symbol: IconName; tone: string; value: string; note: string }[] = [
    { label: 'Lượt phục vụ', symbol: 'schedule', tone: 'rose', value: values[0], note: 'lượt khách đã đón' },
    { label: 'Khách hàng', symbol: 'customers', tone: 'lavender', value: values[1], note: 'khách đã quen' },
    {
      label: 'Điểm đánh giá', symbol: 'star', tone: 'gold',
      value: rating > 0 ? rating.toFixed(1) : '—',
      note: reviews ? `${fmtNum(reviews)} lượt đánh giá` : 'chưa có đánh giá',
    },
    { label: 'Kinh nghiệm', symbol: 'done', tone: 'sage', value: values[3], note: 'năm tại NailHouse' },
  ];

  return (
    <div className="pro-layout">
      <div className="pro-main">
        {/* ---- Đầu trang định danh: ảnh bìa, avatar, tên, chuyên môn,
            nút liên hệ và điểm đánh giá ---- */}
        <section className="panel pro-hero">
          <div className="pro-hero-cover" aria-hidden="true">
            <span><Icon name="flower" /></span>
            <em className="pro-hero-code">MÃ #{fmtNum(profile.id)}</em>
          </div>
          <div className="pro-hero-body">
            <Avatar name={profile.name} url={profile.avatar} large />
            <div className="pro-hero-copy">
              <p className="eyebrow">CHUYÊN VIÊN NAILHOUSE</p>
              <h2>{profile.name}</h2>
              <p className="pro-hero-scope">{profile.specialty || 'Chuyên viên chăm sóc sắc đẹp'}</p>
              <div className="pro-hero-links">
                <span className="pro-chip is-plain">
                  <Icon name="services" />{activeServices}/{services.length} dịch vụ đang mở
                </span>
                <span className="pro-chip is-plain">
                  <Icon name="done" />{fmtNum(profile.experienceYears)} năm kinh nghiệm
                </span>
              </div>
              {(profile.phone || profile.email) && (
                <div className="pro-hero-actions">
                  {profile.phone && (
                    <a className="button" href={`tel:${profile.phone}`}>
                      <Icon name="phone" /> Gọi điện
                    </a>
                  )}
                  {profile.email && (
                    <a className="button secondary" href={`mailto:${profile.email}`}>
                      <Icon name="email" /> Gửi email
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Điểm từ review thật của khách. Chưa có review thì nói rõ,
                không hiện điểm của cửa hàng để khỏi gây hiểu nhầm. */}
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

        {/* ---- Dải số liệu công việc ---- */}
        <div className="pro-stats">
          {STAT_CARDS.map((card) => (
            <div key={card.label} className={`pro-stat pro-stat-${card.tone}`}>
              <span className="pro-stat-icon"><Icon name={card.symbol} /></span>
              <span className="pro-stat-copy">
                <span className="pro-stat-label">{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.note}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="pro-panels">
          {/* ---- Thông tin chung: khối không thể thiếu của một hồ sơ
              nhân sự — ai nhìn vào cũng biết liên hệ và năng lực ---- */}
          <section className="panel pro-panel pro-panel-wide">
            <div className="pro-panel-head">
              <h3>Thông tin chung</h3>
              <span className="pro-panel-note">Hồ sơ do quản lý cập nhật</span>
            </div>
            <ul className="pro-about-list">
              <AboutRow icon="tag" label="Mã nhân viên">#{fmtNum(profile.id)}</AboutRow>
              <AboutRow icon="sparkles" label="Chuyên môn">
                {profile.specialty || 'Chuyên viên chăm sóc sắc đẹp'}
              </AboutRow>
              <AboutRow icon="phone" label="Số điện thoại">
                {profile.phone
                  ? <a className="pro-about-link" href={`tel:${profile.phone}`}>{profile.phone}</a>
                  : <span className="pro-muted">Chưa cập nhật</span>}
              </AboutRow>
              <AboutRow icon="email" label="Email">
                {profile.email
                  ? <a className="pro-about-link" href={`mailto:${profile.email}`}>{profile.email}</a>
                  : <span className="pro-muted">Chưa cập nhật</span>}
              </AboutRow>
              <AboutRow icon="services" label="Dịch vụ đang mở">
                {activeServices}/{services.length} dịch vụ
              </AboutRow>
              <AboutRow icon="clock" label="Ca hôm nay">{todayShiftText}</AboutRow>
            </ul>
          </section>

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
                      className={`pro-service-flag${s.status === 'INACTIVE' ? ' is-paused' : ''}`}
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

          {/* ---- Đánh giá: điểm tổng hợp trước, lời nhận xét sau — điểm
              số không nói được khách khen hay chê điều gì ---- */}
          <section className="panel pro-panel">
            <div className="pro-panel-head">
              <h3>Đánh giá gần đây</h3>
              <span className="pro-panel-note">{fmtNum(recentReviews.length)} lượt mới nhất</span>
            </div>
            {rating > 0 && (
              <div className="pro-review-sum">
                <strong>{rating.toFixed(1)}</strong>
                <span className="pro-rate-stars"><Stars rating={rating} /></span>
                <small>{fmtNum(reviews)} lượt từ {fmtNum(rated.length)} khách hàng</small>
              </div>
            )}
            {recentReviews.length ? (
              <ul className="pro-review-list">
                {recentReviews.slice(0, PREVIEW).map((review) => (
                  <li key={review.id}>
                    <Avatar name={review.customerName} url={review.customerAvatar} />
                    <div className="pro-review-copy">
                      <div className="pro-review-head">
                        <strong>{review.customerName}</strong>
                        <span className="pro-rate-stars"><Stars rating={review.rating} /></span>
                      </div>
                      <small>{review.serviceName} · {String(review.createdAt).slice(0, 10).split('-').reverse().join('/')}</small>
                      {review.comment && <p>{review.comment}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pro-empty">Chưa có đánh giá nào. Điểm và nhận xét sẽ hiện ở đây sau buổi làm đầu tiên được khách chấm.</p>
            )}
          </section>

          <MyPayPanel />
        </div>
      </div>

      <aside className="pro-aside">
        {/* ---- Hôm nay: ca, số lịch và lịch tiếp theo trong một cái nhìn ---- */}
        {isToday && (
          <section className="panel pro-today">
            <div className="pro-panel-head">
              <h3>Hôm nay</h3>
              <span className="pro-panel-note">{today.split('-').reverse().join('/')}</span>
            </div>
            <ul className="pro-today-list">
              <li>
                <span className="pro-today-icon"><Icon name="clock" /></span>
                <span><small>Ca làm việc</small><strong>{todayShiftText}</strong></span>
              </li>
              <li>
                <span className="pro-today-icon"><Icon name="schedule" /></span>
                <span><small>Lịch hẹn</small><strong>{fmtNum(bookings.length)} lịch</strong></span>
              </li>
              <li>
                <span className="pro-today-icon"><Icon name="play" /></span>
                <span>
                  <small>Lịch tiếp theo</small>
                  <strong>
                    {nextBooking
                      ? `${nextBooking.startsAt.slice(11, 16)} · ${nextBooking.customerName}`
                      : 'Không còn lịch chờ'}
                  </strong>
                </span>
              </li>
            </ul>
            <button type="button" className="button secondary pro-today-go" onClick={() => goView('schedule')}>
              Mở lịch làm việc →
            </button>
          </section>
        )}

        {/* ---- Ca làm việc cả tuần, kể cả ngày nghỉ ---- */}
        <section className="panel pro-shift">
          <div className="pro-panel-head">
            <h3>Ca làm việc</h3>
            <span className="pro-panel-note">{fmtNum(openShifts.length)} ca trong 7 ngày</span>
          </div>
          {weekShifts.length ? (
            <ul className="pro-shift-list">
              {weekShifts.map((s) => {
                const { day, date: dayNum } = shiftDay(s.date, today);
                const off = s.status === 'OFF';
                return (
                  <li key={`${s.date}-${s.start}`} className={`${s.date === today ? 'is-today' : ''}${off ? ' is-off' : ''}`}>
                    <span className="pro-shift-day">
                      <strong>{day}</strong>
                      {dayNum && <small>{dayNum}</small>}
                    </span>
                    <span className="pro-shift-time">{off ? 'Nghỉ' : `${s.start} – ${s.end}`}</span>
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

/* ===== Lương của tôi: lịch sử phiếu lương (chỉ xem) ===== */

interface MyPay {
  id: string;
  periodMonth: string;
  baseSalary: number;
  commissionRate: number;
  serviceRevenue: number;
  completedCount: number;
  commissionAmount: number;
  bonus: number;
  deduction: number;
  totalSalary: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID';
  paidAt: string | null;
}

const PAY_TEXT: Record<MyPay['status'], string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã chốt',
  PAID: 'Đã trả',
};

function MyPayPanel() {
  const [items, setItems] = useState<MyPay[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const rows = await apiRequest<MyPay[]>('/api/staff/payrolls');
        setItems(Array.isArray(rows) ? rows : []);
      } catch {
        /* Chưa có lương thì ẩn, không chặn hồ sơ. */
      }
    })();
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="panel pro-panel">
      <div className="pro-panel-head">
        <h3>Lương của tôi</h3>
        <span className="pro-panel-note">{items.length} phiếu gần nhất</span>
      </div>
      <ul className="pro-booking-list">
        {items.slice(0, 5).map((p) => (
          <li key={p.id}>
            <span className="pro-booking-time">{p.periodMonth}</span>
            <span className="pro-booking-name">
              <strong>{money(p.totalSalary)}</strong>
              <small>
                Cơ bản {money(p.baseSalary)} + HH {money(p.commissionAmount)} ({p.completedCount} lịch)
                {p.bonus ? ` + thưởng ${money(p.bonus)}` : ''}
                {p.deduction ? ` − trừ ${money(p.deduction)}` : ''} · {PAY_TEXT[p.status]}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
