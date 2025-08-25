import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getNote, updateNote } from '../../src/storage/db';

export default function NoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [pinned, setPinned] = useState(0);

  useEffect(() => {
    const n = getNote(String(id));
    if (n) {
      setText(n.text);
      setTags((n.tags || []).join(', '));
      setPinned(n.pinned || 0);
    }
  }, [id]);

  const onSave = async () => {
    await updateNote(String(id), {
      text,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      pinned,
    });
    router.back();
  };

  const togglePin = () => setPinned((p) => (p ? 0 : 1));

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
  saveBtn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});