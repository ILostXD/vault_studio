import { type DownloadResult, saveDownload } from "../lib/download";
import type { MotionAssetKind, ProjectMotionAsset } from "../lib/motionArtwork";
import type {
	CreateProjectRequest,
	MoveProjectRequest,
	Project,
	UpdateProjectRequest,
} from "../types/api";
import { del, get, getAuthHeaders, getCSRFToken, post, put } from "./client";
import { getProjectCoverUrl } from "./media";
import { resolveApiUrl } from "./server";

export async function getProjects(
	folderId?: number | "root",
): Promise<Project[]> {
	const params = folderId !== undefined ? `?folder_id=${folderId}` : "";
	return get<Project[]>(`/api/projects${params}`);
}

export async function getProject(id: string): Promise<Project> {
	return get<Project>(`/api/projects/${id}`);
}

export async function createProject(
	data: CreateProjectRequest,
): Promise<Project> {
	return post<Project>("/api/projects", data);
}

export async function updateProject(
	id: string,
	data: UpdateProjectRequest,
): Promise<Project> {
	return put<Project>(`/api/projects/${id}`, data);
}

export async function updateProjectNotes(
	id: string,
	notes: string,
	authorName?: string,
): Promise<Project> {
	return updateProject(id, { notes, notes_author_name: authorName });
}

export async function deleteProject(id: string): Promise<void> {
	return del<void>(`/api/projects/${id}`);
}

export async function moveProject(
	id: string,
	data: MoveProjectRequest,
): Promise<Project> {
	return put<Project>(`/api/projects/${id}/folder`, data);
}

export interface ProjectWithOrder {
	project_id: string;
	custom_order: number;
}

export async function moveProjectsToFolder(params: {
	projectIds?: string[];
	projects?: ProjectWithOrder[];
	folderId: number;
}): Promise<Project[]> {
	return post<Project[]>("/api/projects/move-to-folder", {
		project_ids: params.projectIds,
		projects: params.projects,
		folder_id: params.folderId,
	});
}

export async function uploadProjectCover(
	id: string,
	file: File,
): Promise<Project> {
	const formData = new FormData();
	formData.append("cover", file);
	const response = await fetch(resolveApiUrl(`/api/projects/${id}/cover`), {
		method: "PUT",
		credentials: "include",
		headers: {
			...getAuthHeaders(),
			...(getCSRFToken() ? { "X-CSRF-Token": getCSRFToken() as string } : {}),
		},
		body: formData,
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Failed to upload cover" }));
		throw new Error(error.error || "Failed to upload cover");
	}

	return response.json();
}

export async function deleteProjectCover(id: string): Promise<Project> {
	const response = await fetch(resolveApiUrl(`/api/projects/${id}/cover`), {
		method: "DELETE",
		credentials: "include",
		headers: {
			...getAuthHeaders(),
			...(getCSRFToken() ? { "X-CSRF-Token": getCSRFToken() as string } : {}),
		},
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Failed to delete cover" }));
		throw new Error(error.error || "Failed to delete cover");
	}

	return response.json();
}

export type CoverSize = "small" | "medium" | "large" | "source";

export async function fetchProjectCover(
	id: string,
	coverUrl?: string | null,
	size?: CoverSize,
): Promise<Blob> {
	if (coverUrl?.startsWith("/api/share/")) {
		let url = resolveApiUrl(coverUrl);
		if (size) {
			const separator = url.includes("?") ? "&" : "?";
			url = `${url}${separator}size=${size}`;
		}
		const response = await fetch(url, {
			credentials: "include",
			headers: getAuthHeaders(),
		});
		if (!response.ok) {
			throw new Error("Failed to load cover art");
		}
		return response.blob();
	}

	const signed = await getProjectCoverUrl(id, { size });
	const response = await fetch(resolveApiUrl(signed.url), {
		credentials: "include",
		headers: getAuthHeaders(),
	});

	if (!response.ok) {
		throw new Error("Failed to load cover art");
	}

	return response.blob();
}

export async function getProjectMotionAssets(
	id: string,
): Promise<ProjectMotionAsset[]> {
	const assets = await get<ProjectMotionAsset[]>(
		`/api/projects/${id}/motion-art`,
	);
	return Promise.all(
		assets.map(async (asset) => {
			const signed = await get<{ url: string }>(
				`/api/media/projects/${id}/motion-art/${asset.kind}`,
			);
			return { ...asset, preview_url: resolveApiUrl(signed.url) };
		}),
	);
}

export async function uploadProjectMotionAsset(
	id: string,
	kind: MotionAssetKind,
	file: File,
): Promise<ProjectMotionAsset> {
	const formData = new FormData();
	formData.append("asset", file);
	const response = await fetch(
		resolveApiUrl(`/api/projects/${id}/motion-art/${kind}`),
		{
			method: "PUT",
			credentials: "include",
			headers: {
				...getAuthHeaders(),
				...(getCSRFToken() ? { "X-CSRF-Token": getCSRFToken() as string } : {}),
			},
			body: formData,
		},
	);
	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Failed to upload motion artwork" }));
		throw new Error(error.error || "Failed to upload motion artwork");
	}
	return response.json();
}

export async function deleteProjectMotionAsset(
	id: string,
	kind: MotionAssetKind,
): Promise<void> {
	return del<void>(`/api/projects/${id}/motion-art/${kind}`);
}

export async function downloadProjectCover(
	id: string,
	coverUrl: string | null | undefined,
	fileName: string,
): Promise<DownloadResult> {
	if (coverUrl?.startsWith("/api/share/")) {
		return saveDownload({
			url: `${coverUrl}${coverUrl.includes("?") ? "&" : "?"}size=source`,
			fileName,
			mimeType: "image/jpeg",
		});
	}

	const signed = await getProjectCoverUrl(id, { size: "source" });
	return saveDownload({
		url: signed.url,
		fileName,
		mimeType: "image/jpeg",
	});
}

export async function duplicateProject(id: string): Promise<Project> {
	return post<Project>(`/api/projects/${id}/duplicate`);
}

export async function exportProject(id: string): Promise<Blob> {
	const response = await fetch(resolveApiUrl(`/api/projects/${id}/export`), {
		credentials: "include",
		headers: getAuthHeaders(),
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Failed to export project" }));
		throw new Error(error.error || "Failed to export project");
	}

	return response.blob();
}
