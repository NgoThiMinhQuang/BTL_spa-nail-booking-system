import { api } from '@/services/api';
import type { ApiResponse } from '@/types';
import type { Availability, Booking, BookingDraft, PaymentStatus } from './booking.types';

type AvailabilityResponse = ApiResponse<string[]> & { meta: { duration: number; bufferTime: number } };

/** Khung giờ còn trống của một chuyên viên trong ngày. */
export async function fetchAvailability(serviceId: string, staffId: string, date: string): Promise<Availability> {
  const query = new URLSearchParams({ serviceId, staffId, date });
  const response = await api<AvailabilityResponse>(`/api/bookings/availability?${query}`);
  return { slots: response.data, duration: Number(response.meta.duration), bufferTime: Number(response.meta.bufferTime) };
}

/** Khách đặt lịch. Không gửi customerId — backend lấy từ token. */
export async function createBooking(draft: BookingDraft): Promise<Booking> {
  const response = await api<ApiResponse<Booking>>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(draft),
  });

  const booking = response.data;

  /* Gắn ảnh khách gửi kèm. Tách riêng khỏi việc tạo lịch vì ảnh là
     nhiều lần ghi, còn lịch chỉ tạo một lần. */
  if (draft.images?.length) {
    await Promise.all(
      draft.images.map((url) =>
        api(`/api/bookings/${booking.id}/images`, {
          method: 'POST',
          body: JSON.stringify({ url }),
        }).catch(() => null),
      ),
    );
  }

  return booking;
}

/** Lịch hẹn của chính khách đang đăng nhập. */
export async function fetchBookings(): Promise<Booking[]> {
  const response = await api<ApiResponse<Booking[]>>('/api/bookings');
  return response.data.map((booking) => ({
    ...booking,
    id: String(booking.id),
    customerId: String(booking.customerId),
    serviceId: String(booking.serviceId),
    staffId: booking.staffId == null ? null : String(booking.staffId),
    price: booking.price == null ? undefined : Number(booking.price),
    duration: booking.duration == null ? undefined : Number(booking.duration),
    bufferTime: Number(booking.bufferTime ?? 0),
    addonTotal: Number(booking.addonTotal ?? 0),
    total: Number(booking.total ?? booking.price ?? 0),
  }));
}

/**
 * Khách tự hủy lịch của mình.
 *
 * Backend quyết định được hủy hay không:
 *   PENDING   → hủy ngay
 *   CONFIRMED → hủy khi còn trên 2 giờ
 *   còn lại    → không hủy được
 * Nên ứng dụng gửi lên rồi hiện thông báo lỗi từ server, không tự suy đoán.
 */
export async function cancelBooking(id: string, reason?: string): Promise<void> {
  await api(`/api/bookings/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export type ReviewDraft = {
  rating: number;
  comment?: string;
  images?: string[];
};

/** Khách đánh giá lịch đã hoàn thành. Mỗi lịch chỉ một lần. */
export async function submitReview(bookingId: string, draft: ReviewDraft) {
  const response = await api<ApiResponse<{ id: string }>>(`/api/bookings/${bookingId}/review`, {
    method: 'POST',
    body: JSON.stringify(draft),
  });
  return response.data;
}

export type PaymentRow = {
  id: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
  method: string | null;
  paidAt: string | null;
  serviceName: string;
  total: number;
  remaining: number;
};

/** Lịch sử thanh toán của khách, kèm số tiền còn phải trả. */
export async function fetchMyPayments(): Promise<PaymentRow[]> {
  const response = await api<ApiResponse<PaymentRow[]>>('/api/customer/payments');
  return response.data;
}