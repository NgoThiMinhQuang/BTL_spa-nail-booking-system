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
