/* ===== Lịch tháng nhỏ (dùng ở trang chủ và trang lịch) ===== */

import { useApp } from '../store';
import { longDate } from '../lib/utils';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function MiniCalendar() {
  const { state, dispatch } = useApp();
  const month = state.homeMonth || state.date.slice(0, 7);
  const first = new Date(`${month}-01T12:00:00`);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  const shiftMonth = (amount: number) => {
    const d = new Date(`${month}-01T12:00:00`);
    d.setMonth(d.getMonth() + amount);
    dispatch({ type: 'homeMonth', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  };

  return (
    <section className="panel home-calendar">
      <div className="section-heading"><h2>Lịch của tôi</h2></div>
      <div className="home-month-nav">
        <button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Tháng trước">‹</button>
        <strong>Tháng {first.getMonth() + 1}, {first.getFullYear()}</strong>
        <button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Tháng sau">›</button>
      </div>
      <div className="home-calendar-grid">
        {WEEKDAYS.map((d) => <span key={d} className="weekday">{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          return (
            <button
              key={date}
              onClick={() => dispatch({ type: 'date', date })}
              className={date === state.date ? 'selected-date' : ''}
              aria-label={longDate(date)}
              aria-pressed={date === state.date}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="calendar-caption">
        <span />
        Ngày đang xem
        <button onClick={() => dispatch({ type: 'today' })}>Về hôm nay</button>
      </div>
    </section>
  );
}
