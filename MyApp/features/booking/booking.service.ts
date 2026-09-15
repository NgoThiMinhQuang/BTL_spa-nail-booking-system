import { api } from '@/services/api';
import type { ApiResponse } from '@/types';
import type { Availability, Booking, BookingDraft } from './booking.types';

type AvailabilityResponse = ApiResponse<string[]> & { meta: { duration: number; bufferTime: number } };

export async function fetchAvailability(serviceId: string, staffId: string, date: string): Promise<Availability> {
  const query = new URLSearchParams({ serviceId, staffId, date });
  const response = await api<AvailabilityResponse>(`/api/bookings/availability?${query}`);
  return { slots: response.data, duration: Number(response.meta.duration), bufferTime: Number(response.meta.bufferTime) };
}

export async function createBooking(draft: BookingDraft): Promise<Booking> {
  const response = await api<ApiResponse<Booking>>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ ...draft, customerId: draft.customerId ?? '1' }),
  });
  return response.data;
}

export async function fetchBookings(customerId = '1'): Promise<Booking[]> {
  const response = await api<ApiResponse<Booking[]>>(`/api/bookings?customerId=${customerId}`);
  return response.data.map((booking) => ({
    ...booking,
    id: String(booking.id), customerId: String(booking.customerId), serviceId: String(booking.serviceId),
    staffId: booking.staffId == null ? null : String(booking.staffId),
    price: booking.price == null ? undefined : Number(booking.price),
    duration: booking.duration == null ? undefined : Number(booking.duration),
  }));
}
