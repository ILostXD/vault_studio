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
