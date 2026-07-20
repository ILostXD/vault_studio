import { get, post, put, del, getCSRFToken, getAuthHeaders } from './client'
import type { Track, TrackWithShareInfo, CreateTrackRequest, UpdateTrackRequest } from '../types/api'
import { resolveApiUrl } from './server'
import { saveDownload, type DownloadResult } from '../lib/download'

export async function getTracks(projectId?: number): Promise<Track[]> {
  const endpoint = projectId
    ? `/api/tracks?project_id=${projectId}`
    : '/api/tracks'
  return get<Track[]>(endpoint)
}

export async function searchTracks(query?: string, limit?: number): Promise<Track[]> {
  const params = new URLSearchParams()
  if (query) params.append('q', query)
  if (limit) params.append('limit', limit.toString())
  const endpoint = params.toString() ? `/api/tracks/search?${params}` : '/api/tracks/search'
  return get<Track[]>(endpoint)
}

export async function getTrack(id: string): Promise<TrackWithShareInfo> {
  return get<TrackWithShareInfo>(`/api/tracks/${id}`)
}

export async function createTrack(data: CreateTrackRequest): Promise<Track> {
  return post<Track>('/api/tracks', data)
}

export async function updateTrack(
  id: string,
  data: UpdateTrackRequest
): Promise<Track> {
  return put<Track>(`/api/tracks/${id}`, data)
}

export async function deleteTrack(id: string): Promise<void> {
  return del<void>(`/api/tracks/${id}`)
}

export async function uploadTrack(
  file: File,
  projectId: number,
  metadata?: {
    title?: string
    artist?: string
    album?: string
  }
): Promise<Track> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('project_id', String(projectId))

  if (metadata?.title) formData.append('title', metadata.title)
  if (metadata?.artist) formData.append('artist', metadata.artist)
  if (metadata?.album) formData.append('album', metadata.album)

	const response = await fetch(resolveApiUrl('/api/library/upload'), {
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


export async function reorderTracks(
  trackOrders: Array<{ id: number; order: number }>
): Promise<void> {
  return post<void>('/api/tracks/reorder', { track_orders: trackOrders })
}

export async function downloadTrack(trackId: string, versionId: number): Promise<DownloadResult> {
  return saveDownload({
    url: `/api/tracks/${trackId}/versions/${versionId}/download`,
    fileName: `track-${trackId}.wav`,
    mimeType: 'audio/wav',
  })
}

export async function duplicateTrack(trackId: string): Promise<Track> {
  return post<Track>(`/api/tracks/${trackId}/duplicate`, {})
}

export async function moveTrack(trackId: string, projectId: number): Promise<Track> {
  return updateTrack(trackId, { project_id: projectId })
}

export async function updateTrackNotes(trackId: string, notes: string, authorName?: string): Promise<Track> {
  return updateTrack(trackId, { notes, notes_author_name: authorName })
}
