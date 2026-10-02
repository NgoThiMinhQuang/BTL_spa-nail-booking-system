/* ===== Gắn token đăng nhập vào MỌI lệnh gọi API =====

   Trước đây không có lớp đăng nhập thật: màn hình đăng nhập chỉ so chuỗi
   trong mã nguồn rồi tự chế dữ liệu, và các API nhận thẳng staffId từ
   URL. Nay nhân viên đăng nhập thật, nhận token JWT và gửi kèm mọi yêu
   cầu; backend tự xác định nhân viên đang đăng nhập nên không thể xem
   lịch của người khác chỉ bằng cách đổi con số trên thanh địa chỉ. */

const TOKEN_KEY = 'nailhouse_token';

export function installAuthFetch(): void {
  const original = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
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