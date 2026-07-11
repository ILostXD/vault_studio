import { get } from './client'
import { resolveApiUrl } from './server'
import { getAuthTokens } from './session'

function appendAccessToken(url: string): string {
	const accessToken = getAuthTokens()?.accessToken
	if (!accessToken || url.includes('/api/share/')) return url

	try {
		const parsed = new URL(url)
		if (!parsed.pathname.startsWith('/api/')) return url
		if (!parsed.searchParams.has('access_token')) {
			parsed.searchParams.set('access_token', accessToken)
		}
		return parsed.toString()
	} catch {
		return url
	}
}

export function resolveApiMediaUrl(url?: string | null): string | undefined {
	if (!url) return undefined
	if (/^[a-z][a-z\d+\-.]*:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
		return appendAccessToken(url)
	}
	if (url.startsWith('/api/')) {
		return appendAccessToken(resolveApiUrl(url))
	}
	return url
}

export async function getStreamUrl(
	trackId: string,
	params?: { quality?: string; versionId?: number | null }
): Promise<{ url: string }> {
	const query = new URLSearchParams()
	if (params?.quality) {
		query.set('quality', params.quality)
	}
	if (params?.versionId) {
		query.set('version_id', String(params.versionId))
	}
	const suffix = query.toString() ? `?${query.toString()}` : ''
	return get<{ url: string }>(`/api/media/stream/${trackId}${suffix}`)
}

export async function getProjectCoverUrl(
	projectId: string,
	params?: { size?: string }
): Promise<{ url: string }> {
	const query = new URLSearchParams()
	if (params?.size) {
		query.set('size', params.size)
	}
	const suffix = query.toString() ? `?${query.toString()}` : ''
	return get<{ url: string }>(`/api/media/projects/${projectId}/cover${suffix}`)
}
