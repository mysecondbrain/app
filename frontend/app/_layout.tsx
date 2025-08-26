import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RecordingProvider, useRecording } from '../src/context/RecordingContext';
import { getSetting } from '../src/storage/db';

function Banner() {
  const { isRecording } = useRecording();
  if (!isRecording) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>AUFNAHME LÄUFT</Text>
    </View>
  );
}

function Gatekeeper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  useEffect(() => {
    const done = getSetting('onboarding_done') === '1';
    const inOnboarding = segments[0] === 'onboarding';
    if (!done && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [router, segments]);
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <RecordingProvider>
      <Gatekeeper>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Home' }} />
          <Stack.Screen name="ai" options={{ title: 'AI Annotation' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Einstellungen' }} />
          <Stack.Screen name="settings/storage" options={{ title: 'Speicherverwaltung' }} />
          <Stack.Screen name="settings/legal" options={{ title: 'Recht & Datenschutz' }} />
          <Stack.Screen name="note/[id]" options={{ title: 'Notiz' }} />
          <Stack.Screen name="onboarding/index" options={{ title: 'Willkommen' }} />
        </Stack>
        <Banner />
      </Gatekeeper>
    </RecordingProvider>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#d22', paddingVertical: 6, alignItems: 'center', zIndex: 1000 },
  bannerText: { color: '#fff', fontWeight: '800' },
});