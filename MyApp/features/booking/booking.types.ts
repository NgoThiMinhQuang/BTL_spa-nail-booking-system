export type BookingStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled' | 'no_show';

/** Trạng thái thanh toán, tách khỏi trạng thái lịch. */
export type PaymentStatus = 'UNPAID' | 'DEPOSITED' | 'PAID';

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
  cancelReason?: string | null;
  cancelledAt?: string | null;
  serviceName?: string;
  serviceImageUrl?: string | null;
  staffName?: string | null;
  staffAvatarUrl?: string | null;
  /* Giá và thời lượng lấy từ snapshot lúc đặt, không phải giá hiện tại của
     dịch vụ — nên đổi giá dịch vụ sau này không làm lịch cũ nhảy số tiền. */
  price?: number;
  duration?: number;
  bufferTime?: number;
  addonTotal?: number;
  addonCount?: number;
  /** Tổng tiền = price + addonTotal. */
  total?: number;
  paymentStatus?: PaymentStatus | null;
  paymentMethod?: string | null;
  paidAmount?: number | null;
};

/* KHÔNG còn customerId trong BookingDraft.

   Trước đây ứng dụng gửi customerId: '1' cứng trong mã nguồn — bất kỳ ai
   cũng đặt được lịch dưới tên một khách khác. Nay backend lấy customerId
   từ token đăng nhập nên ứng dụng không cần (và không nên) truyền. */
export type BookingDraft = {
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  note?: string;
  /** Ảnh mẫu móng khách gửi kèm lịch hẹn. */
  images?: string[];
};

export type Availability = {
  slots: string[];
  duration: number;
  bufferTime: number;
};