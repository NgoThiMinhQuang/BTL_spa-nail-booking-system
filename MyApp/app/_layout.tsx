import { Stack } from "expo-router";

export default function RootLayout() {
  return (
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
  );
}
