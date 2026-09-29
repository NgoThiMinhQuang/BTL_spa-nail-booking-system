/* ===== Điều hướng giữa các màn hình ===== */

import { useCallback } from 'react';
import { useApp, type ViewName } from '../store';
import { localDate } from '../lib/utils';

export function useNavigation() {
  const { state, dispatch } = useApp();

  const goView = useCallback(
    (view: ViewName) => dispatch({ type: 'view', view }),
    [dispatch],
  );

  /* Mở chi tiết lịch hẹn; nếu lịch thuộc ngày khác thì đổi ngày cho khớp. */
  const openBooking = useCallback((id: string) => {
    const source = [...(state.data?.bookings ?? []), ...state.rangeBookings];
    const found = source.find((b) => String(b.id) === String(id));
    const bookingDate = found ? found.startsAt.slice(0, 10) : null;
    dispatch({ type: 'booking', id, date: bookingDate && bookingDate !== state.date ? bookingDate : null });
  }, [state.data, state.rangeBookings, state.date, dispatch]);

  /* Lùi/kền theo chế độ xem: ngày = 1 ngày, tuần = 7 ngày, tháng = 1 tháng. */
  const shiftPeriod = useCallback((amount: number) => {
    const d = new Date(`${state.date}T12:00:00`);
    if (state.calendarMode === 'month') {
      d.setDate(1);
      d.setMonth(d.getMonth() + amount);
    } else {
      d.setDate(d.getDate() + amount * (state.calendarMode === 'week' ? 7 : 1));
    }
    dispatch({ type: 'date', date: localDate(d) });
  }, [state.date, state.calendarMode, dispatch]);

  return { goView, openBooking, shiftPeriod };
}
