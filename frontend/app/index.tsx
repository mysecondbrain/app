import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { initDb, listNotes, createNote, Note, cryptoRandomId } from '../src/storage/db';
import { searchCombined } from '../src/search/search';
import { upsertEmbedding } from '../src/search/embeddings';

export default function Index() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    (async () => { await initDb(); setReady(true); refresh(); })();
  }, []);

  useEffect(() => { refresh(); }, [search, pinnedOnly]);

  const refresh = () => {
    try {
      if (search.trim()) {
        // combined search
        const items = searchCombined(search, { pinnedOnly }, 200) as any as Note[];
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

  const togglePinnedFilter = () => setPinnedOnly((p) => !p);

  const renderItem = ({ item }: { item: Note }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/note/${item.id}`)}>
      <View style={styles.rowBetween}>
        <Text numberOfLines={1} style={styles.cardTitle}>{item.text}</Text>
        {item.pinned ? <Text style={styles.pill}>PINNED</Text> : null}
      </View>
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

        <TextInput style={styles.editor} multiline placeholder="Neue Notiz..." placeholderTextColor="#888" value={text} onChangeText={setText}/>
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}><Text style={styles.saveText}>Speichern</Text></TouchableOpacity>

        <FlatList data={notes} keyExtractor={(n) => n.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 24 }}/>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c', paddingHorizontal: 16, paddingTop: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0c0c' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  search: { flex: 1, backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  filterBtn: { backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  filterBtnActive: { backgroundColor: '#035' },
  filterText: { color: '#fff' },
  settingsBtn: { backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  settingsText: { color: '#fff' },
  editor: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, borderRadius: 8, color: '#fff', padding: 12, minHeight: 80, textAlignVertical: 'top', marginVertical: 8 },
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, padding: 12, marginVertical: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontSize: 16, flex: 1, marginRight: 8 },
  cardMeta: { color: '#aaa', marginTop: 6, fontSize: 12 },
  pill: { backgroundColor: '#2a5', color: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
});