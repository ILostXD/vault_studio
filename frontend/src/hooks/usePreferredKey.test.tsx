// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { KeyModePreference } from "@/types/api";
import { preferredKey, usePreferredKey } from "./usePreferredKey";

let preference: KeyModePreference = "detected";
vi.mock("@/contexts/PreferencesContext", () => ({ usePreferences: () => ({ preferences: { key_mode_preference: preference } }) }));
afterEach(cleanup);

it.each([
  ["C major", "A minor"], ["Db major", "Bb minor"], ["D major", "B minor"],
  ["Eb major", "C minor"], ["E major", "C# minor"], ["F major", "D minor"],
  ["F# major", "D# minor"], ["G major", "E minor"], ["Ab major", "F minor"],
  ["A major", "F# minor"], ["Bb major", "G minor"], ["B major", "G# minor"],
])("converts %s and its relative minor both ways", (major, minor) => {
  expect(preferredKey(major, "minor")).toBe(minor);
  expect(preferredKey(minor, "major")).toBe(major);
  expect(preferredKey(major, "major")).toBe(major);
  expect(preferredKey(minor, "minor")).toBe(minor);
});

it("updates an old saved key immediately when the preference changes without mutating it", () => {
  const track = Object.freeze({ key: "B Major" });
  preference = "detected";
  const view = renderHook(() => usePreferredKey(track.key));
  expect(view.result.current).toBe("B Major");
  preference = "minor";
  view.rerender();
  expect(view.result.current).toBe("G# minor");
  preference = "detected";
  view.rerender();
  expect(view.result.current).toBe("B Major");
  expect(track.key).toBe("B Major");
});

it("preserves unknown keys and accepts sharp/flat symbols", () => {
  for (const key of ["", "unknown", "C dorian", "__proto__ major"]) expect(preferredKey(key, "minor")).toBe(key);
  expect(preferredKey("F\u266f major", "minor")).toBe("D# minor");
  expect(preferredKey("G\u266d major", "minor")).toBe("Eb minor");
});
