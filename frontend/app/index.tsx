import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { initDb, listNotes, createNote, Note, cryptoRandomId, getSetting } from '../src/storage/db';
import { searchCombined } from '../src/search/search';
import { upsertEmbedding } from '../src/search/embeddings';
import { useRecording } from '../src/context/RecordingContext';

export default function Index() {
  const router = useRouter();
  const { isRecording, start, stop } = useRecording();
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [category, setCategory] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    (async () => { await initDb(); setReady(true); refresh(); })();
  }, []);

  useEffect(() => { refresh(); }, [search, pinnedOnly, category, fromDate, toDate]);

  function toEpoch(d: string): number | null { if (!d.trim()) return null; const p = d.split('-'); if (p.length !== 3) return null; const t = new Date(`${p[0]}-${p[1]}-${p[2]}T00:00:00Z`).getTime(); return isNaN(t) ? null : t; }

  const refresh = () => {
    try {
      const from = toEpoch(fromDate); const to = toEpoch(toDate);
      if (search.trim()) {
        const items = searchCombined(search, { pinnedOnly, category: category || null, from, to }, 200) as any as Note[];
        setNotes(items);
      } else {
        const items = listNotes({ search, pinnedOnly, limit: 500 });
        setNotes(items);
      }
    } catch (e) {
      const items = listNotes({ search, pinnedOnly, limit: 500 });
      setNotes(items);
    }
  };

  const onSave = async () => {
    if (!text.trim()) return;
    const id = cryptoRandomId();
    const t = text.trim();
    await createNote({ id, text: t });
    try { await upsertEmbedding(id, t); } catch {}
    setText('');
    refresh();
  };

  const onVoice = async () => {
    if (getSetting('recording_ack_at') ? false : true) { Alert.alert('Hinweis', 'Bitte zuerst Recording-Hinweis im Onboarding bestätigen.'); return; }
    if (!isRecording) {
      const ok = await start();
      if (!ok) Alert.alert('Hinweis', 'Mikrofonberechtigung erforderlich.');
    } else {
      const res = await stop();
      if (res?.uri) {
        const id = cryptoRandomId();
        await createNote({ id, text: 'Sprachnotiz', attachments: [{ uri: res.uri, name: res.uri.split('/').pop(), mime: 'audio/aac', kind: 'audio' }] });
        refresh();
      }
    }
  };

  const togglePinnedFilter = () => setPinnedOnly((p) => !p);

  function highlightSnippet(text: string, q: string): string {
    if (!q.trim()) return text.slice(0, 140);
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, (idx >= 0 ? idx + q.length + 40 : 140));
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  const renderItem = ({ item }: { item: Note }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/note/${item.id}`)}>
      <View style={styles.rowBetween}>
        <Text numberOfLines={1} style={styles.cardTitle}>{item.text}</Text>
        {item.pinned ? <Text style={styles.pill}>PINNED</Text> : null}
      </View>
      {search.trim() ? <Text style={styles.snippet}>{highlightSnippet(item.text, search)}</Text> : null}
      <Text style={styles.cardMeta}>{new Date(item.updatedAt).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  if (!ready) return <View style={styles.center}><ActivityIndicator/></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>Offline Notizen</Text>
        <View style={styles.searchRow}>
          <TextInput style={styles.search}
            placeholder="Frag mich natürlichsprachlich..." placeholderTextColor="#888"
            value={search} onChangeText={setSearch}/>
          <TouchableOpacity style={[styles.filterBtn, pinnedOnly && styles.filterBtnActive]} onPress={togglePinnedFilter}>
            <Text style={styles.filterText}>{pinnedOnly ? 'Nur Pin' : 'Alle'}</Text>
          </TouchableOpacity>
          <Link href="/settings" asChild><TouchableOpacity style={styles.settingsBtn}><Text style={styles.settingsText}>⚙︎</Text></TouchableOpacity></Link>
        </View>
        <View style={styles.filters}>
          <TextInput style={styles.smallInput} placeholder="Kategorie" placeholderTextColor="#888" value={category} onChangeText={setCategory}/>
          <TextInput style={styles.smallInput} placeholder="Von (YYYY-MM-DD)" placeholderTextColor="#888" value={fromDate} onChangeText={setFromDate}/>
          <TextInput style={styles.smallInput} placeholder="Bis (YYYY-MM-DD)" placeholderTextColor="#888" value={toDate} onChangeText={setToDate}/>
        </View>
        <Text style={styles.hint}>Beispiele: „Wo liegt der Schraubenzieher?“, „Habe ich ‘Ibiza’ & ‘Alex’ erwähnt?“</Text>

        <TextInput style={styles.editor} multiline placeholder="Neue Notiz..." placeholderTextColor="#888" value={text} onChangeText={setText}/>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={onSave}><Text style={styles.saveText}>Speichern</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.voiceBtn, { flex: 1 }]} onPress={onVoice}><Text style={styles.saveText}>{isRecording ? 'Stop' : 'Merken (Voice)'}</Text></TouchableOpacity>
        </View>

        <FlatList data={notes} keyExtractor={(n) => n.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 24 }}/>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c', paddingHorizontal: 16, paddingTop: 24 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0c0c' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  search: { flex: 1, backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  filterBtn: { backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  filterBtnActive: { backgroundColor: '#035' },
  filterText: { color: '#fff' },
  settingsBtn: { backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  settingsText: { color: '#fff' },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  smallInput: { flex: 1, backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  hint: { color: '#888', fontSize: 12, marginBottom: 8 },
  editor: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', padding: 12, minHeight: 80, textAlignVertical: 'top', marginVertical: 8 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  voiceBtn: { backgroundColor: '#0a5', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, padding: 12, marginVertical: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontSize: 16, flex: 1, marginRight: 8 },
  cardMeta: { color: '#aaa', marginTop: 6, fontSize: 12 },
  snippet: { color: '#ccc', marginTop: 6 },
  pill: { backgroundColor: '#2a5', color: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
});