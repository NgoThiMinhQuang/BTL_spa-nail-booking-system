export type BookingStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

export type Booking = {
  id: string;
  customerId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  note?: string | null;
};

export type BookingDraft = {
  customerId?: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  note?: string;
};

export type Availability = {
  slots: string[];
  duration: number;
  bufferTime: number;
};
