import { env } from "@/env";

const SERVER_URL_STORAGE_KEY = "vault.backendUrl";
const SERVER_URL_CHANGE_EVENT = "vault:backend-url-change";

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeServerUrlInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  const url = new URL(withProtocol);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Server URL must start with http:// or https://");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

export function normalizeServerUrl(value: string): string {
  return normalizeServerUrlInput(value);
}

export function getServerUrl(): string {
  if (hasLocalStorage()) {
    const saved = window.localStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (saved) return saved;
  }

  return env.VITE_API_URL || "";
}

export function setServerUrl(value: string): string {
  const normalized = normalizeServerUrlInput(value);

  if (hasLocalStorage()) {
    if (normalized) {
      window.localStorage.setItem(SERVER_URL_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(SERVER_URL_STORAGE_KEY);
    }

    window.dispatchEvent(
      new CustomEvent(SERVER_URL_CHANGE_EVENT, { detail: normalized }),
    );
  }

  return normalized;
}

export function resolveApiUrl(endpoint: string): string {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const baseUrl = getServerUrl();
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return `${baseUrl}${normalizedEndpoint}`;
}

export function resolveWebSocketUrl(endpoint = "/api/ws"): string {
  const serverUrl = getServerUrl();
  const baseUrl = serverUrl || window.location.origin;
  const url = new URL(endpoint, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function onServerUrlChange(listener: (url: string) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = (event: Event) => {
    listener((event as CustomEvent<string>).detail || getServerUrl());
  };

  window.addEventListener(SERVER_URL_CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(SERVER_URL_CHANGE_EVENT, handleChange);
}
