import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	getPreferences as fetchPrefs,
	updatePreferences as updatePrefs,
} from "../api/preferences";
import type { UpdatePreferencesRequest, UserPreferences } from "../types/api";
import { useAuth } from "./AuthContext";

export type EffectiveTheme = "light" | "default" | "black";

interface PreferencesContextType {
	preferences: UserPreferences | null;
	effectiveTheme: EffectiveTheme;
	accentColor: string;
	isLoading: boolean;
	updatePreferences: (
		data: UpdatePreferencesRequest,
	) => Promise<UserPreferences>;
	refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
	undefined,
);

const appearanceStorageKey = "vault:last-appearance";

interface CachedAppearance {
	theme?: string;
	system_dark_theme?: string;
	accent_color?: string;
}

function loadCachedAppearance(): CachedAppearance {
	try {
		return (
			JSON.parse(window.localStorage.getItem(appearanceStorageKey) || "{}") ?? {}
		);
	} catch {
		return {};
	}
}

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

export function PreferencesProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { isAuthenticated } = useAuth();
	const [preferences, setPreferences] = useState<UserPreferences | null>(null);
	const [cachedAppearance, setCachedAppearance] =
		useState<CachedAppearance>(loadCachedAppearance);
	const [effectiveTheme, setEffectiveTheme] =
		useState<EffectiveTheme>("default");
	const [isLoading, setIsLoading] = useState(true);
	const accentColor =
		preferences?.accent_color ?? cachedAppearance.accent_color ?? "#ffba00";

	const refreshPreferences = useCallback(async () => {
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
	}, [isAuthenticated]);

	const handleUpdatePreferences = useCallback(async (data: UpdatePreferencesRequest) => {
		try {
			const updated = await updatePrefs(data);
			setPreferences(updated);
			return updated;
		} catch (err) {
			console.error("Failed to update preferences:", err);
			throw err;
		}
	}, []);

	useEffect(() => {
		refreshPreferences();
	}, [refreshPreferences]);

	useEffect(() => {
		const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
		const updateResolvedTheme = () => {
			const resolved = resolveTheme(
				preferences?.theme ?? cachedAppearance.theme,
				preferences?.system_dark_theme ?? cachedAppearance.system_dark_theme,
				colorScheme.matches,
			);
			setEffectiveTheme(resolved);
			applyTheme(
				preferences?.accent_color ?? cachedAppearance.accent_color,
				resolved,
			);
		};

		updateResolvedTheme();
		colorScheme.addEventListener("change", updateResolvedTheme);
		return () => colorScheme.removeEventListener("change", updateResolvedTheme);
	}, [
		preferences?.accent_color,
		preferences?.system_dark_theme,
		preferences?.theme,
		cachedAppearance,
	]);

	useEffect(() => {
		if (!preferences) return;
		const appearance = {
			theme: preferences.theme,
			system_dark_theme: preferences.system_dark_theme,
			accent_color: preferences.accent_color,
		};
		window.localStorage.setItem(
			appearanceStorageKey,
			JSON.stringify(appearance),
		);
		setCachedAppearance(appearance);
	}, [preferences]);

	const contextValue = useMemo(
		() => ({
			preferences,
			effectiveTheme,
			accentColor,
			isLoading,
			updatePreferences: handleUpdatePreferences,
			refreshPreferences,
		}),
		[
			preferences,
			effectiveTheme,
			accentColor,
			isLoading,
			handleUpdatePreferences,
			refreshPreferences,
		],
	);

	return (
		<PreferencesContext.Provider value={contextValue}>
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
