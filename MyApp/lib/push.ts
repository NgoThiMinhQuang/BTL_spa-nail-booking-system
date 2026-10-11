import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
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
 * Trả null khi: máy ảo (không đẩy được), chưa đăng nhập, hoặc thiếu
 * EAS projectId — các trường hợp này hộp thư trong app vẫn hoạt động.
 */
export async function setupPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    if (!(await getToken())) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const pid = projectId();
    if (!pid) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
    if (!token) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'NailHouse',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    return token;
  } catch {
    return null;
  }
}
