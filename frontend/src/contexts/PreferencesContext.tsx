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

  const applyTheme = (color?: string) => {
    const activeColor = color || "#ffba00";
    document.documentElement.style.setProperty("--accent-color", activeColor);
  };

  const refreshPreferences = async () => {
    if (!isAuthenticated) {
      setPreferences(null);
      applyTheme("#ffba00");
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchPrefs();
      setPreferences(data);
      applyTheme(data.accent_color);
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
      applyTheme(updated.accent_color);
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
