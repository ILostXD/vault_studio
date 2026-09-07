import {
	ApiError,
	del,
	get,
	getAuthHeaders,
	getCSRFToken,
	post,
	put,
} from "./client";
import { resolveApiUrl } from "./server";

export interface Credit {
	name: string;
	role: string;
}

export interface ArtistProfile {
	display_name: string;
	legal_name: string;
	default_credits: Credit[];
}

export interface CommonMetadata {
	title?: string | null;
	artist?: string | null;
	language?: string | null;
	genres?: string[] | null;
	copyright?: string | null;
	phonographic_copyright?: string | null;
	label?: string | null;
	credits?: Credit[] | null;
}

export interface ReleaseMetadata extends CommonMetadata {
	release_type?: string | null;
	release_date?: string | null;
	original_release_date?: string | null;
	upc?: string | null;
}

export interface TrackOverride {
	title?: string | null;
	artist?: string | null;
	language?: string | null;
	credits?: Credit[] | null;
	explicit?: boolean | null;
	lyrics?: string | null;
	isrc?: string | null;
}

export interface ReleasePreparation {
	release: ReleaseMetadata;
	tracks: Record<string, TrackOverride>;
}

export interface ReleaseAsset {
	filename: string;
	format: string;
	size: number;
	sha256?: string;
	source_sha256?: string;
	derived: boolean;
	width?: number;
	height?: number;
}

export interface ResolvedTrack {
	track_id: number;
	version_id: number;
	number: number;
	title: string;
	artist: string;
	language: string;
	explicit?: boolean | null;
	lyrics: string;
	isrc: string;
	credits: Credit[];
	duration_seconds: number;
	master?: ReleaseAsset | null;
}

export interface ResolvedRelease
	extends Required<Omit<ReleaseMetadata, "credits">> {
	project_id: number;
	credits: Credit[];
	tracks: ResolvedTrack[];
	artwork?: ReleaseAsset | null;
	motion_artwork: { kind: string; asset: ReleaseAsset }[];
}

export interface ValidationIssue {
	severity: "error" | "warning";
	scope: "vault" | "provider";
	code: string;
	field: string;
	message: string;
	remediation: "fix_in_vault" | "complete_in_provider";
	track_id?: number;
}

export interface ReleaseValidation {
	issues: ValidationIssue[];
	can_export: boolean;
	can_send: boolean;
}

export interface ReleasePreparationResponse {
	preparation: ReleasePreparation;
	release: ResolvedRelease;
	validation: ReleaseValidation;
}

export interface DistributionHistoryEntry {
	id: number;
	project_id: number;
	kind: "export" | "send";
	provider: string;
	environment: string;
	status: "pending" | "succeeded" | "failed";
	provider_status: string;
	remote_id: string;
	message: string;
	snapshot: ResolvedRelease;
	created_at: string;
	updated_at: string;
}

export interface TooLostStatus {
	configured: boolean;
	connected: boolean;
	environment: "sandbox" | "production";
	callback_url?: string;
	artwork_transfer: "cover_url" | "manual";
	final_submission: "in_toolost";
}

export interface TooLostConfiguration {
	client_id: string;
	client_secret_configured: boolean;
	public_base_url: string;
	environment: "sandbox" | "production";
	callback_url: string;
	configured: boolean;
	encryption_managed: boolean;
}

export interface SaveTooLostConfiguration {
	client_id: string;
	client_secret?: string;
	public_base_url: string;
	environment: "sandbox" | "production";
}

export interface TooLostLookups {
	genres: string[];
	languages: { code: string; name: string }[];
}

export interface ExportProgress {
	phase: "preparing" | "downloading";
	loaded: number;
	total?: number;
}

export const distributionKeys = {
	profile: ["artist-profile"] as const,
	preparation: (id: number) => ["release-preparation", id] as const,
	history: (id: number) => ["distribution-history", id] as const,
	toolost: ["integration", "toolost"] as const,
	toolostConfiguration: ["admin", "integration", "toolost"] as const,
	toolostLookups: ["integration", "toolost", "lookups"] as const,
};

export const getArtistProfile = () => get<ArtistProfile>("/api/artist-profile");
export const saveArtistProfile = (profile: ArtistProfile) =>
	put<ArtistProfile>("/api/artist-profile", profile);
export const getReleasePreparation = (projectId: number) =>
	get<ReleasePreparationResponse>(
		`/api/projects/${projectId}/release-preparation`,
	);
export const saveReleasePreparation = (
	projectId: number,
	preparation: ReleasePreparation,
) =>
	put<ReleasePreparationResponse>(
		`/api/projects/${projectId}/release-preparation`,
		preparation,
	);
export const getDistributionHistory = (projectId: number) =>
	get<DistributionHistoryEntry[]>(
		`/api/projects/${projectId}/distribution-history`,
	);
export const getTooLostStatus = () =>
	get<TooLostStatus>("/api/integrations/toolost");
export const getTooLostConfiguration = () =>
	get<TooLostConfiguration>("/api/admin/integrations/toolost");
export const saveTooLostConfiguration = (
	configuration: SaveTooLostConfiguration,
) =>
	put<TooLostConfiguration>("/api/admin/integrations/toolost", configuration);
export const getTooLostLookups = () =>
	get<TooLostLookups>("/api/integrations/toolost/lookups");
export const connectTooLost = () =>
	post<{ configured: boolean; url?: string; message?: string }>(
		"/api/integrations/toolost/connect",
	);
export const disconnectTooLost = () => del<void>("/api/integrations/toolost");
export const createTooLostDraft = (projectId: number) =>
	post<{ history: DistributionHistoryEntry; validation: ReleaseValidation }>(
		`/api/projects/${projectId}/distribution/toolost`,
	);
export const refreshDistributionStatus = (
	projectId: number,
	historyId: number,
) =>
	post<DistributionHistoryEntry>(
		`/api/projects/${projectId}/distribution-history/${historyId}/refresh`,
	);

export async function exportReleasePackage(
	projectId: number,
	onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
	onProgress?.({ phase: "preparing", loaded: 0 });
	const csrf = getCSRFToken();
	const response = await fetch(
		resolveApiUrl(`/api/projects/${projectId}/release-package`),
		{
			method: "POST",
			credentials: "include",
			headers: {
				...getAuthHeaders(),
				...(csrf ? { "X-CSRF-Token": csrf } : {}),
			},
		},
	);
	if (!response.ok) {
		const data = await response.json().catch(() => undefined);
		throw new ApiError(
			data?.error || "Could not export release package",
			response.status,
			data,
		);
	}
	const totalHeader = response.headers.get("Content-Length");
	const total = totalHeader ? Number(totalHeader) : undefined;
	if (!response.body) {
		onProgress?.({ phase: "downloading", loaded: total ?? 0, total });
		return response.blob();
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let loaded = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.byteLength;
		onProgress?.({ phase: "downloading", loaded, total });
	}
	return new Blob(chunks as BlobPart[], {
		type: response.headers.get("Content-Type") || "application/zip",
	});
}
