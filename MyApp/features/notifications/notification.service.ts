import { api } from '@/services/api';
import type { ApiResponse } from '@/types';

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  refType: string | null;
  refId: string | null;
  channel: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
};

/** Hộp thư của chính mình + số chưa đọc. */
export async function fetchInbox(): Promise<{ items: InboxItem[]; unread: number }> {
  const response = await api<ApiResponse<InboxItem[]> & { meta: { unread: number } }>('/api/notifications/me');
  return { items: response.data, unread: Number(response.meta?.unread ?? 0) };
}

/** Đánh dấu một tin đã đọc. */
export async function markNotificationRead(id: string): Promise<void> {
  await api(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

/** Gửi push token của máy này lên backend để nhận đẩy. */
export async function registerDevice(pushToken: string, platform: string): Promise<void> {
  await api('/api/notifications/device', {
    method: 'POST',
    body: JSON.stringify({ pushToken, platform }),
  });
}
