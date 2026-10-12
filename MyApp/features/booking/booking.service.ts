import { api, uploadFiles } from '@/services/api';
import type { ApiResponse } from '@/types';
import type { Availability, Booking, BookingDetail, BookingDraft, PaymentStatus, StaffOption } from './booking.types';

type AvailabilityResponse = ApiResponse<string[]> & { meta: { duration: number; bufferTime: number } };

/** Khung giờ còn trống trong ngày. Bỏ trống staffId nghĩa là
    "bất kỳ chuyên viên" — backend hợp nhất giờ của mọi người làm được. */
export async function fetchAvailability(serviceId: string, staffId: string, date: string): Promise<Availability> {
  const query = new URLSearchParams({ serviceId, date });
  if (staffId) query.set('staffId', staffId);
  const response = await api<AvailabilityResponse>(`/api/bookings/availability?${query}`);
  return { slots: response.data, duration: Number(response.meta.duration), bufferTime: Number(response.meta.bufferTime) };
}

export type DepositIntent = {
  bookingId: string;
  paymentUrl: string;
  mock: boolean;
  deposit: number;
  total: number;
  remaining: number;
  rate: number;
  expiresAt: string | null;
  windowMinutes: number;
};

/** Xin URL thanh toán đặt cọc 30% cho lịch PENDING của chính mình. */
export async function createDepositIntent(bookingId: string): Promise<DepositIntent> {
  const response = await api<ApiResponse<DepositIntent>>(`/api/bookings/${encodeURIComponent(bookingId)}/deposit-intent`, {
    method: 'POST',
  });
  const intent = response.data;
  return {
    ...intent,
    bookingId: String(intent.bookingId),
    deposit: Number(intent.deposit),
    total: Number(intent.total),
    remaining: Number(intent.remaining),
  };
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

/**
 * Upload file ảnh mẫu đã chọn trên máy lên lịch vừa tạo.
 * Tách khỏi createBooking vì cần bookingId — gọi sau khi đặt thành công.
 */
export async function uploadBookingImages(
  bookingId: string, uris: string[],
): Promise<{ id: string; url: string }[]> {
  if (!uris.length) return [];
  const response = await uploadFiles<{ data: { id: string; url: string }[] }>(
    `/api/bookings/${bookingId}/images/upload`, uris,
  );
  return response.data;
}

/** Chi tiết một lịch hẹn của chính mình — màn hình xem chi tiết. */
export async function fetchBookingDetail(id: string): Promise<BookingDetail> {
  const response = await api<ApiResponse<BookingDetail>>(
    `/api/bookings/${encodeURIComponent(id)}`,
  );
  const booking = response.data;
  return {
    ...booking,
    id: String(booking.id),
    customerId: String(booking.customerId),
    serviceId: String(booking.serviceId),
    staffId: booking.staffId == null ? null : String(booking.staffId),
    price: Number(booking.price ?? 0),
    duration: booking.duration == null ? undefined : Number(booking.duration),
    bufferTime: Number(booking.bufferTime ?? 0),
    addonTotal: Number(booking.addonTotal ?? 0),
    total: Number(booking.total ?? booking.price ?? 0),
    paidAmount: booking.paidAmount == null ? null : Number(booking.paidAmount),
  };
}

/** Lịch hẹn của chính khách đang đăng nhập. */
export async function fetchBookings(): Promise<Booking[]> {  const response = await api<ApiResponse<Booking[]>>('/api/bookings');
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
 *   CONFIRMED → hủy khi còn trên 2 giờ (trừ lịch bị biến động do lỗi cửa hàng)
 *   còn lại    → không hủy được
 * Nên ứng dụng gửi lên rồi hiện thông báo lỗi từ server, không tự suy đoán.
 * Lỗi cửa hàng thì được hoàn đủ — backend trả shopFault + forfeitMessage.
 */
export async function cancelBooking(id: string, reason?: string): Promise<{
  forfeited: number; refunded: number; shopFault: boolean; forfeitMessage: string | null;
}> {
  const response = await api<ApiResponse<{
    forfeited: number; refunded: number; shopFault: boolean; forfeitMessage: string | null;
  }>>(`/api/bookings/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
  return response.data;
}

/**
 * Khách tự đổi ngày/giờ lịch PENDING/CONFIRMED của mình. Giữ nguyên nhân
 * viên và tiền cọc — backend kiểm tra lại ca, nghỉ và trùng lịch.
 */
export async function rescheduleBooking(
  id: string, draft: { date: string; time: string },
): Promise<{ id: string; startsAt: string; endsAt: string }> {
  const response = await api<ApiResponse<{ id: string; startsAt: string; endsAt: string }>>(
    `/api/bookings/${id}/reschedule`,
    { method: 'PATCH', body: JSON.stringify(draft) },
  );
  return response.data;
}

export type StaffOptions = {
  currentStaffId: string | null;
  available: StaffOption[];
  blocked: (StaffOption & { reason: string })[];
};

/** Người còn trống đúng khung giờ của lịch — loại sẵn người hiện tại. */
export async function fetchStaffOptions(id: string): Promise<StaffOptions> {
  const response = await api<ApiResponse<StaffOptions>>(
    `/api/bookings/${encodeURIComponent(id)}/staff-options`,
  );
  return response.data;
}

/**
 * Khách chốt đổi sang nhân viên khác (giữ nguyên giờ và tiền cọc).
 * Backend kiểm tra lại người mới có làm được dịch vụ và rảnh giờ đó không.
 */
export async function changeBookingStaff(
  id: string, staffId: string,
): Promise<{ id: string; staffId: string; staffName: string }> {
  const response = await api<ApiResponse<{ id: string; staffId: string; staffName: string }>>(
    `/api/bookings/${encodeURIComponent(id)}/staff`,
    { method: 'PATCH', body: JSON.stringify({ staffId }) },
  );
  return response.data;
}

export type ReviewDraft = {
  rating: number;
  comment?: string;
  images?: string[];
};

/** Biên nhận thanh toán của chính mình: từng lần thu/hoàn + còn phải thu. */
export async function fetchReceipt(id: string): Promise<{
  bookingId: string; receiptNo: string | null; status: string;
  service: { name: string; price: number };
  addons: { name: string; quantity: number; price: number; total: number }[];
  total: number; collected: number; refunded: number; remaining: number;
  paymentStatus: string | null;
  transactions: {
    id: string; type: string; amount: number; method: string | null; paidAt: string;
    txnStatus?: string; isMock?: boolean;
  }[];
}> {
  const response = await api<ApiResponse<{
    bookingId: string; receiptNo: string | null; status: string;
    service: { name: string; price: number };
    addons: { name: string; quantity: number; price: number; total: number }[];
    total: number; collected: number; refunded: number; remaining: number;
    paymentStatus: string | null;
    transactions: {
      id: string; type: string; amount: number; method: string | null; paidAt: string;
      txnStatus?: string; isMock?: boolean;
    }[];
  }>>(`/api/bookings/${encodeURIComponent(id)}/receipt`);
  return response.data;
}

/** Khách báo sai lệch thanh toán cho lịch của mình (Admin thấy ở trang Thông báo). */
export async function reportPaymentIssue(bookingId: string, message: string): Promise<void> {
  await api('/api/notifications/support', {
    method: 'POST',
    body: JSON.stringify({ bookingId, message }),
  });
}
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