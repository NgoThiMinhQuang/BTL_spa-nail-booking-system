import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl;
  }
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000`;
  }
  return 'http://10.0.2.2:3000';
};

const API_URL = getApiUrl();

/* Token đăng nhập lưu trên máy. Backend dùng nó để biết yêu cầu này của ai
   và khách nào sở hữu lịch hẹn — không còn truyền customerId trong URL. */
const TOKEN_KEY = 'nailhouse_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let cachedToken: string | null = null;
let tokenLoaded = false;

/** Đọc token đã lưu. Cache lại để mọi lệnh gọi sau không phải đọc lại. */
export async function getToken(): Promise<string | null> {
  if (!tokenLoaded) {
    try {
      cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      cachedToken = null;
    }
    tokenLoaded = true;
  }
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  tokenLoaded = true;
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* Máy không cho lưu trữ thì phiên vẫn dùng được trong lúc mở app */
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    /* 403 khi đang có token: nhiều khả năng token đó thuộc nhân viên/quản trị còn
       sót trong máy, còn ứng dụng này chỉ dành cho khách. Hỏi lại vai trò thật
       qua /api/auth/me thay vì đoán theo chữ trong thông điệp — chữ do backend
       chọn và có thể đổi, còn vai trò thì không. */
    if (response.status === 403 && token) {
      const me = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (me?.ok) {
        const { user } = (await me.json()) as { user?: { role?: string } };
        if (user?.role && user.role !== 'CUSTOMER') await setToken(null);
      }
    }

    throw new ApiError(response.status, payload?.message ?? `API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}