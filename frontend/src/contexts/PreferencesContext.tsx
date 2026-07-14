import React, { createContext, useContext, useEffect, useState } from "react";
import type { UserPreferences, UpdatePreferencesRequest } from "../types/api";
import {
  getPreferences as fetchPrefs,
  updatePreferences as updatePrefs,
} from "../api/preferences";
import { useAuth } from "./AuthContext";

export type EffectiveTheme = "light" | "default" | "black";

interface PreferencesContextType {
  preferences: UserPreferences | null;
  effectiveTheme: EffectiveTheme;
  isLoading: boolean;
  updatePreferences: (
    data: UpdatePreferencesRequest,
  ) => Promise<UserPreferences>;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined,
);

function resolveTheme(
  themeMode?: string,
  systemDarkTheme?: string,
  systemPrefersDark = false,
): EffectiveTheme {
  const normalizedTheme = themeMode === "oled" ? "black" : themeMode;
  if (normalizedTheme !== "system") {
    return normalizedTheme === "light" || normalizedTheme === "black"
      ? normalizedTheme
      : "default";
  }

  if (!systemPrefersDark) return "light";
  return systemDarkTheme === "black" ? "black" : "default";
}

function applyTheme(color: string | undefined, theme: EffectiveTheme) {
  document.documentElement.style.setProperty(
    "--accent-color",
    color || "#ffba00",
  );
  document.documentElement.classList.remove("black", "light");
  if (theme === "black" || theme === "light") {
    document.documentElement.classList.add(theme);
  }
  document.documentElement.style.colorScheme =
    theme === "light" ? "light" : "dark";

  const themeColor =
    theme === "light" ? "#f4f4f5" : theme === "black" ? "#000000" : "#181818";
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", themeColor);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [effectiveTheme, setEffectiveTheme] =
    useState<EffectiveTheme>("default");
  const [isLoading, setIsLoading] = useState(true);

  const refreshPreferences = async () => {
    if (!isAuthenticated) {
      setPreferences(null);
      setIsLoading(false);
      return;
    }
    try {
      setPreferences(await fetchPrefs());
    } catch (err) {
      console.error("Failed to load preferences:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePreferences = async (data: UpdatePreferencesRequest) => {
    try {
      const updated = await updatePrefs(data);
      setPreferences(updated);
      return updated;
    } catch (err) {
      console.error("Failed to update preferences:", err);
      throw err;
    }
  };

  useEffect(() => {
    refreshPreferences();
  }, [isAuthenticated]);

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateResolvedTheme = () => {
      const resolved = resolveTheme(
        preferences?.theme,
        preferences?.system_dark_theme,
        colorScheme.matches,
      );
      setEffectiveTheme(resolved);
      applyTheme(preferences?.accent_color, resolved);
    };

    updateResolvedTheme();
    colorScheme.addEventListener("change", updateResolvedTheme);
    return () => colorScheme.removeEventListener("change", updateResolvedTheme);
  }, [
    preferences?.accent_color,
    preferences?.system_dark_theme,
    preferences?.theme,
  ]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        effectiveTheme,
        isLoading,
        updatePreferences: handleUpdatePreferences,
        refreshPreferences,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
