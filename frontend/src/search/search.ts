import { getDbSync } from '../storage/utilDb';
import { blobToFloat32 } from './embeddings';

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

export type SearchFilters = { pinnedOnly?: boolean; category?: string | null; from?: number | null; to?: number | null };

export function searchCombined(query: string, filters?: SearchFilters, limit = 50) {
  const db = getDbSync();
  const qTokens = tokenize(query);
  const like = `%${query.replace(/%/g, '')}%`;
  let sql = `SELECT * FROM notes WHERE deletedAt IS NULL`;
  const params: any[] = [];
  if (filters?.pinnedOnly) sql += ` AND pinned=1`;
  if (filters?.category) { sql += ` AND category=?`; params.push(filters.category); }
  if (filters?.from) { sql += ` AND updatedAt>=?`; params.push(filters.from); }
  if (filters?.to) { sql += ` AND updatedAt<=?`; params.push(filters.to); }
  if (query.trim()) { sql += ` AND (text LIKE ? OR tags LIKE ? OR category LIKE ?)`; params.push(like, like, like); }
  sql += ` ORDER BY updatedAt DESC LIMIT 500`; // get a candidate set first

  const rows = db.getAllSync<any>(sql, params);

  // TF-like keyword score
  function keywordScore(text: string): number {
    if (!qTokens.length) return 0;
    const tokens = tokenize(text);
    const freq: Record<string, number> = {};
    for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
    let score = 0;
    for (const q of qTokens) score += (freq[q] || 0);
    return score / Math.sqrt(tokens.length + 1);
  }

  // Embedding cosine similarity if embedding exists
  function cosine(a: Float32Array, b: Float32Array): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length && i < b.length; i++) { dot += a[i] * b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
    const d = (Math.sqrt(na) * Math.sqrt(nb)) || 1;
    return dot / d;
  }

  // Build query embedding deterministically (same logic as fallback) to compare fairly without ORT in dev
  function queryEmbedding(): Float32Array {
    let seed = 0; const dim = 384;
    for (let i = 0; i < query.length; i++) seed = (seed * 31 + query.charCodeAt(i)) >>> 0;
    const v = new Float32Array(dim);
    for (let i = 0; i < dim; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; v[i] = ((seed & 0xffff)/0xffff)*2-1; }
    let norm = 0; for (let i = 0; i < dim; i++) norm += v[i]*v[i]; norm = Math.sqrt(norm) || 1; for (let i = 0; i < dim; i++) v[i] /= norm;
    return v;
  }

  const qEmb = queryEmbedding();

  function noteEmbedding(id: string): Float32Array | null {
    const r = db.getFirstSync<any>(`SELECT vec FROM embeddings WHERE noteId=?`, [id]);
    if (!r || !r.vec) return null;
    const blob: Uint8Array = (r.vec as Uint8Array);
    return blobToFloat32(blob);
  }

  const withScores = rows.map((r) => {
    const k = keywordScore(`${r.text}\n${r.tags}\n${r.category || ''}`);
    const e = noteEmbedding(r.id);
    const sim = e ? cosine(qEmb, e) : 0;
    const score = 0.6 * k + 0.4 * Math.max(0, sim);
    return { row: r, k, sim, score };
  });

  withScores.sort((a, b) => b.score - a.score);
  return withScores.slice(0, limit).map(({ row, k, sim, score }) => ({ ...row, _k: k, _sim: sim, _score: score }));
}