import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

import { getAuthHeaders } from "@/api/client";
import { resolveApiUrl } from "@/api/server";

export interface DownloadResult {
  cancelled: boolean;
}

interface NativeFileSavePlugin {
  addListener(event: "downloadProgress", listener: (event: { id: string; loaded: number; total?: number }) => void): Promise<PluginListenerHandle>;
  saveFile(options: {
    url: string;
    fileName: string;
    mimeType: string;
    headers: Record<string, string>;
    progressId?: string;
  }): Promise<DownloadResult>;
}

const NativeFileSave = registerPlugin<NativeFileSavePlugin>("NativeFileSave");

function filenameFromResponse(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="([^"]+)"|filename=([^;]+)/i);
  return (match?.[1] || match?.[2] || fallback).trim();
}

function safeFilename(filename: string) {
  return filename.replace(/[\\/:*?"<>|]/g, "-");
}

export type DownloadProgress = (loaded: number, total?: number) => void;

export async function readDownloadResponse(response: Response, onProgress?: DownloadProgress): Promise<Blob> {
  const length = Number(response.headers.get("content-length"));
  const total = Number.isFinite(length) && length > 0 && !response.headers.get("content-encoding") ? length : undefined;
  onProgress?.(0, total);
  if (!response.body) {
    const blob = await response.blob();
    onProgress?.(blob.size, total);
    return blob;
  }
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  let lastUpdate = performance.now();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      if (performance.now() - lastUpdate >= 150) {
        onProgress?.(loaded, total);
        lastUpdate = performance.now();
      }
    }
    if (total !== undefined && loaded !== total) throw new Error("Download was interrupted. Please try again.");
    onProgress?.(loaded, total);
    return new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
  } finally {
    reader.releaseLock();
  }
}

export async function saveDownload(options: {
  url: string;
  fileName: string;
  mimeType?: string;
  headers?: Record<string, string>;
  onProgress?: DownloadProgress;
}): Promise<DownloadResult> {
  const url = resolveApiUrl(options.url);
  const headers = options.headers ?? getAuthHeaders();
  const fallbackName = safeFilename(options.fileName);

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    let fileName = fallbackName;
    let mimeType = options.mimeType ?? "application/octet-stream";

    try {
      const response = options.onProgress ? null : await fetch(url, {
        method: "HEAD",
        credentials: "include",
        headers,
      });
      if (response?.ok) {
        fileName = safeFilename(filenameFromResponse(response, fileName));
        mimeType = (response.headers.get("content-type") || mimeType).split(";")[0];
      }
    } catch {
      // The native download still works when an endpoint does not support HEAD.
    }

    const progressId = `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const listener = options.onProgress ? await NativeFileSave.addListener("downloadProgress", (event) => {
      if (event.id === progressId) options.onProgress?.(event.loaded, event.total);
    }) : undefined;
    try {
      return await NativeFileSave.saveFile({ url, fileName, mimeType, headers, progressId });
    } finally {
      await listener?.remove();
    }
  }

  const response = await fetch(url, {
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `Download failed: ${response.statusText}`);
  }

  const blob = await readDownloadResponse(response, options.onProgress);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = safeFilename(filenameFromResponse(response, fallbackName));
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser accept the download before releasing its backing data.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

  return { cancelled: false };
}
