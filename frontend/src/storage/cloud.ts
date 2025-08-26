export type CloudProvider = 'icloud' | 'gdrive' | 'webdav';

export async function connect(provider: CloudProvider): Promise<boolean> {
  // Stubs: UI-only; echte Implementierung folgt mit Keys in späterer Phase
  return true;
}

export async function uploadEncryptedSnapshot(provider: CloudProvider, snapshotPath: string): Promise<boolean> {
  // Stub: no-op
  return true;
}

export async function downloadAndImportSnapshot(provider: CloudProvider): Promise<boolean> {
  // Stub: no-op
  return true;
}