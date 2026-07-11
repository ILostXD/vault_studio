import React, { createContext, useContext, useState, useEffect } from "react";
import type { UserPreferences, UpdatePreferencesRequest } from "../types/api";
import { getPreferences as fetchPrefs, updatePreferences as updatePrefs } from "../api/preferences";
import { useAuth } from "./AuthContext";

interface PreferencesContextType {
  preferences: UserPreferences | null;
  isLoading: boolean;
  updatePreferences: (data: UpdatePreferencesRequest) => Promise<UserPreferences>;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyTheme = (color?: string, themeMode?: string) => {
    const activeColor = color || "#ffba00";
    const normalizedTheme = themeMode === "oled" ? "black" : themeMode;
    document.documentElement.style.setProperty("--accent-color", activeColor);

    document.documentElement.classList.remove("black", "light");
    if (normalizedTheme === "black") {
      document.documentElement.classList.add("black");
    } else if (normalizedTheme === "light") {
      document.documentElement.classList.add("light");
    }
  };

  const refreshPreferences = async () => {
    if (!isAuthenticated) {
      setPreferences(null);
      applyTheme("#ffba00", "default");
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchPrefs();
      setPreferences(data);
      applyTheme(data.accent_color, data.theme);
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
      applyTheme(updated.accent_color, updated.theme);
      return updated;
    } catch (err) {
      console.error("Failed to update preferences:", err);
      throw err;
    }
  };

  useEffect(() => {
    refreshPreferences();
  }, [isAuthenticated]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
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
