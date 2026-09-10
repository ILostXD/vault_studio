import { get, post, put, del } from './client'
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '../types/api'
import { getAuthTokens, isPersistentAuthSession } from './session'

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/register', data, { requiresAuth: false })
}

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
	return post<AuthResponse>('/api/auth/login', credentials, { requiresAuth: false, timeoutMs: 10000 })
}

export async function refresh(options?: { timeoutMs?: number }): Promise<AuthResponse> {
	const refreshToken = getAuthTokens()?.refreshToken
	return post<AuthResponse>(
		'/api/auth/refresh',
		{
			...(refreshToken ? { refresh_token: refreshToken } : {}),
			remember_me: refreshToken ? isPersistentAuthSession() : true,
		},
		{ requiresAuth: false, timeoutMs: options?.timeoutMs ?? 4000 }
	)
}

export async function getMe(options?: { timeoutMs?: number }): Promise<User> {
  return get<User>('/api/auth/me', { timeoutMs: options?.timeoutMs ?? 4000 })
}

export async function checkUsersExist(options?: { timeoutMs?: number }): Promise<{ users_exist: boolean }> {
  return get<{ users_exist: boolean }>('/api/auth/check-users', {
    requiresAuth: false,
    timeoutMs: options?.timeoutMs ?? 6000,
  })
}

export async function updateUsername(username: string): Promise<User> {
  return put<User>('/api/auth/username', { username })
}

export async function deleteAccount(password: string): Promise<void> {
	return del<void>('/api/auth/me', { body: JSON.stringify({ password }) })
}

export async function logout(): Promise<{ status: string }> {
	return post<{ status: string }>('/api/auth/logout', {})
}
