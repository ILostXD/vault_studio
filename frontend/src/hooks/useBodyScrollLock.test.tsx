// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useBodyScrollLock } from "./useBodyScrollLock";

afterEach(() => { cleanup(); document.body.style.overflow = ""; });

it("keeps the page locked when a nested dialog closes and restores its original style last", () => {
  document.body.style.overflow = "auto";
  const fullscreen = renderHook(() => useBodyScrollLock(true));
  const dialog = renderHook(() => useBodyScrollLock(true));
  const closedDialog = renderHook(() => useBodyScrollLock(false));
  closedDialog.unmount();
  dialog.unmount();
  expect(document.body.style.overflow).toBe("hidden");
  fullscreen.unmount();
  expect(document.body.style.overflow).toBe("auto");
});

it("handles closing the parent first and repeated updates to a still-open dialog", () => {
  const parent = renderHook(() => useBodyScrollLock(true));
  const dialog = renderHook(({ open }) => useBodyScrollLock(open), { initialProps: { open: true } });
  parent.unmount();
  dialog.rerender({ open: true });
  expect(document.body.style.overflow).toBe("hidden");
  dialog.rerender({ open: false });
  expect(document.body.style.overflow).toBe("");
});
