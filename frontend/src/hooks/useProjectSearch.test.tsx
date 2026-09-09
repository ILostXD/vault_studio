// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useProjectSearch } from "./useProjectSearch";
import { isEditableTarget } from "@/lib/keyboard";

const options = { tracks: [], onTrackClick: vi.fn(), isPlaying: false, currentTrackId: undefined, pause: vi.fn() };
afterEach(() => { cleanup(); document.body.replaceChildren(); });

it("keeps the album S shortcut available outside editors and fullscreen", () => {
  const { result } = renderHook(() => useProjectSearch(options));
  const event = new KeyboardEvent("keydown", { key: "s", code: "KeyS", bubbles: true, cancelable: true });
  act(() => document.body.dispatchEvent(event));
  expect(result.current.isSearchOpen).toBe(true);
  expect(event.defaultPrevented).toBe(true);
});

it("does not steal letters, arrows or search combinations from rich text", () => {
  const { result } = renderHook(() => useProjectSearch(options));
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  const span = document.createElement("span");
  editor.append(span);
  document.body.append(editor);
  expect(isEditableTarget(span)).toBe(true);
  for (const args of [{ key: "s", code: "KeyS" }, { key: "ArrowDown" }, { code: "KeyF", ctrlKey: true }, { code: "KeyF", altKey: true }]) {
    const event = new KeyboardEvent("keydown", { ...args, bubbles: true, cancelable: true });
    act(() => span.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
  }
  expect(result.current.isSearchOpen).toBe(false);
  expect(result.current.isGlobalSearchOpen).toBe(false);
});

it("ignores album shortcuts while fullscreen is open, even without editor focus", () => {
  const { result } = renderHook(() => useProjectSearch(options));
  const dialog = document.createElement("section");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  document.body.append(dialog);
  const event = new KeyboardEvent("keydown", { code: "KeyS", bubbles: true, cancelable: true });
  act(() => document.body.dispatchEvent(event));
  expect(result.current.isSearchOpen).toBe(false);
  expect(event.defaultPrevented).toBe(false);
});
