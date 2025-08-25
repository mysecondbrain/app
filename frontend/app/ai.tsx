import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AiScreen() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = async () => {
    if (!text.trim()) {
      Alert.alert("Hinweis", "Bitte Text eingeben");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/annotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, include_confidence: true })
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      Alert.alert("Fehler", e.message || "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>KI-Annotation testen</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={8}
          placeholder="Text hier eingeben..."
          placeholderTextColor="#888"
          value={text}
          onChangeText={setText}
          maxLength={50000}
        />
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={analyze} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Analysieren</Text>}
        </TouchableOpacity>
        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.section}>Kategorien</Text>
            <View style={styles.rowWrap}>
              {(result.categories || []).map((c: string, idx: number) => (
                <View key={idx} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>
              ))}
            </View>
            <Text style={styles.section}>Tags</Text>
            <View style={styles.rowWrap}>
              {(result.tags || []).map((t: string, idx: number) => (
                <View key={idx} style={[styles.chip, styles.chipGreen]}><Text style={styles.chipText}>{t}</Text></View>
              ))}
            </View>
            <Text style={styles.section}>Summary</Text>
            <Text style={styles.summary}>{result.summary}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#0c0c0c" },
  title: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 16, textAlign: "center" },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    color: "#fff",
    padding: 12,
    minHeight: 160,
    textAlignVertical: "top",
  },
  button: { marginTop: 16, backgroundColor: "#007AFF", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resultBox: { backgroundColor: "#111", borderRadius: 12, padding: 16, marginTop: 24, borderWidth: 1, borderColor: "#2a2a2a" },
  section: { color: "#ddd", fontWeight: "700", marginTop: 8, marginBottom: 4 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap" },
  chip: { backgroundColor: "#333", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, margin: 4 },
  chipGreen: { backgroundColor: "#2a5" },
  chipText: { color: "#fff" },
  summary: { color: "#ccc", marginTop: 6, lineHeight: 20 },
});