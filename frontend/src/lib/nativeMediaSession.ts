import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export type NativeMediaAction =
  | "play"
  | "pause"
  | "previousTrack"
  | "nextTrack"
  | "seekTo"
  | "stop";

export interface NativeMediaActionEvent {
  action: NativeMediaAction;
  seekTime?: number;
}

interface NativeMediaSessionPlugin {
  setMetadata(options: {
    title: string;
    artist: string;
    album: string;
    artworkUrl?: string;
  }): Promise<void>;
  setPlaybackState(options: {
    state: "none" | "paused" | "playing";
  }): Promise<void>;
  setPositionState(options: {
    duration: number;
    position: number;
    playbackRate: number;
  }): Promise<void>;
  addListener(
    eventName: "action",
    listener: (event: NativeMediaActionEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const NativeMediaSession = registerPlugin<NativeMediaSessionPlugin>(
  "NativeMediaSession",
);

export const hasNativeMediaSession =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
