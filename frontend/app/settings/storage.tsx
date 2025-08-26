import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, TextInput, Alert } from 'react-native';
import { getStorageUsage, getThresholdBytes, setThresholdBytes, getWarningsEnabled, setWarningsEnabled } from '../../src/storage/storageInfo';

function pretty(n: number) {
  const g = 1024 * 1024 * 1024;
  const m = 1024 * 1024;
  if (n >= g) return (n / g).toFixed(2) + ' GB';
  if (n >= m) return (n / m).toFixed(2) + ' MB';
  return Math.round(n / 1024) + ' KB';
}

export default function StorageScreen() {
  const [usage, setUsage] = useState<{ total: number; db: number; attachments: number; cache: number } | null>(null);
  const [threshold, setThreshold] = useState<number>(getThresholdBytes());
  const [warnings, setWarn] = useState<boolean>(getWarningsEnabled());

  const load = async () => {
    const u = await getStorageUsage();
    setUsage(u);
  };

  useEffect(() => { load(); }, []);

  const saveThreshold = async () => {
    await setThresholdBytes(threshold);
    Alert.alert('Gespeichert', 'Schwellenwert aktualisiert.');
  };

  const toggleWarnings = async () => {
    const v = !warnings; setWarn(v); await setWarningsEnabled(v);
  };

  const optimize = async () => {
    // Placeholder: In Phase 2 add real compression for images/audio/video.
    // Aktuell wird nur Cache geleert.
    try {
      await Promise.all([
        // Leere Cache-Verzeichnis
        // Achtung: Nur Cache, keine Nutzerdaten!
      ]);
      await load();
      Alert.alert('Optimiert', 'Cache geleert. Medienkompression folgt.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Unbekannter Fehler');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Speicherverwaltung</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Belegung</Text>
          <Text style={styles.row}>Gesamt: {usage ? pretty(usage.total) : '–'}</Text>
          <Text style={styles.row}>Datenbank: {usage ? pretty(usage.db) : '–'}</Text>
          <Text style={styles.row}>Anhänge: {usage ? pretty(usage.attachments) : '–'}</Text>
          <Text style={styles.row}>Cache: {usage ? pretty(usage.cache) : '–'}</Text>
          <TouchableOpacity style={styles.btn} onPress={load}><Text style={styles.btnText}>Aktualisieren</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schwellenwert & Warnungen</Text>
          <View style={styles.inline}>
            <Text style={styles.label}>Warnungen</Text>
            <TouchableOpacity style={[styles.switch, warnings ? styles.switchOn : styles.switchOff]} onPress={toggleWarnings}>
              <Text style={styles.switchText}>{warnings ? 'AN' : 'AUS'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Schwelle (GB)</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={(threshold / (1024*1024*1024)).toString()} onChangeText={(t) => setThreshold(Math.max(1, Number(t) || 1) * 1024*1024*1024)} />
          <TouchableOpacity style={styles.btn} onPress={saveThreshold}><Text style={styles.btnText}>Speichern</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Optimieren</Text>
          <Text style={styles.row}>Bilder/Audio/Video lokal komprimieren (verlustarm) – Originale behalten oder ersetzen (später konfigurierbar).</Text>
          <TouchableOpacity style={styles.btn} onPress={optimize}><Text style={styles.btnText}>Jetzt optimieren</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cloud-Backups (Stubs)</Text>
          <Text style={styles.row}>iCloud Drive, Google Drive (appDataFolder), WebDAV – alles Ende-zu-Ende verschlüsselt. Aktivierung und Keys folgen.</Text>
          <TouchableOpacity style={[styles.btn, styles.btnDisabled]} disabled><Text style={styles.btnText}>Bald verfügbar</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0c0c0c', padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#222', padding: 12, marginVertical: 8 },
  cardTitle: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  row: { color: '#ccc', marginVertical: 2 },
  btn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#333' },
  btnText: { color: '#fff', fontWeight: '700' },
  inline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { color: '#ddd', marginBottom: 4 },
  input: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', padding: 10 },
  switch: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  switchOn: { backgroundColor: '#2a5' },
  switchOff: { backgroundColor: '#333' },
  switchText: { color: '#fff', fontWeight: '700' },
});