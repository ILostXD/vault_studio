import type {
	AcceptShareRequest,
	CreateShareTokenRequest,
	ShareAccess,
	ShareToken,
	UpdateVisibilityRequest,
	ValidateShareResponse,
} from "../types/api";
import { del, get, post, put } from "./client";

export async function createTrackShare(
	trackId: string,
	data: CreateShareTokenRequest,
): Promise<ShareToken> {
	return post<ShareToken>(`/api/tracks/${trackId}/share`, data);
}

export async function listTrackShares(): Promise<ShareToken[]> {
	return get<ShareToken[]>("/api/share");
}

export async function updateTrackShare(
	shareId: number,
	data: Partial<CreateShareTokenRequest>,
): Promise<ShareToken> {
	return put<ShareToken>(`/api/share/${shareId}`, data);
}

export async function deleteTrackShare(shareId: number): Promise<void> {
	return del<void>(`/api/share/${shareId}`);
}

export async function createProjectShare(
	projectId: string,
	data: CreateShareTokenRequest,
): Promise<ShareToken> {
	return post<ShareToken>(`/api/projects/${projectId}/share`, data);
}

export async function listProjectShares(): Promise<ShareToken[]> {
	return get<ShareToken[]>("/api/share/projects");
}

export async function updateProjectShare(
	shareId: number,
	data: Partial<CreateShareTokenRequest>,
): Promise<ShareToken> {
	return put<ShareToken>(`/api/share/projects/${shareId}`, data);
}

export async function deleteProjectShare(shareId: number): Promise<void> {
	return del<void>(`/api/share/projects/${shareId}`);
}

export async function updateTrackVisibility(
	trackId: string,
	data: UpdateVisibilityRequest,
): Promise<void> {
	return put<void>(`/api/tracks/${trackId}/visibility`, data);
}

export async function updateProjectVisibility(
	projectId: string,
	data: UpdateVisibilityRequest,
): Promise<void> {
	return put<void>(`/api/projects/${projectId}/visibility`, data);
}

export async function validateShareToken(
	token: string,
	password?: string,
): Promise<ValidateShareResponse> {
	const url = password
		? `/api/share/${token}?password=${encodeURIComponent(password)}`
		: `/api/share/${token}`;
	return get<ValidateShareResponse>(url);
}

export async function validateProjectShareToken(
	token: string,
	password?: string,
): Promise<ValidateShareResponse> {
	const url = password
		? `/api/share/project/${token}?password=${encodeURIComponent(password)}`
		: `/api/share/project/${token}`;
	return get<ValidateShareResponse>(url);
}

export async function acceptShare(
	token: string,
	data: AcceptShareRequest,
): Promise<ShareAccess> {
	return post<ShareAccess>(`/api/share/accept/${token}`, data);
}

export async function listSharedWithMe(): Promise<ShareAccess[]> {
	return get<ShareAccess[]>("/api/share/shared-with-me");
}

export async function listProjectsSharedWithMe(): Promise<any[]> {
	return get<any[]>("/api/projects/shared-with-me");
}

export async function listTracksSharedWithMe(): Promise<any[]> {
	return get<any[]>("/api/tracks/shared-with-me");
}

export async function leaveShare(shareAccessId: number): Promise<void> {
	return del<void>(`/api/share/leave/${shareAccessId}`);
}

export async function leaveSharedProject(projectId: string): Promise<void> {
	return del<void>(`/api/projects/${projectId}/leave`);
}

export async function listProjectShareUsers(projectId: string): Promise<
	Array<{
		id: number;
		shared_to: number;
		can_edit: boolean;
		can_download: boolean;
	}>
> {
	return get(`/api/projects/${projectId}/share-users`);
}

export async function listTrackShareUsers(trackId: string): Promise<
	Array<{
		id: number;
		shared_to: number;
		can_edit: boolean;
		can_download: boolean;
	}>
> {
	return get(`/api/tracks/${trackId}/share-users`);
}

export async function updateProjectSharePermissions(
	shareId: number,
	data: { can_edit: boolean; can_download: boolean },
): Promise<{
	id: number;
	shared_to: number;
	can_edit: boolean;
	can_download: boolean;
}> {
	return put(`/api/user-shares/projects/${shareId}`, data);
}

export async function updateTrackSharePermissions(
	shareId: number,
	data: { can_edit: boolean; can_download: boolean },
): Promise<{
	id: number;
	shared_to: number;
	can_edit: boolean;
	can_download: boolean;
}> {
	return put(`/api/user-shares/tracks/${shareId}`, data);
}

export function generateVaultShareUrl(
	originInstanceUrl: string,
	token: string,
): string {
	return `vault://share/${encodeURIComponent(originInstanceUrl)}/${token}`;
}
