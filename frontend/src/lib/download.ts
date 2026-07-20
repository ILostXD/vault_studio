import { Capacitor, registerPlugin } from "@capacitor/core";

import { getAuthHeaders } from "@/api/client";
import { resolveApiUrl } from "@/api/server";

export interface DownloadResult {
  cancelled: boolean;
}

interface NativeFileSavePlugin {
  saveFile(options: {
    url: string;
    fileName: string;
    mimeType: string;
    headers: Record<string, string>;
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

export async function saveDownload(options: {
  url: string;
  fileName: string;
  mimeType?: string;
  headers?: Record<string, string>;
}): Promise<DownloadResult> {
  const url = resolveApiUrl(options.url);
  const headers = options.headers ?? getAuthHeaders();
  const fallbackName = safeFilename(options.fileName);

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    let fileName = fallbackName;
    let mimeType = options.mimeType ?? "application/octet-stream";

    try {
      const response = await fetch(url, {
        method: "HEAD",
        credentials: "include",
        headers,
      });
      if (response.ok) {
        fileName = safeFilename(filenameFromResponse(response, fileName));
        mimeType = (response.headers.get("content-type") || mimeType).split(";")[0];
      }
    } catch {
      // The native download still works when an endpoint does not support HEAD.
    }

    return NativeFileSave.saveFile({ url, fileName, mimeType, headers });
  }

  const response = await fetch(url, {
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = safeFilename(filenameFromResponse(response, fallbackName));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);

  return { cancelled: false };
}
