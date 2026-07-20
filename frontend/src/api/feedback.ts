import { del, get, post, put } from "./client";
import type { WaveformComment } from "../types/api";

export function listWaveformComments(
  versionId: number,
  share?: { token: string; password?: string },
): Promise<WaveformComment[]> {
  if (!share) return get(`/api/versions/${versionId}/comments`);
  const password = share.password
    ? `?password=${encodeURIComponent(share.password)}`
    : "";
  return get(
    `/api/share/${share.token}/versions/${versionId}/comments${password}`,
    { requiresAuth: false },
  );
}

export function createWaveformComment(
  versionId: number,
  data: {
    timestamp_seconds: number;
    text: string;
    author_name?: string;
    password?: string;
  },
  shareToken?: string,
): Promise<WaveformComment> {
  if (!shareToken) return post(`/api/versions/${versionId}/comments`, data);
  return post(`/api/share/${shareToken}/versions/${versionId}/comments`, data, {
    requiresAuth: false,
  });
}

export function updateWaveformComment(
  commentId: number,
  text: string,
): Promise<WaveformComment> {
  return put(`/api/comments/${commentId}`, { text });
}

export function deleteWaveformComment(commentId: number): Promise<void> {
  return del(`/api/comments/${commentId}`);
}
