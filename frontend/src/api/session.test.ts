// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResponse } from "../types/api";
import {
  clearAuthTokens,
  getAuthTokens,
  isPersistentAuthSession,
  storeAuthTokensFromResponse,
} from "./session";

const response: AuthResponse = {
  access_token: "access",
  refresh_token: "refresh",
  csrf_token: "csrf",
  user: {
    id: 1,
    username: "test",
    email: "test@example.com",
    is_admin: false,
    is_owner: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("auth session storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createStorage(),
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("persists remembered sessions", () => {
    storeAuthTokensFromResponse(response, true);

    expect(getAuthTokens()?.refreshToken).toBe("refresh");
    expect(isPersistentAuthSession()).toBe(true);
  });

  it("keeps non-remembered sessions in session storage", () => {
    storeAuthTokensFromResponse(response, false);

    expect(getAuthTokens()?.accessToken).toBe("access");
    expect(isPersistentAuthSession()).toBe(false);
  });

  it("clears both storage modes", () => {
    storeAuthTokensFromResponse(response, true);
    clearAuthTokens();

    expect(getAuthTokens()).toBeNull();
  });
});
