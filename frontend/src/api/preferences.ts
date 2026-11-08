import type { UpdatePreferencesRequest, UserPreferences } from "../types/api";
import { get, put } from "./client";

export async function getPreferences(): Promise<UserPreferences> {
	return get<UserPreferences>("/api/preferences");
}

export async function updatePreferences(
	data: UpdatePreferencesRequest,
): Promise<UserPreferences> {
	return put<UserPreferences>("/api/preferences", data);
}

/** Server-computed dominant cover colour, so every device agrees. */
export async function getCoverAccent(projectId: string): Promise<string> {
	return (
		await get<{ color: string }>(`/api/projects/${projectId}/cover-accent`)
	).color;
}
