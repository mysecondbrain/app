import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Random from 'expo-random';
import { getDbSync } from './utilDb';
import { aes256gcm } from '@noble/ciphers/aes256gcm';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const MASTER_KEY_NAME = 'master_key_v1';

function getRandomBytes(n: number): Uint8Array {
  const arr = Random.getRandomBytes(n);
  return Uint8Array.from(arr);
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = str.charCodeAt(i + 1);
    const c3 = str.charCodeAt(i + 2);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    const e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | (c3 >> 6));
    const e4 = isNaN(c3) ? 64 : (c3 & 63);
    output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return output;
}

function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  while (i < b64.length) {
    const e1 = chars.indexOf(b64.charAt(i++));
    const e2 = chars.indexOf(b64.charAt(i++));
    const e3 = chars.indexOf(b64.charAt(i++));
    const e4 = chars.indexOf(b64.charAt(i++));
    const c1 = (e1 << 2) | (e2 >> 4);
    const c2 = ((e2 & 15) << 4) | (e3 >> 2);
    const c3 = ((e3 & 3) << 6) | e4;
    output += String.fromCharCode(c1);
    if (e3 !== 64) output += String.fromCharCode(c2);
    if (e4 !== 64) output += String.fromCharCode(c3);
  }
  const out = new Uint8Array(output.length);
  for (let j = 0; j < output.length; j++) out[j] = output.charCodeAt(j);
  return out;
}

export async function ensureMasterKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(MASTER_KEY_NAME);
  if (existing) {
    return hexToBytes(existing);
  }
  const key = getRandomBytes(32);
  await SecureStore.setItemAsync(MASTER_KEY_NAME, bytesToHex(key));
  return key;
}

export async function getRecoveryKeyBase58(): Promise<string> {
  const key = await ensureMasterKey();
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let x = BigInt('0x' + bytesToHex(key));
  const base = BigInt(58);
  let out = '';
  while (x > 0n) {
    const mod = x % base;
    out = alphabet[Number(mod)] + out;
    x = x / base;
  }
  return out || '1';
}

export async function exportSnapshot(): Promise<string> {
  const db = getDbSync();
  const notes = db.getAllSync<any>(`SELECT * FROM notes`);
  const settings = db.getAllSync<any>(`SELECT * FROM settings`);
  const audit = db.getAllSync<any>(`SELECT * FROM audit`);

  // Attachments: we bundle files from documentDirectory/attachments
  const attachmentsRoot = FileSystem.documentDirectory + 'attachments/';
  const attachmentsList = await safeReadDir(attachmentsRoot);
  const files: any[] = [];
  for (const f of attachmentsList) {
    if (f.isDirectory) continue;
    const name = f.uri.split('/').pop() || 'file';
    const content = await FileSystem.readAsStringAsync(f.uri, { encoding: FileSystem.EncodingType.Base64 });
    files.push({ name, uri: f.uri, size: f.size || 0, b64: content });
  }

  const payload = JSON.stringify({ notes, settings, audit, files, ts: Date.now() });

  const key = await ensureMasterKey();
  const nonce = getRandomBytes(12);
  const aead = aes256gcm(key);
  const ciphertext = aead.seal(nonce, new TextEncoder().encode(payload));
  const out = new Uint8Array(nonce.length + ciphertext.length);
  out.set(nonce, 0); out.set(ciphertext, nonce.length);

  const tmp = `${FileSystem.cacheDirectory}snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.onsnap`;
  const b64 = bytesToBase64(out);
  await FileSystem.writeAsStringAsync(tmp, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(tmp, { mimeType: 'application/octet-stream' });
  }
  return tmp;
}

export async function importSnapshotInteractively(): Promise<void> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (res.canceled || !res.assets || res.assets.length === 0) return;
  const uri = res.assets[0].uri;
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = base64ToBytes(b64);
  const nonce = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const key = await ensureMasterKey();
  const aead = aes256gcm(key);
  const plain = aead.open(nonce, ct);
  if (!plain) throw new Error('Decryption failed');
  const json = JSON.parse(new TextDecoder().decode(plain));

  const db = getDbSync();
  db.withTransactionSync(() => {
    db.execSync('DELETE FROM notes;');
    db.execSync('DELETE FROM settings;');
    db.execSync('DELETE FROM audit;');
    for (const n of json.notes) {
      db.runSync(`INSERT INTO notes(id,text,tags,category,pinned,createdAt,updatedAt,deletedAt,attachments) VALUES(?,?,?,?,?,?,?,?,?)`, [n.id, n.text, n.tags, n.category, n.pinned, n.createdAt, n.updatedAt, n.deletedAt ?? null, n.attachments ?? '[]']);
    }
    for (const s of json.settings) {
      db.runSync(`INSERT INTO settings(key,value) VALUES(?,?)`, [s.key, s.value]);
    }
    for (const a of json.audit) {
      db.runSync(`INSERT INTO audit(id,at,action,meta) VALUES(?,?,?,?)`, [a.id, a.at, a.action, a.meta]);
    }
  });

  // Restore files to attachments directory
  const attachmentsRoot = FileSystem.documentDirectory + 'attachments/';
  try { await FileSystem.makeDirectoryAsync(attachmentsRoot, { intermediates: true }); } catch {}
  if (Array.isArray(json.files)) {
    for (const f of json.files) {
      const outPath = attachmentsRoot + (f.name || 'file');
      await FileSystem.writeAsStringAsync(outPath, f.b64, { encoding: FileSystem.EncodingType.Base64 });
    }
  }
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