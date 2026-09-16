import { get, put } from "./client";
import { saveDownload, type DownloadProgress } from "@/lib/download";

export interface ProjectAudioMetadata {
  album: string;
  artist: string;
  album_artist: string;
  genre: string;
  year: string;
}

export interface ResolvedAudioMetadata extends ProjectAudioMetadata {
  track_id: number;
  public_id: string;
  artist_override: string;
  album_override: string;
  version_id: number;
  version_name: string;
  title: string;
  track_number: number;
  artwork: boolean;
  format: string;
  source_format: string;
  conversion?: string;
  can_download: boolean;
  reason?: string;
}

export interface AudioMetadataState {
  metadata: ProjectAudioMetadata;
  artwork: boolean;
  tracks: ResolvedAudioMetadata[];
}

export const getAudioMetadata = (projectId: number) =>
  get<AudioMetadataState>(`/api/projects/${projectId}/audio-metadata`);

export const saveAudioMetadata = (projectId: number, metadata: ProjectAudioMetadata) =>
  put<AudioMetadataState>(`/api/projects/${projectId}/audio-metadata`, metadata);

export const downloadTaggedTrack = (
  projectId: number,
  track: ResolvedAudioMetadata,
  onProgress: DownloadProgress,
) => saveDownload({
  url: `/api/projects/${projectId}/tracks/${track.track_id}/tagged-download?version_id=${track.version_id}`,
  fileName: `${String(track.track_number).padStart(2, "0")} - ${track.title}.${track.format}`,
  onProgress,
});
