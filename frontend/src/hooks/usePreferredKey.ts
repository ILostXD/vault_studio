import { usePreferences } from "@/contexts/PreferencesContext";
import type { KeyModePreference } from "@/types/api";

export function preferredKey(key: string, preference: KeyModePreference = "detected") {
  const parts = key.trim().split(/\s+/);
  const mode = parts[1]?.toLowerCase();
  if (parts.length !== 2 || preference === "detected" || mode === preference || !["major", "minor"].includes(mode)) return key;
  const root = parts[0].replaceAll("\u266f", "#").replaceAll("\u266d", "b");
  const pitches: Record<string, number> = {
    C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
    F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
  };
  if (!Object.hasOwn(pitches, root)) return key;
  const pitch = (pitches[root] + (preference === "minor" ? 9 : 3)) % 12;
  const names = root.includes("b") || (preference === "major" && !root.includes("#"))
    ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
    : ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[pitch]} ${preference}`;
}

export function usePreferredKey(key?: string | null) {
  const { preferences } = usePreferences();
  return key ? preferredKey(key, preferences?.key_mode_preference) : undefined;
}
