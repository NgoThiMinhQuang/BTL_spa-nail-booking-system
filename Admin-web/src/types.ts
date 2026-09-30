/* ===== Kiểu dữ liệu API (khớp 1-1 với staff-dashboard.controller.js) ===== */

export type BookingStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING'
  | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface StaffProfile {
  id: number;
  name: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  experienceYears: number;
  rating: number;
}

export interface Booking {
  id: number;
  /** 'YYYY-MM-DD HH:mm' — chuỗi, không phải Date */
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  note: string | null;
  customerId: number;
  createdAt: string;
  customerName: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  serviceName: string;
  duration: number;
  price: number;
  serviceImage: string | null;
  serviceDescription: string | null;
  bufferTime: number | null;
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  address: string | null;
  birthday: string | null;
  note: string | null;
  total_spending: number;
  no_show_count: number;
  visits: number;
  lastVisit: string;
  rating: number;
  reviewCount: number;
}

export interface ServiceItem {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  duration: number;
  category: string | null;
  categoryId?: number | null;
  /** 'ACTIVE' đang mở bán cho khách · 'HIDDEN' nhân viên đang tạm ngưng. */
  status: ServiceStatus;
}

export type ServiceStatus = 'ACTIVE' | 'HIDDEN';

export interface Shift {
  date: string;
  start: string;
  end: string;
  status: string;
}

export interface Dashboard {
  profile: StaffProfile;
  bookings: Booking[];
  customers: CustomerSummary[];
  services: ServiceItem[];
  shifts: Shift[];
  date: string;
}

export interface StaffOption {
  id: number;
  name: string;
}

export interface HistoryItem {
  id: string;
  startsAt: string;
  date: string;
  time: string;
  status: BookingStatus;
  serviceName: string;
  price: number;
  duration: number;
  note: string | null;
  rating: number | null;
  comment: string | null;
}

export interface CustomerDetail {
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    avatar: string | null;
    address: string | null;
    birthday: string | null;
    note: string | null;
    total_spending: number;
    no_show_count: number;
    memberSince: string | null;
    totalVisits: number;
    lastVisit: string | null;
    rating: number;
    reviewCount: number;
  };
  history: HistoryItem[];
}
