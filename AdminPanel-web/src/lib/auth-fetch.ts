/* ===== Gắn token đăng nhập vào MỌI lệnh gọi API =====
   Có hàng chục chỗ gọi fetch('/api/admin/...') rải rác trong các trang và
   hộp thoại. Gán token ở từng chỗ thì dễ sót, và sót một chỗ nghĩa là
   thao tác đó sẽ bị backend từ chối mà không ai hiểu vì sao.

   Nên bọc fetch một lần ở đây: mọi yêu cầu tới /api/* đều tự mang
   Authorization: Bearer <token>. Backend vẫn là nơi kiểm tra thật —
   đây chỉ là cách gửi token đi. */

const TOKEN_KEY = 'nailhouse_token';

export function installAuthFetch(): void {
  const original = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    /* Chỉ các đường dẫn API của ứng dụng mới cần token. */
    if (!url.includes('/api/')) return original(input, init);

    let token: string | null = null;
    try {
      token = localStorage.getItem(TOKEN_KEY);
    } catch { /* trình duyệt chặn lưu trữ */ }

    const headers = new Headers(init.headers ?? {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return original(input, { ...init, headers });
  }) as typeof window.fetch;
}