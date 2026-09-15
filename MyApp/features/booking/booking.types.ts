export type BookingStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled' | 'no_show';

export type Booking = {
  id: string;
  customerId: string;
  serviceId: string;
  staffId: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  note?: string | null;
  createdAt?: string;
  serviceName?: string;
  serviceImageUrl?: string | null;
  staffName?: string | null;
  staffAvatarUrl?: string | null;
  price?: number;
  duration?: number;
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
