// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readDownloadResponse, saveDownload } from "./download";

const native = vi.hoisted(() => ({
  enabled: false, saveFile: vi.fn(), addListener: vi.fn(), remove: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.enabled, getPlatform: () => "android" },
  registerPlugin: () => native,
}));
vi.mock("@/api/client", () => ({ getAuthHeaders: () => ({ Authorization: "Bearer test" }) }));
vi.mock("@/api/server", () => ({ resolveApiUrl: (url: string) => url }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); native.enabled = false; });

it("reports real byte totals, including start and completion, without updating for every chunk", async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < 100; i++) controller.enqueue(new Uint8Array(100));
      controller.close();
    },
  }), { headers: { "content-length": "10000", "content-type": "application/zip" } });
  const progress = vi.fn();
  const blob = await readDownloadResponse(response, progress);
  expect(blob.size).toBe(10000);
  expect(progress).toHaveBeenNthCalledWith(1, 0, 10000);
  expect(progress).toHaveBeenLastCalledWith(10000, 10000);
  expect(progress.mock.calls.length).toBeLessThan(100);
  expect(response.body?.locked).toBe(false);
});

it("does not invent a percentage when an older server omits the length", async () => {
  const progress = vi.fn();
  await readDownloadResponse(new Response("zip"), progress);
  expect(progress).toHaveBeenLastCalledWith(3, undefined);
});

it("rejects a truncated download and releases the reader", async () => {
  const response = new Response("short", { headers: { "content-length": "99" } });
  await expect(readDownloadResponse(response)).rejects.toThrow("interrupted");
  expect(response.body?.locked).toBe(false);
});

it("uses Android's save dialog, filters progress by download ID, and removes the listener", async () => {
  native.enabled = true;
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  let listener: (event: { id: string; loaded: number; total: number }) => void;
  native.addListener.mockImplementation(async (_, callback) => {
    listener = callback;
    return { remove: native.remove };
  });
  native.saveFile.mockImplementation(async ({ progressId }) => {
    listener({ id: "another-download", loaded: 1, total: 5 });
    listener({ id: progressId, loaded: 5, total: 10 });
    return { cancelled: true };
  });
  const progress = vi.fn();
  expect(await saveDownload({ url: "/export", fileName: "project.zip", onProgress: progress })).toEqual({ cancelled: true });
  expect(fetch).not.toHaveBeenCalled();
  expect(progress).toHaveBeenCalledExactlyOnceWith(5, 10);
  expect(native.remove).toHaveBeenCalledOnce();
});
