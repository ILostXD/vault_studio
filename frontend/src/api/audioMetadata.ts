import { type DownloadProgress, saveDownload } from "@/lib/download";
import { get, post, put } from "./client";

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
	can_download_raw?: boolean;
	reason?: string;
}

export interface AudioMetadataState {
	metadata: ProjectAudioMetadata;
	artwork: boolean;
	tracks: ResolvedAudioMetadata[];
	revision: string;
	library: LibraryStatus;
	available_formats: string[];
	target_format: string;
	has_lossless: boolean;
}

export interface LibraryStatus {
	configured: boolean;
	folder?: string;
	published_at?: string;
	current: boolean;
	problem?: string;
}

export const publishAlbum = (
	projectId: number,
	revision: string,
	format?: string,
) =>
	post<LibraryStatus>(
		`/api/projects/${projectId}/music-library`,
		{ revision, format },
		{ timeoutMs: 0 },
	);

export const downloadTaggedAlbum = (
	projectId: number,
	state: AudioMetadataState,
	onProgress: DownloadProgress,
	format?: string,
) => {
	const query = new URLSearchParams({ revision: state.revision });
	if (format) query.set("format", format);
	return saveDownload({
		url: `/api/projects/${projectId}/tagged-download?${query.toString()}`,
		fileName: `${state.metadata.album.replace(/[\\/:*?"<>|]/g, "_")}.zip`,
		mimeType: "application/zip",
		onProgress,
	});
};

export const getAudioMetadata = (projectId: number, format?: string) => {
	const query = format ? `?format=${encodeURIComponent(format)}` : "";
	return get<AudioMetadataState>(
		`/api/projects/${projectId}/audio-metadata${query}`,
	);
};

export const saveAudioMetadata = (
	projectId: number,
	metadata: ProjectAudioMetadata,
	format?: string,
) => {
	const query = format ? `?format=${encodeURIComponent(format)}` : "";
	return put<AudioMetadataState>(
		`/api/projects/${projectId}/audio-metadata${query}`,
		metadata,
	);
};

export const downloadTaggedTrack = (
	projectId: number,
	track: ResolvedAudioMetadata,
	onProgress: DownloadProgress,
	format?: string,
) => {
	const query = new URLSearchParams({ version_id: String(track.version_id) });
	if (format) query.set("format", format);
	return saveDownload({
		url: `/api/projects/${projectId}/tracks/${track.track_id}/tagged-download?${query.toString()}`,
		fileName: `${String(track.track_number).padStart(2, "0")} - ${track.title}.${track.format}`,
		onProgress,
	});
};
