import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Random from 'expo-random';

export type RecordingState = {
  isRecording: boolean;
  start: () => Promise<boolean>;
  stop: () => Promise<{ uri: string } | null>;
};

const Ctx = createContext<RecordingState>({ isRecording: false, start: async () => false, stop: async () => null });

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef<any | null>(null);

  const ensureAttachmentsDir = useCallback(async () => {
    const root = FileSystem.documentDirectory + 'attachments/';
    try { await FileSystem.makeDirectoryAsync(root, { intermediates: true }); } catch {}
    return root;
  }, []);

  const start = useCallback(async () => {
    try {
      // Lazy load to avoid crashing if expo-av not installed yet
      const av = await import('expo-av');
      const { status } = await av.Audio.requestPermissionsAsync();
      if (!status || (status as any).granted === false) return false;
      await av.Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new av.Audio.Recording();
      await rec.prepareToRecordAsync(av.Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recRef.current = rec;
      setIsRecording(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      const rec = recRef.current;
      if (!rec) return null;
      await rec.stopAndUnloadAsync();
      const uri: string = rec.getURI();
      setIsRecording(false);
      recRef.current = null;
      // Move into attachments dir with random name
      const root = await ensureAttachmentsDir();
      const name = `voice-${Date.now()}-${Random.getRandomBytes(4).join('')}.m4a`;
      const out = root + name;
      await FileSystem.moveAsync({ from: uri, to: out });
      return { uri: out };
    } catch {
      setIsRecording(false);
      recRef.current = null;
      return null;
    }
  }, [ensureAttachmentsDir]);

  const value = useMemo(() => ({ isRecording, start, stop }), [isRecording, start, stop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecording() {
  return useContext(Ctx);
}