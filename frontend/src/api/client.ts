import { resolveApiUrl } from './server'
import {
	clearAuthTokens,
	getAuthTokens,
	getAuthorizationHeader,
	isPersistentAuthSession,
	storeAuthTokensFromResponse,
	storeCachedUser,
} from './session'
import type { AuthResponse } from '../types/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean
	skipAuthRefresh?: boolean
	timeoutMs?: number
}

let refreshPromise: Promise<void> | null = null

async function refreshAuthSession() {
	if (refreshPromise) return refreshPromise

	refreshPromise = (async () => {
		const tokens = getAuthTokens()
		const persistent = isPersistentAuthSession()
		let response: Response

		let timeoutId: ReturnType<typeof setTimeout> | undefined
		let signal: AbortSignal | undefined
		if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
			signal = AbortSignal.timeout(5000)
		} else {
			const controller = new AbortController()
			timeoutId = setTimeout(() => controller.abort(), 5000)
			signal = controller.signal
		}

		try {
			response = await fetch(resolveApiUrl('/api/auth/refresh'), {
				method: 'POST',
				credentials: 'include',
				signal,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(tokens?.refreshToken
						? { refresh_token: tokens.refreshToken }
						: {}),
					remember_me: persistent,
				}),
			})
		} catch (error) {
			throw new ApiError(
				error instanceof Error ? error.message : 'Network error',
				0,
			)
		} finally {
			if (timeoutId) clearTimeout(timeoutId)
		}

		if (!response.ok) {
			throw new ApiError('Unable to refresh session', response.status)
		}

		const authResponse = (await response.json()) as AuthResponse
		storeAuthTokensFromResponse(authResponse, persistent)
		storeCachedUser(authResponse.user, persistent)
	})().finally(() => {
		refreshPromise = null
	})

	return refreshPromise
}

function getCookieValue(name: string): string | null {
	if (typeof document === 'undefined') return null
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
	return match ? decodeURIComponent(match[1]) : null
}

export function getCSRFToken(): string | null {
	return getCookieValue('csrf_token') || getAuthTokens()?.csrfToken || null
}

export function getAuthHeaders(): Record<string, string> {
	return getAuthorizationHeader()
}

async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
		requiresAuth = true,
		skipAuthRefresh = false,
		headers = {},
		timeoutMs,
		signal: customSignal,
		...restOptions
	} = options

  const url = resolveApiUrl(endpoint)

	const requestHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		...(requiresAuth ? getAuthHeaders() : {}),
		...(headers as Record<string, string>),
	}

	const effectiveTimeout = timeoutMs !== undefined ? timeoutMs : 7000
	let timeoutId: ReturnType<typeof setTimeout> | undefined
	let signal = customSignal

	if (effectiveTimeout > 0 && !signal) {
		if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
			signal = AbortSignal.timeout(effectiveTimeout)
		} else {
			const controller = new AbortController()
			timeoutId = setTimeout(() => {
				controller.abort(new Error(`Request timed out after ${effectiveTimeout}ms`))
			}, effectiveTimeout)
			signal = controller.signal
		}
	}

	if (requiresAuth) {
		const method = (restOptions.method || 'GET').toUpperCase()
		if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
			const csrfToken = getCSRFToken()
			if (csrfToken) {
				requestHeaders['X-CSRF-Token'] = csrfToken
			}
		}
	}

  try {
		const response = await fetch(url, {
			...restOptions,
			signal,
			headers: requestHeaders,
			credentials: 'include',
		})

		if (timeoutId) {
			clearTimeout(timeoutId)
		}

		if (response.status === 401) {
			if (requiresAuth && !skipAuthRefresh) {
				try {
					await refreshAuthSession()
					return apiClient<T>(endpoint, {
						...options,
						skipAuthRefresh: true,
					})
				} catch (refreshError) {
					if (refreshError instanceof ApiError && refreshError.status === 0) {
						throw refreshError
					}
					clearAuthTokens()
				}
			}
			if (!endpoint.startsWith('/api/auth/me') && !endpoint.startsWith('/api/auth/refresh')) {
				const pathname = window.location.pathname
				if (!pathname.includes('/login') && !pathname.includes('/share/')) {
					window.location.href = '/login'
				}
			}
			throw new ApiError('Unauthorized', 401)
		}

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      let errorData: any

      try {
        errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch {
      }

      throw new ApiError(errorMessage, response.status, errorData)
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T
    }

    return await response.json()
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (error instanceof ApiError) {
      throw error
    }

    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        error.message?.includes('timed out'))
    ) {
      throw new ApiError('Unable to reach server. Connection timed out.', 0)
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    )
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export async function get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'GET' })
}

export async function post<T>(
  endpoint: string,
  data?: any,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function put<T>(
  endpoint: string,
  data?: any,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function del<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'DELETE' })
}

export async function patch<T>(
  endpoint: string,
  data?: any,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  })
}
