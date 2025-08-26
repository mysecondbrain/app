import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { setSetting, logAudit } from '../../src/storage/db';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [agb, setAgb] = useState(false);
  const [recAck, setRecAck] = useState(false);
  const [aiOpt, setAiOpt] = useState(false);

  const appVersion = useMemo(() => (Constants.expoConfig?.version || '0.0.0'), []);

  const next = async () => {
    if (step === 1) {
      if (!agb) return;
      await setSetting('consent_agreed_at', String(Date.now()));
      await logAudit({ id: rnd(), at: Date.now(), action: 'consent_accept', meta: { version: appVersion } });
      setStep(2);
    } else if (step === 2) {
      if (!recAck) return;
      await setSetting('recording_ack_at', String(Date.now()));
      await logAudit({ id: rnd(), at: Date.now(), action: 'recording_ack', meta: { version: appVersion } });
      setStep(3);
    } else if (step === 3) {
      await setSetting('ai_online_optin', aiOpt ? '1' : '0');
      await logAudit({ id: rnd(), at: Date.now(), action: 'ai_optin_toggle', meta: { version: appVersion, optin: aiOpt } });
      await setSetting('onboarding_done', '1');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.title}>AGB & Datenschutz</Text>
          <Text style={styles.body}>Platzhaltertexte für AGB/DS. Bitte lesen und akzeptieren.</Text>
          <TouchableOpacity style={[styles.chk, agb && styles.chkOn]} onPress={() => setAgb(!agb)}>
            <Text style={styles.chkText}>{agb ? '✔' : ''}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>Ich habe gelesen & akzeptiere.</Text>
          <TouchableOpacity disabled={!agb} style={[styles.next, !agb && styles.nextDis]} onPress={next}><Text style={styles.nextText}>Weiter</Text></TouchableOpacity>
        </View>
      )}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.title}>Recording-Hinweis</Text>
          <Text style={styles.body}>Rechtshinweis: Aufnahme nur mit Einwilligung der Beteiligten. Nutzung auf eigene Verantwortung.</Text>
          <TouchableOpacity style={[styles.chk, recAck && styles.chkOn]} onPress={() => setRecAck(!recAck)}>
            <Text style={styles.chkText}>{recAck ? '✔' : ''}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>Ich habe die Einwilligung eingeholt / nutze auf eigene Verantwortung.</Text>
          <TouchableOpacity disabled={!recAck} style={[styles.next, !recAck && styles.nextDis]} onPress={next}><Text style={styles.nextText}>Weiter</Text></TouchableOpacity>
        </View>
      )}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.title}>KI-Option</Text>
          <Text style={styles.body}>Online-KI (zusätzliche Kosten/Datentransfer) nur bei Opt-in. Standard AUS.</Text>
          <TouchableOpacity style={[styles.chk, aiOpt && styles.chkOn]} onPress={() => setAiOpt(!aiOpt)}>
            <Text style={styles.chkText}>{aiOpt ? '✔' : ''}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>Online-KI erlauben</Text>
          <TouchableOpacity style={styles.next} onPress={next}><Text style={styles.nextText}>Fertig</Text></TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function rnd() { return Math.random().toString(36).slice(2); }

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0c0c0c', padding: 16, justifyContent: 'center' },
  card: { backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#222', padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  body: { color: '#ccc', marginBottom: 8 },
  chk: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  chkOn: { backgroundColor: '#2a5', borderColor: '#2a5' },
  chkText: { color: '#fff', fontWeight: '800' },
  note: { color: '#aaa', marginTop: 6 },
  next: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  nextDis: { backgroundColor: '#333' },
  nextText: { color: '#fff', fontWeight: '700' },
});