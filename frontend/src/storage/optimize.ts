import * as FileSystem from 'expo-file-system';

export type OptimizeOptions = {
  replaceOriginals: boolean;
};

export type OptimizeResult = {
  imagesOptimized: number;
  audioOptimized: number;
  videoOptimized: number;
  bytesSaved: number;
};

// Best-effort Optimizer: In Managed Expo ohne Dev Client sind echte Transcodes für Audio/Video limitiert.
// Wir implementieren Bilder-Kompression via optionalem image-manipulator (falls vorhanden),
// und für Audio/Video platzieren wir vorerst Stubs. Bei EAS-DevBuild können wir ffmpeg-kit nutzen.

export async function optimizeAllAttachments(root = FileSystem.documentDirectory + 'attachments/', opts: OptimizeOptions): Promise<OptimizeResult> {
  const entries = await safeList(root);
  let images = 0, audio = 0, video = 0, saved = 0;

  for (const info of entries) {
    if (info.isDirectory) continue;
    const ext = (info.uri.split('.').pop() || '').toLowerCase();
    const mime = guessMime(ext);
    if (mime.startsWith('image/')) {
      const res = await optimizeImage(info.uri, opts);
      images += res.optimized ? 1 : 0;
      saved += res.bytesSaved;
    } else if (mime.startsWith('audio/')) {
      const res = await optimizeAudio(info.uri, opts);
      audio += res.optimized ? 1 : 0;
      saved += res.bytesSaved;
    } else if (mime.startsWith('video/')) {
      const res = await optimizeVideo(info.uri, opts);
      video += res.optimized ? 1 : 0;
      saved += res.bytesSaved;
    }
  }

  return { imagesOptimized: images, audioOptimized: audio, videoOptimized: video, bytesSaved: saved };
}

function guessMime(ext: string): string {
  const map: Record<string,string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
    mp3: 'audio/mpeg', m4a: 'audio/aac', wav: 'audio/wav', aac: 'audio/aac',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', mkv: 'video/x-matroska',
    pdf: 'application/pdf'
  };
  return map[ext] || 'application/octet-stream';
}

async function safeList(dir: string) {
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    const infos = await Promise.all(names.map((n) => FileSystem.getInfoAsync(dir + n)));
    return infos as FileSystem.FileInfo[];
  } catch { return [] as any; }
}

async function optimizeImage(uri: string, opts: OptimizeOptions): Promise<{optimized: boolean; bytesSaved: number;}> {
  try {
    // Dynamisch importieren, falls verfügbar
    const mod = await tryImportImageManipulator();
    if (!mod) return { optimized: false, bytesSaved: 0 };
    const info = await FileSystem.getInfoAsync(uri);
    const quality = 0.8; // heuristisch
    const format = uri.toLowerCase().endsWith('.png') ? mod.SaveFormat.JPEG : mod.SaveFormat.WEBP;
    const result = await mod.manipulateAsync(uri, [], { compress: quality, format });
    if (!result || !result.uri) return { optimized: false, bytesSaved: 0 };
    const outInfo = await FileSystem.getInfoAsync(result.uri);
    const saved = Math.max(0, (info.size || 0) - (outInfo.size || 0));
    if (opts.replaceOriginals && outInfo.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.moveAsync({ from: result.uri, to: uri });
    }
    return { optimized: true, bytesSaved: saved };
  } catch {
    return { optimized: false, bytesSaved: 0 };
  }
}

async function tryImportImageManipulator(): Promise<any | null> {
  try {
    // @ts-ignore dynamic
    const mod = await import('expo-image-manipulator');
    return mod;
  } catch {
    return null;
  }
}

async function optimizeAudio(uri: string, opts: OptimizeOptions): Promise<{optimized: boolean; bytesSaved: number;}> {
  // Stub: ohne ffmpeg nicht möglich -> später in EAS-DevBuild
  return { optimized: false, bytesSaved: 0 };
}

async function optimizeVideo(uri: string, opts: OptimizeOptions): Promise<{optimized: boolean; bytesSaved: number;}> {
  // Stub: ohne ffmpeg nicht möglich -> später in EAS-DevBuild
  return { optimized: false, bytesSaved: 0 };
}