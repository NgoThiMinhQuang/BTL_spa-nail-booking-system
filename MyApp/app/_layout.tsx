import { Stack } from "expo-router";

import { FavoritesProvider } from "@/contexts/FavoritesContext";

export default function RootLayout() {
  return (
    <FavoritesProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
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
