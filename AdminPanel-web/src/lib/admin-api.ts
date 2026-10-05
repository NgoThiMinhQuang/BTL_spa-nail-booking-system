/* Lệnh gọi API khu quản trị dùng chung cho các trang.
   Token đã được gắn tự động bởi lib/auth-fetch.ts nên ở đây chỉ cần
   đường dẫn, method và body. Trả về { ok, message, data } để trang hiện
   đúng thông điệp nghiệp vụ từ backend (ví dụ 409 khi duyệt ca bỏ rơi
   lịch) thay vì một câu lỗi chung chung. */

export type AdminResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export async function sendAdmin<T = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<AdminResult<T>> {
  try {
    const response = await fetch(`/api/admin${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        (payload as { reason?: string; message?: string } | null)?.reason
        ?? (payload as { message?: string } | null)?.message
        ?? 'Máy chủ không nhận yêu cầu.';
      return { ok: false, message };
    }
    return { ok: true, data: (payload as { data: T }).data };
  } catch {
    return { ok: false, message: 'Mất kết nối tới máy chủ. Vui lòng thử lại.' };
  }
}
