import * as FileSystem from 'expo-file-system';
import { getSetting, setSetting } from './db';

const THRESH_KEY = 'storage_threshold_bytes';
const WARNINGS_KEY = 'storage_warnings_enabled';

export type StorageUsage = {
  total: number;
  db: number;
  attachments: number;
  cache: number;
};

export async function getStorageUsage(): Promise<StorageUsage> {
  const dbPath = FileSystem.documentDirectory + 'SQLite/app.db';
  const attachmentsRoot = FileSystem.documentDirectory + 'attachments/';

  const [dbInfo, cacheInfo, attachList] = await Promise.all([
    FileSystem.getInfoAsync(dbPath),
    FileSystem.getInfoAsync(FileSystem.cacheDirectory || ''),
    safeReadDir(attachmentsRoot),
  ]);

  const db = dbInfo.exists ? dbInfo.size || 0 : 0;
  const cache = cacheInfo.exists ? (await dirSize(FileSystem.cacheDirectory!)) : 0;
  const attachments = await filesTotalSize(attachmentsRoot, attachList);
  return { total: db + cache + attachments, db, cache, attachments };
}

async function safeReadDir(path: string): Promise<FileSystem.FileInfo[]> {
  try {
    const entries = await FileSystem.readDirectoryAsync(path);
    const infos = await Promise.all(entries.map((name) => FileSystem.getInfoAsync(path + name)));
    return infos as FileSystem.FileInfo[];
  } catch {
    return [] as any;
  }
}

async function filesTotalSize(root: string, entries: FileSystem.FileInfo[]): Promise<number> {
  let sum = 0;
  for (const e of entries) {
    if (e.isDirectory) {
      const sub = await safeReadDir(e.uri.endsWith('/') ? e.uri : e.uri + '/');
      sum += await filesTotalSize(e.uri.endsWith('/') ? e.uri : e.uri + '/', sub);
    } else {
      sum += e.size || 0;
    }
  }
  return sum;
}

async function dirSize(path: string): Promise<number> {
  try {
    const entries = await FileSystem.readDirectoryAsync(path);
    let s = 0;
    for (const name of entries) {
      const info = await FileSystem.getInfoAsync(path + name);
      if (info.isDirectory) s += await dirSize(info.uri.endsWith('/') ? info.uri : info.uri + '/');
      else s += info.size || 0;
    }
    return s;
  } catch {
    return 0;
  }
}

export function getThresholdBytes(): number {
  const v = getSetting(THRESH_KEY);
  return v ? parseInt(v, 10) : 5 * 1024 * 1024 * 1024; // default 5GB
}

export async function setThresholdBytes(bytes: number) {
  await setSetting(THRESH_KEY, String(bytes));
}

export function getWarningsEnabled(): boolean {
  const v = getSetting(WARNINGS_KEY);
  return v ? v === '1' : true;
}

export async function setWarningsEnabled(enabled: boolean) {
  await setSetting(WARNINGS_KEY, enabled ? '1' : '0');
}