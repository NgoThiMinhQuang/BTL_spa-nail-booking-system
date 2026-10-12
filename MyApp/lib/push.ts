import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { registerDevice } from '@/features/notifications/notification.service';
import { getToken } from '@/services/api';

/* Cách foreground hiển thị: vẫn hiện banner + âm thanh để test thấy ngay. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Xin quyền + lấy Expo push token + đăng ký lên backend.
 * Trả lý do rõ ràng để màn hình hiện đúng hướng xử lý, thay vì im lặng.
 */
export async function setupPushNotifications(): Promise<
  { ok: true; token: string } | { ok: false; reason: 'emulator' | 'no-login' | 'denied' | 'token-failed' }
> {
  try {
    if (!Device.isDevice) return { ok: false, reason: 'emulator' };
    if (!(await getToken())) return { ok: false, reason: 'no-login' };

    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const pid = projectId();
    /* Có projectId (EAS) thì dùng; chưa có (mới chỉ chạy Expo Go) thì thử
       không projectId — Expo Go vẫn cấp được token để test ngay. */
    let token: string | null = null;
    try {
      token = (await (pid
        ? Notifications.getExpoPushTokenAsync({ projectId: pid })
        : Notifications.getExpoPushTokenAsync())).data ?? null;
    } catch {
      token = null;
    }
    /* iOS không cấp token khi thiếu projectId — phải chạy `npx eas init`. */
    if (!token) return { ok: false, reason: 'token-failed' };

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'NailHouse',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'token-failed' };
  }
}

/**
 * Trạng thái quyền thông báo của máy: để màn Cá nhân hiện "Đang bật"
 * hay "Chưa bật" + nút bật lại. iOS từng bấm Từ chối thì luôn 'denied'
 * và hệ điều hành không hỏi lại — phải mở Cài đặt thủ công.
 */
export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    if (!Device.isDevice) return 'undetermined';
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/* Bấm vào thông báo (kể cả khi app đang tắt) thì mở đúng màn hình:
   tin gắn lịch hẹn thì vào chi tiết lịch đó để hủy/đổi nhân viên ngay.
   Backend luôn gửi kèm data { refType, refId } trong mỗi tin đẩy. */
function routeFromResponse(response: Notifications.NotificationResponse | null) {
  if (!response) return;
  const data = (response.notification.request.content.data ?? {}) as {
    refType?: string; refId?: string | number;
  };
  if (data.refType === 'booking' && data.refId) {
    router.push({ pathname: '/booking/[id]', params: { id: String(data.refId) } });
  }
}

/**
 * Đăng ký điều hướng khi bấm thông báo — gọi một lần ở layout gốc.
 * Trả hàm hủy đăng ký để layout dọn khi unmount.
 */
export function setupNotificationTapRouting(): () => void {
  /* App bị tắt hẳn rồi bấm tin để mở: tin đó nằm ở response cuối. */
  Notifications.getLastNotificationResponseAsync().then(routeFromResponse).catch(() => null);
  const subscription = Notifications.addNotificationResponseReceivedListener(routeFromResponse);
  return () => subscription.remove();
}
