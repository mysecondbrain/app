import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="ai" options={{ title: 'AI Annotation' }} />
      <Stack.Screen name="settings/index" options={{ title: 'Einstellungen' }} />
      <Stack.Screen name="note/[id]" options={{ title: 'Notiz' }} />
    </Stack>
  );
}