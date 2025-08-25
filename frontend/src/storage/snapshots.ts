import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDbSync } from './utilDb';
import { Note } from './db';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { aes256gcm } from '@noble/ciphers/aes256gcm';

const MASTER_KEY_NAME = 'master_key_v1';

export async function ensureMasterKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(MASTER_KEY_NAME);
  if (existing) {
    return Uint8Array.from(atob(existing), (c) => c.charCodeAt(0));
  }
  const key = randomBytes(32);
  await SecureStore.setItemAsync(MASTER_KEY_NAME, btoa(String.fromCharCode(...key)));
  return key;
}

export async function getRecoveryKeyBase58(): Promise<string> {
  const key = await ensureMasterKey();
  // simple base58 encoding without external dep
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let x = BigInt('0x' + Buffer.from(key).toString('hex'));
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
  const payload = JSON.stringify({ notes, settings, audit, ts: Date.now() });

  const key = await ensureMasterKey();
  const nonce = randomBytes(12);
  const aead = aes256gcm(key);
  const ciphertext = aead.seal(nonce, new TextEncoder().encode(payload));
  const out = new Uint8Array(nonce.length + ciphertext.length);
  out.set(nonce, 0); out.set(ciphertext, nonce.length);

  const tmp = `${FileSystem.cacheDirectory}snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.onsnap`;
  await FileSystem.writeAsStringAsync(tmp, Buffer.from(out).toString('base64'));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(tmp, { mimeType: 'application/octet-stream' });
  }
  return tmp;
}

export async function importSnapshotInteractively(): Promise<void> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (res.canceled || !res.assets || res.assets.length === 0) return;
  const uri = res.assets[0].uri;
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
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
      db.runSync(`INSERT INTO notes(id,text,tags,category,pinned,createdAt,updatedAt,deletedAt) VALUES(?,?,?,?,?,?,?,?)`, [n.id, n.text, n.tags, n.category, n.pinned, n.createdAt, n.updatedAt, n.deletedAt ?? null]);
    }
    for (const s of json.settings) {
      db.runSync(`INSERT INTO settings(key,value) VALUES(?,?)`, [s.key, s.value]);
    }
    for (const a of json.audit) {
      db.runSync(`INSERT INTO audit(id,at,action,meta) VALUES(?,?,?,?)`, [a.id, a.at, a.action, a.meta]);
    }
  });
}