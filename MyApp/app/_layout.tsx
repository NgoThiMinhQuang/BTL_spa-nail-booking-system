import { Stack } from "expo-router";

import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { useEffect } from "react";
import { setupPushNotifications } from "@/lib/push";

export default function RootLayout() {
  /* Đăng ký push một lần khi mở app (có token đăng nhập mới đăng ký
     được; lần mở sau khi login xong sẽ đăng ký — xem thêm profile). */
  useEffect(() => {
    setupPushNotifications();
  }, []);

  return (
    <FavoritesProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="service/[id]" />
        <Stack.Screen name="personal-info" />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            headerShown: true,
          }}
        />
      </Stack>
    </FavoritesProvider>
  );
}
