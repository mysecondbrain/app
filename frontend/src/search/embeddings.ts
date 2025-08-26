import { getDbSync } from '../storage/utilDb';
import * as SQLite from 'expo-sqlite';

// Lazy import ORT to avoid crashing if not installed yet
let ort: any = null;
let session: any = null;

const EMB_DIM = 384; // typical small sentence transformer dimension

export async function ensureEmbeddingsTable() {
  const db = getDbSync();
  db.execSync(`CREATE TABLE IF NOT EXISTS embeddings (
    noteId TEXT PRIMARY KEY,
    vec BLOB,
    updatedAt INTEGER
  );`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_embeddings_updatedAt ON embeddings(updatedAt DESC);`);
}

export async function loadOrtAndModel(): Promise<boolean> {
  try {
    if (!ort) {
      // @ts-ignore dynamic
      ort = await import('onnxruntime-react-native');
    }
    if (!session && ort) {
      // In real app, bundle a small ONNX model; here we keep a stub loader
      // Attempt to load from app bundle or return false for degraded mode
      return false; // fallback to deterministic embedding
    }
    return !!session;
  } catch {
    return false;
  }
}

function textToDeterministicVector(text: string): Float32Array {
  // Hash-based deterministic vector as a privacy-preserving fallback
  const v = new Float32Array(EMB_DIM);
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  for (let i = 0; i < EMB_DIM; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    v[i] = ((seed & 0xffff) / 0xffff) * 2 - 1; // [-1,1]
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < EMB_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMB_DIM; i++) v[i] /= norm;
  return v;
}

export async function embedText(text: string): Promise<Float32Array> {
  const ok = await loadOrtAndModel();
  if (!ok) return textToDeterministicVector(text);
  // If an actual model is available, run inference here and return normalized vector
  return textToDeterministicVector(text); // placeholder
}

export async function upsertEmbedding(noteId: string, text: string) {
  await ensureEmbeddingsTable();
  const vec = await embedText(text);
  const db = getDbSync();
  const now = Date.now();
  const blob = float32ToBlob(vec);
  db.runSync(`INSERT OR REPLACE INTO embeddings(noteId, vec, updatedAt) VALUES(?,?,?)`, [noteId, blob, now]);
}

export async function deleteEmbedding(noteId: string) {
  await ensureEmbeddingsTable();
  const db = getDbSync();
  db.runSync(`DELETE FROM embeddings WHERE noteId=?`, [noteId]);
}

export async function reindexAll(progress?: (done: number, total: number) => void) {
  await ensureEmbeddingsTable();
  const db = getDbSync();
  const rows = db.getAllSync<any>(`SELECT id, text FROM notes WHERE deletedAt IS NULL`);
  const total = rows.length;
  for (let i = 0; i < total; i++) {
    const r = rows[i];
    await upsertEmbedding(r.id, r.text || '');
    if (progress && i % 5 === 0) progress(i + 1, total);
    // Yield to UI loop using a small delay
    await new Promise((res) => setTimeout(res, 0));
  }
  if (progress) progress(total, total);
}

export function float32ToBlob(arr: Float32Array): Uint8Array {
  const buf = new ArrayBuffer(arr.length * 4);
  new Float32Array(buf).set(arr);
  return new Uint8Array(buf);
}

export function blobToFloat32(blob: Uint8Array): Float32Array {
  return new Float32Array(blob.buffer, blob.byteOffset, Math.floor(blob.byteLength / 4));
}