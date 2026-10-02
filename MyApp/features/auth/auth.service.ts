import { api, ApiError, setToken } from '@/services/api';

/** Hồ sơ người đang đăng nhập, do backend trả về. */
export type AuthUser = {
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  customerId: string | null;
  staffId: string | null;
};

export type Session = { token: string; user: AuthUser };

/**
 * Đăng nhập.
 *
 * Ứng dụng gọi thật vào POST /api/auth/login thay vì tự kiểm tra mật khẩu
 * trong máy như trước. Token nhận được được lưu lại và gửi kèm mọi lệnh
 * gọi sau đó — backend từ đó biết lệch này thuộc về khách nào.
 *
 * Chấp nhận cả số điện thoại và email ở ô "tài khoản".
 */
export async function login(identifier: string, password: string): Promise<Session> {
  const response = await api<{ data: Session }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  await setToken(response.data.token);
  return response.data;
}

/** Đăng ký tài khoản khách mới. Chỉ tạo được vai trò CUSTOMER. */
export async function register(input: {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
}): Promise<Session> {
  const response = await api<{ data: Session }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  await setToken(response.data.token);
  return response.data;
}

/** Đọc lại hồ sơ từ token đang lưu; null nghĩa là phiên đã hết. */
export async function me(): Promise<AuthUser | null> {
  try {
    const response = await api<{ data: AuthUser }>('/api/auth/me');
    return response.data;
  } catch (error) {
    /* 401 là chuyện bình thường: phiên hết hạn thì coi như chưa đăng nhập. */
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Đổi mật khẩu của chính mình. */
export async function changePassword(currentPassword: string, newPassword: string) {
  await api('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** Cập nhật hồ sơ (tên, ảnh, số điện thoại, địa chỉ). */
export async function updateProfile(input: {
  fullName?: string;
  phone?: string;
  avatar?: string;
  address?: string;
}): Promise<AuthUser> {
  const response = await api<{ data: AuthUser }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return response.data;
}

/** Đăng xuất: chỉ xoá token trên máy, không cần gọi máy chủ. */
export async function logout(): Promise<void> {
  await setToken(null);
}