// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ArtistProfileSection } from "./ArtistProfileSection";

vi.mock("@/api/distribution", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/api/distribution")>()),
	getArtistProfile: vi.fn().mockResolvedValue({
		display_name: "Artist",
		legal_name: "Legal Name",
		default_credits: [],
	}),
	saveArtistProfile: vi.fn(),
}));

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
});
afterEach(cleanup);

function renderProfile() {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<ArtistProfileSection />
		</QueryClientProvider>,
	);
}

it("remembers whether reusable credits are expanded", async () => {
	const first = renderProfile();
	const details = (await screen.findByText("Reusable credits")).closest("details");
	expect(details?.open).toBe(true);

	if (!details) throw new Error("Reusable credits disclosure is missing");
	details.open = false;
	fireEvent(details, new Event("toggle"));
	await waitFor(() =>
		expect(
			window.localStorage.getItem("vault:artist-profile:credits-open"),
		).toBe("false"),
	);

	first.unmount();
	renderProfile();
	const restored = (await screen.findByText("Reusable credits")).closest(
		"details",
	);
	expect(restored?.open).toBe(false);
});
