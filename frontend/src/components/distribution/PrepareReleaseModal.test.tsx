// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrepareReleaseModal } from "./PrepareReleaseModal";

const mocks = vi.hoisted(() => ({
	getPreparation: vi.fn(),
	getProfile: vi.fn(),
	getTooLost: vi.fn(),
	getTooLostLookups: vi.fn(),
	getHistory: vi.fn(),
	savePreparation: vi.fn(),
	exportPackage: vi.fn(),
}));

vi.mock("@/api/distribution", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/api/distribution")>()),
	getReleasePreparation: mocks.getPreparation,
	getArtistProfile: mocks.getProfile,
	getTooLostStatus: mocks.getTooLost,
	getTooLostLookups: mocks.getTooLostLookups,
	getDistributionHistory: mocks.getHistory,
	saveReleasePreparation: mocks.savePreparation,
	exportReleasePackage: mocks.exportPackage,
}));

vi.mock("@/components/modals/BaseModal", () => ({
	default: ({
		isOpen,
		children,
	}: {
		isOpen: boolean;
		children: React.ReactNode;
	}) => (isOpen ? <div>{children}</div> : null),
}));

const releaseResponse = {
	preparation: { release: {}, tracks: {} },
	release: {
		project_id: 7,
		title: "Existing Project",
		artist: "Display Artist",
		release_type: "",
		release_date: "",
		original_release_date: "",
		language: "",
		genres: [],
		copyright: "",
		phonographic_copyright: "",
		label: "",
		upc: "",
		credits: [{ name: "Legal Artist", role: "Composer" }],
		artwork: {
			filename: "cover.png",
			format: "png",
			size: 100,
			derived: false,
		},
		motion_artwork: [],
		tracks: [
			{
				track_id: 11,
				version_id: 12,
				number: 1,
				title: "Known Song",
				artist: "Display Artist",
				language: "",
				genres: [],
				copyright: "",
				phonographic_copyright: "",
				label: "",
				explicit: null,
				lyrics: "",
				isrc: "",
				credits: [{ name: "Legal Artist", role: "Composer" }],
				duration_seconds: 180,
				master: {
					filename: "song.wav",
					format: "wav",
					size: 100,
					derived: false,
				},
			},
		],
	},
	validation: {
		can_export: true,
		can_send: true,
		issues: [
			{
				severity: "warning",
				scope: "vault",
				code: "release.date_missing",
				field: "release.release_date",
				message: "Choose a release date before distribution.",
				remediation: "fix_in_vault",
			},
		],
	},
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("PrepareReleaseModal", () => {
	it("shows inherited Vault data, per-track overrides, and keeps final submission in Too Lost", async () => {
		mocks.getPreparation.mockResolvedValue(releaseResponse);
		mocks.getProfile.mockResolvedValue({
			display_name: "Display Artist",
			legal_name: "Legal Artist",
			default_credits: releaseResponse.release.credits,
		});
		mocks.getTooLost.mockResolvedValue({
			configured: true,
			connected: true,
			environment: "sandbox",
			artwork_transfer: "manual",
			final_submission: "in_toolost",
		});
		mocks.getHistory.mockResolvedValue([]);
		mocks.getTooLostLookups.mockResolvedValue({
			genres: ["Alternative", "Hip-Hop/Rap"],
			languages: [{ code: "en", name: "English" }],
		});
		mocks.savePreparation.mockImplementation(async () => releaseResponse);
		const client = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={client}>
				<PrepareReleaseModal isOpen onClose={vi.fn()} projectId={7} />
			</QueryClientProvider>,
		);

		const titleInput = await screen.findByDisplayValue("Existing Project");
		expect(titleInput.classList.contains("themed-input-surface")).toBe(true);
		expect(screen.getByText(/1 track/)).toBeTruthy();
		expect(screen.getByText("Original release date (optional)")).toBeTruthy();
		const removeCredit = screen.getByRole("button", {
			name: "Remove credit 1",
		});
		expect(removeCredit.className).toContain("text-(--danger-0)");
		expect(removeCredit.className).toContain("hover:bg-(--danger-1)");
		expect(
			screen.getByRole("button", { name: "Add credit" }).parentElement
				?.className,
		).toContain("items-center");

		fireEvent.click(screen.getByRole("tab", { name: "tracks" }));
		fireEvent.click(screen.getByText("Known Song"));
		expect(screen.queryByText("Genres")).toBeNull();
		expect(screen.queryByText("Copyright (C-line)")).toBeNull();
		expect(screen.queryByText("Phonographic copyright (P-line)")).toBeNull();
		expect(
			(
				screen.getByLabelText(
					"Override inherited credits for this track",
				) as HTMLInputElement
			).checked,
		).toBe(false);

		fireEvent.click(screen.getByRole("tab", { name: "delivery" }));
		expect(screen.getByText(/final submission stay in Too Lost/)).toBeTruthy();
		expect(
			screen.getByText(/cover.png will be sent with the Too Lost draft/),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /Create or update Too Lost draft/ }),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: /^Submit/i })).toBeNull();
	}, 10_000);

	it("shows progress while a release package is being prepared", async () => {
		mocks.getPreparation.mockResolvedValue(releaseResponse);
		mocks.getProfile.mockResolvedValue({
			display_name: "Display Artist",
			legal_name: "Legal Artist",
			default_credits: releaseResponse.release.credits,
		});
		mocks.getTooLost.mockResolvedValue({
			configured: false,
			connected: false,
			environment: "sandbox",
			artwork_transfer: "manual",
			final_submission: "in_toolost",
		});
		mocks.getHistory.mockResolvedValue([]);
		mocks.savePreparation.mockImplementation(async () => releaseResponse);
		mocks.exportPackage.mockImplementation(
			(_projectId, onProgress) =>
				new Promise(() => {
					onProgress?.({ phase: "preparing", loaded: 0 });
				}),
		);
		const client = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={client}>
				<PrepareReleaseModal isOpen onClose={vi.fn()} projectId={7} />
			</QueryClientProvider>,
		);
		fireEvent.click(await screen.findByRole("tab", { name: "delivery" }));
		expect(
			screen.getByRole("button", { name: /OAuth setup required/ }),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Export package" }));
		expect(await screen.findByText(/Collecting masters/)).toBeTruthy();
		expect(screen.getByRole("progressbar")).toBeTruthy();
	});
});
