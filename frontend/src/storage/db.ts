import * as SQLite from 'expo-sqlite';

export type Attachment = {
  uri: string; // local file uri
  name?: string;
  mime?: string;
  size?: number;
  kind?: 'image' | 'audio' | 'video' | 'file';
};

export type Note = {
  id: string;
  text: string;
  tags: string[];
  category?: string | null;
  pinned: number; // 0/1
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  deletedAt?: number | null; // epoch ms or null
  attachments?: Attachment[];
};

export type AuditEvent = {
  id: string;
  at: number;
  action: string;
  meta?: any;
};

const DB_NAME = 'app.db';
const SCHEMA_VERSION_KEY = 'schema_version';
const CURRENT_SCHEMA_VERSION = 2; // v2 adds notes.attachments column

let db: SQLite.SQLiteDatabase | null = null;

function getDbSync(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

export async function initDb() {
  const database = getDbSync();
  database.execSync('PRAGMA journal_mode=WAL;');
  database.execSync('PRAGMA foreign_keys=ON;');
  database.withTransactionSync(() => {
    database.execSync(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );`);

    database.execSync(`CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      category TEXT,
      pinned INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER,
      attachments TEXT DEFAULT '[]'
    );`);

    database.execSync(`CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      at INTEGER NOT NULL,
      action TEXT NOT NULL,
      meta TEXT
    );`);

    // Indexes
    database.execSync(`CREATE INDEX IF NOT EXISTS idx_notes_updatedAt ON notes(updatedAt DESC);`);
    database.execSync(`CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);`);
    database.execSync(`CREATE INDEX IF NOT EXISTS idx_notes_deletedAt ON notes(deletedAt);`);

    // Migrations
    const row = database.getFirstSync<{ value: string }>(`SELECT value FROM settings WHERE key=?`, [SCHEMA_VERSION_KEY]);
    const version = row ? parseInt(row.value, 10) : 0;
    if (!row) {
      database.runSync(`INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)`, [SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION)]);
    } else if (version < CURRENT_SCHEMA_VERSION) {
      // v1 -> v2: add attachments column if missing
      if (version < 2) {
        try {
          database.execSync(`ALTER TABLE notes ADD COLUMN attachments TEXT DEFAULT '[]';`);
        } catch (e) {
          // ignore if already exists
        }
      }
      database.runSync(`UPDATE settings SET value=? WHERE key=?`, [String(CURRENT_SCHEMA_VERSION), SCHEMA_VERSION_KEY]);
    }
  });
}

function toJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export async function createNote(input: { id: string; text: string; tags?: string[]; category?: string | null; pinned?: boolean; attachments?: Attachment[]; timestamp?: number; }) {
  const database = getDbSync();
  const now = input.timestamp ?? Date.now();
  const pinned = input.pinned ? 1 : 0;
  database.runSync(
    `INSERT INTO notes (id, text, tags, category, pinned, createdAt, updatedAt, deletedAt, attachments)
     VALUES(?, ?, ?, ?, ?, ?, ?, NULL, ?)` ,
    [input.id, input.text, JSON.stringify(input.tags ?? []), input.category ?? null, pinned, now, now, JSON.stringify(input.attachments ?? [])]
  );
  await logAudit({ id: cryptoRandomId(), at: now, action: 'note.create', meta: { id: input.id, pinned, category: input.category } });
}

export async function updateNote(id: string, patch: Partial<Omit<Note, 'id'>>) {
  const database = getDbSync();
  const existing = database.getFirstSync<any>(`SELECT * FROM notes WHERE id=?`, [id]);
  if (!existing) return;
  const now = Date.now();
  const text = patch.text ?? existing.text;
  const tags = JSON.stringify(patch.tags ?? toJson<string[]>(existing.tags, []));
  const category = patch.category ?? existing.category;
  const pinned = typeof patch.pinned === 'number' ? patch.pinned : (patch.pinned ? 1 : existing.pinned);
  const deletedAt = patch.deletedAt === undefined ? existing.deletedAt : patch.deletedAt;
  const attachments = JSON.stringify(patch.attachments ?? toJson<Attachment[]>(existing.attachments, []));
  getDbSync().runSync(
    `UPDATE notes SET text=?, tags=?, category=?, pinned=?, updatedAt=?, deletedAt=?, attachments=? WHERE id=?`,
    [text, tags, category, pinned, now, deletedAt ?? null, attachments, id]
  );
  await logAudit({ id: cryptoRandomId(), at: now, action: 'note.update', meta: { id } });
}

export async function softDeleteNote(id: string) {
  const now = Date.now();
  getDbSync().runSync(`UPDATE notes SET deletedAt=? WHERE id=?`, [now, id]);
  await logAudit({ id: cryptoRandomId(), at: now, action: 'note.delete', meta: { id } });
}

export function getNote(id: string): Note | null {
  const row = getDbSync().getFirstSync<any>(`SELECT * FROM notes WHERE id=?`, [id]);
  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    tags: toJson<string[]>(row.tags, []),
    category: row.category,
    pinned: row.pinned ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    attachments: toJson<Attachment[]>(row.attachments, []),
  };
}

export function listNotes(opts?: { search?: string; pinnedOnly?: boolean; limit?: number; }): Note[] {
  const search = opts?.search?.trim();
  const pinnedOnly = !!opts?.pinnedOnly;
  const limit = opts?.limit ?? 200;

  let sql = `SELECT * FROM notes WHERE 1=1`;
  const params: any[] = [];

  sql += ` AND (deletedAt IS NULL)`;
  if (pinnedOnly) {
    sql += ` AND pinned=1`;
  }
  if (search) {
    sql += ` AND (text LIKE ? OR tags LIKE ? OR category LIKE ?)`;
    const like = `%${search.replace(/%/g, '')}%`;
    params.push(like, like, like);
  }
  sql += ` ORDER BY pinned DESC, updatedAt DESC LIMIT ?`;
  params.push(limit);

  const rows = getDbSync().getAllSync<any>(sql, params);
  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    tags: toJson<string[]>(row.tags, []),
    category: row.category,
    pinned: row.pinned ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    attachments: toJson<Attachment[]>(row.attachments, []),
  }));
}

export async function setSetting(key: string, value: string) {
  getDbSync().runSync(`INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)`, [key, value]);
}

export function getSetting(key: string): string | null {
  const row = getDbSync().getFirstSync<any>(`SELECT value FROM settings WHERE key=?`, [key]);
  return row ? row.value : null;
}

export async function logAudit(ev: AuditEvent) {
  getDbSync().runSync(`INSERT OR REPLACE INTO audit(id, at, action, meta) VALUES(?, ?, ?, ?)`, [ev.id, ev.at, ev.action, JSON.stringify(ev.meta ?? null)]);
}

export function listAudit(limit = 200) {
  const rows = getDbSync().getAllSync<any>(`SELECT * FROM audit ORDER BY at DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({ id: r.id, at: r.at, action: r.action, meta: toJson<any>(r.meta, null) }));
}

export function cryptoRandomId(): string {
  // Simple 26-char base36 id
  return Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 13);
}

export { getDbSync };