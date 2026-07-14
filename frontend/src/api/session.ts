import { getServerUrl } from "./server";
import type { AuthResponse, User } from "../types/api";

interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken?: string;
}

const AUTH_STORAGE_PREFIX = "vault.auth";
const USER_STORAGE_PREFIX = "vault.auth.user";

function hasWebStorage() {
  return typeof window !== "undefined";
}

function getStorageKey(prefix: string) {
  const serverUrl =
    getServerUrl() ||
    (typeof window !== "undefined" ? window.location.origin : "relative");
  return `${prefix}:${serverUrl}`;
}

function readStoredValue(key: string): string | null {
  if (!hasWebStorage()) return null;
  return window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
}

function writeStoredValue(key: string, value: string, persistent: boolean) {
  if (!hasWebStorage()) return;
  const target = persistent ? window.localStorage : window.sessionStorage;
  const other = persistent ? window.sessionStorage : window.localStorage;
  target.setItem(key, value);
  other.removeItem(key);
}

export function getAuthTokens(): StoredAuthTokens | null {
  try {
    const raw = readStoredValue(getStorageKey(AUTH_STORAGE_PREFIX));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isPersistentAuthSession() {
  if (!hasWebStorage()) return true;
  return window.localStorage.getItem(getStorageKey(AUTH_STORAGE_PREFIX)) !== null;
}

export function storeAuthTokensFromResponse(
  response: AuthResponse,
  persistent = true,
) {
  if (!response.access_token || !response.refresh_token) return;
  writeStoredValue(
    getStorageKey(AUTH_STORAGE_PREFIX),
    JSON.stringify({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      csrfToken: response.csrf_token,
    } satisfies StoredAuthTokens),
    persistent,
  );
}

export function getCachedUser(): User | null {
  try {
    const raw = readStoredValue(getStorageKey(USER_STORAGE_PREFIX));
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeCachedUser(user: User, persistent: boolean) {
  writeStoredValue(
    getStorageKey(USER_STORAGE_PREFIX),
    JSON.stringify(user),
    persistent,
  );
}

export function clearAuthTokens() {
  if (!hasWebStorage()) return;
  for (const prefix of [AUTH_STORAGE_PREFIX, USER_STORAGE_PREFIX]) {
    const key = getStorageKey(prefix);
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function getAuthorizationHeader(): Record<string, string> {
  const tokens = getAuthTokens();
  return tokens?.accessToken
    ? { Authorization: `Bearer ${tokens.accessToken}` }
    : {};
}
