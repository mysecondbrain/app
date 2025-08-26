import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { getRecoveryKeyBase58, exportSnapshot, importSnapshotInteractively } from '../../src/storage/snapshots';
import { Link } from 'expo-router';
import { getSetting, setSetting } from '../../src/storage/db';
import { reindexAll } from '../../src/search/embeddings';

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [aiOptIn, setAiOptIn] = useState(false);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    setAiOptIn(getSetting('ai_online_optin') === '1');
  }, []);

  const saveOptIn = async (v: boolean) => {
    setAiOptIn(v);
    await setSetting('ai_online_optin', v ? '1' : '0');
  };

  const onShowRecovery = async () => {
    try {
      setBusy(true);
      const r = await getRecoveryKeyBase58();
      setRecovery(r);
      Alert.alert('Recovery-Key', r);
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Unbekannter Fehler');
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    try { setBusy(true); await exportSnapshot(); Alert.alert('Export', 'Snapshot erstellt.'); }
    catch (e: any) { Alert.alert('Fehler', e.message || 'Unbekannter Fehler'); }
    finally { setBusy(false); }
  };

  const onImport = async () => {
    try { setBusy(true); await importSnapshotInteractively(); Alert.alert('Import', 'Snapshot importiert.'); }
    catch (e: any) { Alert.alert('Fehler', e.message || 'Unbekannter Fehler'); }
    finally { setBusy(false); }
  };

  const onReindex = async () => {
    try {
      setBusy(true); setProgress('Starte Neuaufbau...');
      await reindexAll((done, total) => setProgress(`${done}/${total}`));
      setProgress('Fertig');
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Unbekannter Fehler');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Einstellungen</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Online-KI erlauben</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.row}>Ohne Opt-in werden keine Daten an KI gesendet.</Text>
            <Switch value={aiOptIn} onValueChange={saveOptIn} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Index & Embeddings</Text>
          <TouchableOpacity style={styles.btn} onPress={onReindex} disabled={busy}><Text style={styles.btnText}>Reindex starten</Text></TouchableOpacity>
          {progress ? <Text style={styles.row}>Fortschritt: {progress}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sicherheit & Schlüssel</Text>
          <TouchableOpacity style={styles.btn} onPress={onShowRecovery} disabled={busy}>
            <Text style={styles.btnText}>Recovery-Key anzeigen</Text>
          </TouchableOpacity>
          {recovery ? <Text style={styles.recovery}>{recovery}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backups (lokale Snapshots, E2E)</Text>
          <TouchableOpacity style={styles.btn} onPress={onExport} disabled={busy}>
            <Text style={styles.btnText}>Snapshot exportieren</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onImport} disabled={busy}>
            <Text style={styles.btnText}>Snapshot importieren</Text>
          </TouchableOpacity>
          <Link href="/settings/storage" asChild>
            <TouchableOpacity style={[styles.btn, { marginTop: 12 }]} disabled={busy}>
              <Text style={styles.btnText}>Speicherverwaltung</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {busy ? <ActivityIndicator color="#fff" style={{ marginTop: 8 }} /> : null}
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  btnSecondary: { backgroundColor: '#333' },
  btnText: { color: '#fff', fontWeight: '700' },
  recovery: { color: '#ddd', marginTop: 8, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
});