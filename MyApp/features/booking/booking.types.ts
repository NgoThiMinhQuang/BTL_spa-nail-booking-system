export type Booking = {
  id: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
};

export type BookingDraft = Omit<Booking, 'id' | 'status'>;
