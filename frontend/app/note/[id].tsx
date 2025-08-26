import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getNote, updateNote, getSetting } from '../../src/storage/db';

export default function NoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [pinned, setPinned] = useState(0);
  const [category, setCategory] = useState('');
  const [summary, setSummary] = useState('');

  useEffect(() => {
    const n = getNote(String(id));
    if (n) {
      setText(n.text);
      setTags((n.tags || []).join(', '));
      setPinned(n.pinned || 0);
      setCategory(n.category || '');
      // summary optional: loaded when present
      // @ts-ignore (summary added at migration v3)
      if ((n as any).summary) setSummary((n as any).summary);
    }
  }, [id]);

  const onSave = async () => {
    await updateNote(String(id), {
      text,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      pinned,
      category: category || null,
      // @ts-ignore
      summary,
    });
    router.back();
  };

  const togglePin = () => setPinned((p) => (p ? 0 : 1));

  const runAI = async () => {
    if (getSetting('ai_online_optin') !== '1') { Alert.alert('Hinweis', 'Online-KI ist deaktiviert.'); return; }
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/ai/annotate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, include_confidence: true })
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setCategory((json.categories || [])[0] || '');
      setTags((json.tags || []).join(', '));
      setSummary(json.summary || '');
      Alert.alert('KI', 'Aktualisiert. Bitte speichern, um zu übernehmen.');
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Unbekannter Fehler');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Notiz</Text>
          <TouchableOpacity style={[styles.pinBtn, pinned ? styles.pinOn : styles.pinOff]} onPress={togglePin}>
            <Text style={styles.pinText}>{pinned ? 'Unpin' : 'Pin'}</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.input} multiline value={text} onChangeText={setText} placeholder="Text" placeholderTextColor="#888"/>
        <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="Tags (comma separated)" placeholderTextColor="#888"/>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Kategorie" placeholderTextColor="#888"/>
        <Text style={styles.label}>Kurz-Zusammenfassung</Text>
        <TextInput style={styles.summary} multiline value={summary} onChangeText={setSummary} placeholder="Summary" placeholderTextColor="#888"/>
        <TouchableOpacity style={[styles.btn, { marginTop: 8 }]} onPress={runAI}><Text style={styles.btnText}>KI aktualisieren</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}><Text style={styles.saveText}>Speichern</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c', padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  pinBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pinOn: { backgroundColor: '#2a5' },
  pinOff: { backgroundColor: '#333' },
  pinText: { color: '#fff' },
  input: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', padding: 12, minHeight: 60, textAlignVertical: 'top', marginVertical: 8 },
  label: { color: '#aaa', marginTop: 8 },
  summary: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', padding: 12, minHeight: 80, textAlignVertical: 'top', marginVertical: 8 },
  btn: { backgroundColor: '#444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});