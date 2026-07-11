import { getServerUrl } from "./server";
import type { AuthResponse } from "../types/api";

interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken?: string;
}

const AUTH_STORAGE_PREFIX = "vault.auth";

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getStorageKey() {
  const serverUrl =
    getServerUrl() || (typeof window !== "undefined" ? window.location.origin : "relative");
  return `${AUTH_STORAGE_PREFIX}:${serverUrl}`;
}

export function getAuthTokens(): StoredAuthTokens | null {
  if (!hasLocalStorage()) return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAuthTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeAuthTokensFromResponse(response: AuthResponse) {
  if (!hasLocalStorage()) return;
  if (!response.access_token || !response.refresh_token) return;

  const tokens: StoredAuthTokens = {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    csrfToken: response.csrf_token,
  };

  window.localStorage.setItem(getStorageKey(), JSON.stringify(tokens));
}

export function clearAuthTokens() {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(getStorageKey());
}

export function getAuthorizationHeader(): Record<string, string> {
  const tokens = getAuthTokens();
  return tokens?.accessToken
    ? { Authorization: `Bearer ${tokens.accessToken}` }
    : {};
}
