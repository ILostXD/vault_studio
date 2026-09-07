// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreferencesProvider, usePreferences } from "./PreferencesContext";

vi.mock("./AuthContext", () => ({
	useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock("../api/preferences", () => ({
	getPreferences: vi.fn(),
	updatePreferences: vi.fn(),
}));

function ThemeProbe() {
	const { accentColor, effectiveTheme } = usePreferences();
	return <span data-accent={accentColor}>{effectiveTheme}</span>;
}

beforeEach(() => {
	const values = new Map<string, string>();
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
			clear: () => values.clear(),
		},
	});
	document.documentElement.className = "";
	document.documentElement.style.cssText = "";
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockReturnValue({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}),
	});
});

afterEach(cleanup);

it("keeps the last saved appearance on the logged-out screen", async () => {
	window.localStorage.setItem(
		"vault:last-appearance",
		JSON.stringify({ theme: "light", accent_color: "#12ab34" }),
	);

	const view = render(
		<PreferencesProvider>
			<ThemeProbe />
		</PreferencesProvider>,
	);

	await waitFor(() => expect(view.getByText("light")).toBeTruthy());
	expect(view.getByText("light").getAttribute("data-accent")).toBe("#12ab34");
	expect(document.documentElement.classList.contains("light")).toBe(true);
	expect(
		document.documentElement.style.getPropertyValue("--accent-color"),
	).toBe("#12ab34");
});
