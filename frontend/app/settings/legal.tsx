import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { getSetting, listAudit } from '../../src/storage/db';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function Legal() {
  const consentAgreedAt = getSetting('consent_agreed_at');
  const recordingAckAt = getSetting('recording_ack_at');
  const aiOptIn = getSetting('ai_online_optin') === '1';
  const [busy, setBusy] = useState(false);

  const last = useMemo(() => ({
    consent: consentAgreedAt ? new Date(Number(consentAgreedAt)).toLocaleString() : '–',
    recording: recordingAckAt ? new Date(Number(recordingAckAt)).toLocaleString() : '–',
    ai: aiOptIn ? 'AKTIV' : 'AUS',
  }), [consentAgreedAt, recordingAckAt, aiOptIn]);

  const exportLogs = async () => {
    try {
      setBusy(true);
      const logs = listAudit(1000);
      const csvHeader = 'at,action,meta\n';
      const csv = csvHeader + logs.map(l => `${new Date(l.at).toISOString()},${l.action},${JSON.stringify(l.meta || {})}`).join('\n');
      const tmp = FileSystem.cacheDirectory + `audit-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(tmp, csv);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(tmp, { mimeType: 'text/csv' });
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Unbekannter Fehler');
    } finally { setBusy(false); }
  };

  const exportJson = async () => {
    try {
      setBusy(true);
      const logs = listAudit(1000);
      const tmp = FileSystem.cacheDirectory + `audit-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(tmp, JSON.stringify(logs, null, 2));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(tmp, { mimeType: 'application/json' });
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Unbekannter Fehler');
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recht & Datenschutz</Text>
      <Text style={styles.row}>AGB/DS akzeptiert: {last.consent}</Text>
      <Text style={styles.row}>Recording-Hinweis bestätigt: {last.recording}</Text>
      <Text style={styles.row}>KI-Opt-in: {last.ai}</Text>
      <TouchableOpacity style={styles.btn} onPress={exportLogs} disabled={busy}><Text style={styles.btnText}>Protokoll exportieren (CSV)</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={exportJson} disabled={busy}><Text style={styles.btnText}>Protokoll exportieren (JSON)</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c', padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { color: '#ccc', marginBottom: 6 },
  btn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  btnSecondary: { backgroundColor: '#333' },
  btnText: { color: '#fff', fontWeight: '700' },
});