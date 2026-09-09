import { createContext, useContext, useSyncExternalStore } from "react";

export function createPlaybackProgressStore() {
  let progress = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => progress,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setProgress: (next: number) => {
      if (!Number.isFinite(next) || next < 0 || next === progress) return;
      progress = next;
      listeners.forEach((listener) => listener());
    },
  };
}

export const PlaybackProgressContext = createContext<
  ReturnType<typeof createPlaybackProgressStore> | null
>(null);

// Only the timeline subscribes to the playback clock, not the library or queue.
export function usePlaybackProgress() {
  const store = useContext(PlaybackProgressContext);
  if (!store) throw new Error("usePlaybackProgress requires AudioPlayerProvider");
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
