import { Booking, BookingDraft } from './booking.types';

export async function createBooking(draft: BookingDraft): Promise<Booking> {
  return { ...draft, id: `booking-${Date.now()}`, status: 'confirmed' };
}
