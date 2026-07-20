import { get, put, del, getCSRFToken, getAuthHeaders } from './client'
import type { VersionWithMetadata, UpdateVersionRequest } from '../types/api'
import { resolveApiUrl } from './server'
import { saveDownload, type DownloadResult } from '../lib/download'


export async function getVersions(trackId: string): Promise<VersionWithMetadata[]> {
  return get<VersionWithMetadata[]>(`/api/tracks/${trackId}/versions`)
}

export async function uploadVersion(
  trackId: string,
  file: File,
  versionName?: string,
  notes?: string
): Promise<VersionWithMetadata> {
  const formData = new FormData()
  formData.append('file', file)
  
  if (versionName) {
    formData.append('version_name', versionName)
  }
  
  if (notes) {
    formData.append('notes', notes)
  }

	const response = await fetch(resolveApiUrl(`/api/tracks/${trackId}/versions/upload`), {
		method: 'POST',
		credentials: 'include',
		headers: {
			...getAuthHeaders(),
			...(getCSRFToken() ? { 'X-CSRF-Token': getCSRFToken() as string } : {}),
		},
		body: formData,
	})

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || 'Upload failed')
  }

  return response.json()
}

export async function updateVersion(
  versionId: number,
  data: UpdateVersionRequest
): Promise<VersionWithMetadata> {
  return put<VersionWithMetadata>(`/api/versions/${versionId}`, data)
}

export interface TrackAnalysisResponse {
  bpm?: number
  key?: string
}

export async function analyzeTrack(trackId: string): Promise<TrackAnalysisResponse> {
	const response = await fetch(resolveApiUrl(`/api/tracks/${trackId}/analyze`), {
		method: 'POST',
		credentials: 'include',
		headers: {
			...getAuthHeaders(),
			...(getCSRFToken() ? { 'X-CSRF-Token': getCSRFToken() as string } : {}),
		},
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Failed to analyze audio' }))
		throw new Error(error.error || 'Failed to analyze audio')
	}

	return response.json()
}

export async function activateVersion(versionId: number): Promise<TrackAnalysisResponse> {
	const response = await fetch(resolveApiUrl(`/api/versions/${versionId}/activate`), {
		method: 'POST',
		credentials: 'include',
		headers: {
			...getAuthHeaders(),
			...(getCSRFToken() ? { 'X-CSRF-Token': getCSRFToken() as string } : {}),
		},
	})

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to activate version' }))
    throw new Error(error.error || 'Failed to activate version')
  }

  return response.json()
}

export async function deleteVersion(versionId: number): Promise<void> {
  return del<void>(`/api/versions/${versionId}`)
}

export function getVersionDownloadUrl(trackId: string, versionId: number): string {
  return resolveApiUrl(`/api/tracks/${trackId}/versions/${versionId}/download`)
}

export async function downloadVersion(trackId: string, versionId: number): Promise<DownloadResult> {
  return saveDownload({
    url: getVersionDownloadUrl(trackId, versionId),
    fileName: `version-${versionId}.wav`,
    mimeType: 'audio/wav',
  })
}
