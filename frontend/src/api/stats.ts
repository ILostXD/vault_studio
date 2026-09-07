import type {
	InstanceInfo,
	InstanceVersion,
	StorageStats,
	UpdateInstanceNameRequest,
	UpdateStatus,
} from "../types/api";
import { get, post, put } from "./client";

export async function getStorageStats(): Promise<StorageStats> {
	return get<StorageStats>("/api/stats/storage");
}

export async function getGlobalStorageStats(): Promise<StorageStats> {
	return get<StorageStats>("/api/stats/storage/global");
}

export async function getInstanceInfo(): Promise<InstanceInfo> {
	return get<InstanceInfo>("/api/instance");
}

export async function getInstanceVersion(): Promise<InstanceVersion> {
	return get<InstanceVersion>("/api/instance/version", { requiresAuth: false });
}

export async function updateInstanceName(
	data: UpdateInstanceNameRequest,
): Promise<InstanceInfo> {
	return put<InstanceInfo>("/api/instance/name", data);
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
	return get<UpdateStatus>("/api/admin/update");
}

export async function installUpdate(): Promise<{ started: boolean }> {
	return post<{ started: boolean }>("/api/admin/update");
}
