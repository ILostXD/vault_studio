// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AudioMetadataState } from "@/api/audioMetadata";
import ProjectMetadataModal from "./ProjectMetadataModal";

const api = vi.hoisted(() => ({
	get: vi.fn(),
	save: vi.fn(),
	download: vi.fn(),
	album: vi.fn(),
	publish: vi.fn(),
	exportProject: vi.fn(),
	downloadTrack: vi.fn(),
}));
vi.mock("@/api/audioMetadata", () => ({
	getAudioMetadata: api.get,
	saveAudioMetadata: api.save,
	downloadTaggedTrack: api.download,
	downloadTaggedAlbum: api.album,
	publishAlbum: api.publish,
}));
vi.mock("@/api/tracks", () => ({
	updateTrack: vi.fn(),
	downloadTrack: api.downloadTrack,
}));
vi.mock("@/hooks/useProjects", () => ({
	projectKeys: { all: ["projects"] },
	useExportProject: () => ({
		mutateAsync: api.exportProject,
		isPending: false,
	}),
}));
vi.mock("./BaseModal", () => ({
	default: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

const metadata = {
	album: "Album",
	artist: "DiRO",
	album_artist: "",
	genre: "Rap",
	year: "2026",
};
const state: AudioMetadataState = {
	metadata,
	revision: "revision",
	library: { configured: true, current: false },
	artwork: true,
	available_formats: ["m4a", "mp3"],
	target_format: "m4a",
	has_lossless: false,
	tracks: [
		{
			...metadata,
			album_artist: "DiRO",
			track_id: 3,
			version_id: 13,
			version_name: "v13",
			title: "Canonical title",
			public_id: "track-3",
			artist_override: "",
			album_override: "",
			track_number: 1,
			artwork: true,
			source_format: "aac",
			format: "m4a",
			can_download: true,
			conversion: "AAC will be repackaged as M4A without re-encoding.",
		},
	],
};
beforeEach(() => {
	vi.clearAllMocks();
	api.get.mockResolvedValue(state);
	api.download.mockResolvedValue({ cancelled: false });
	api.album.mockResolvedValue({ cancelled: false });
	api.exportProject.mockResolvedValue({ cancelled: false });
	api.downloadTrack.mockResolvedValue({ cancelled: false });
});
afterEach(cleanup);
async function mount() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const view = render(
		<QueryClientProvider client={client}>
			<ProjectMetadataModal
				projectId={1}
				projectPublicId="proj-1"
				projectName="Album"
				coverUrl="/cover.png"
				onClose={vi.fn()}
			/>
		</QueryClientProvider>,
	);
	fireEvent.click(await screen.findByText("Album tags"));
	fireEvent.click(screen.getByText("Individual tracks & overrides"));
	return view;
}

it("previews the canonical title, version, artwork and non-lossy AAC remux", async () => {
	await mount();
	await screen.findByLabelText("Album");
	expect(screen.getByText("v13")).toBeTruthy();
	expect(screen.getByText("Project cover")).toBeTruthy();
	expect(screen.getByText("AAC → M4A")).toBeTruthy();
	expect(screen.getByText(/without re-encoding/)).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Download tagged copy" }));
	await waitFor(() =>
		expect(api.download).toHaveBeenCalledWith(
			1,
			state.tracks[0],
			expect.any(Function),
			"m4a",
		),
	);
	await screen.findByText("Tagged copy downloaded. Original unchanged.");
});

it("requires saving edits before export and uses the server's refreshed preview", async () => {
	await mount();
	fireEvent.change(await screen.findByLabelText("Artist"), {
		target: { value: "New artist" },
	});
	expect(
		(
			screen.getByRole("button", {
				name: "Download tagged copy",
			}) as HTMLButtonElement
		).disabled,
	).toBe(true);
	api.save.mockResolvedValue({
		...state,
		metadata: { ...metadata, artist: "New artist" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
	await screen.findByText("Project metadata saved.");
	expect(api.save).toHaveBeenCalledWith(
		1,
		{ ...metadata, artist: "New artist" },
		"m4a",
	);
	expect(
		(
			screen.getByRole("button", {
				name: "Download tagged copy",
			}) as HTMLButtonElement
		).disabled,
	).toBe(false);
});

it("shows real transfer progress and download errors without reporting success", async () => {
	let rejectDownload!: (reason: Error) => void;
	api.download.mockImplementation((_id, _track, progress) => {
		progress(25, 100);
		return new Promise((_resolve, reject) => {
			rejectDownload = reject;
		});
	});
	await mount();
	await screen.findByLabelText("Album");
	fireEvent.click(screen.getByRole("button", { name: "Download tagged copy" }));
	expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
		"25",
	);
	rejectDownload(new Error("Source unavailable"));
	await screen.findByRole("alert");
	expect(screen.getByText("Source unavailable")).toBeTruthy();
	expect(
		screen.queryByText("Tagged copy downloaded. Original unchanged."),
	).toBeNull();
});

it("does not offer a download when the active source is still processing", async () => {
	api.get.mockResolvedValue({
		...state,
		tracks: [
			{
				...state.tracks[0],
				can_download: false,
				reason: "Source is processing.",
			},
		],
	});
	await mount();
	await screen.findByLabelText("Album");
	expect(screen.getByText("Source is processing.")).toBeTruthy();
	expect(
		(
			screen.getByRole("button", {
				name: "Download tagged copy",
			}) as HTMLButtonElement
		).disabled,
	).toBe(true);
});

it("downloads the full album as the primary action", async () => {
	await mount();
	fireEvent.click(screen.getByRole("button", { name: "Download album" }));
	await waitFor(() =>
		expect(api.album).toHaveBeenCalledWith(
			1,
			state,
			expect.any(Function),
			"m4a",
		),
	);
	expect(api.download).not.toHaveBeenCalled();
	await screen.findByText("Album downloaded. Originals unchanged.");
});

it("publishes the previewed album and shows its saved library status", async () => {
	api.publish.mockResolvedValue({
		configured: true,
		current: true,
		folder: "Vault-1-1",
		published_at: "2026-09-17T12:00:00Z",
	});
	await mount();
	fireEvent.click(screen.getByRole("button", { name: "Add to music library" }));
	await waitFor(() =>
		expect(api.publish).toHaveBeenCalledWith(1, "revision", "m4a"),
	);
	await screen.findByText(/Music library is up to date/i);
});

it("keeps album downloads available without a configured library", async () => {
	api.get.mockResolvedValue({
		...state,
		library: { configured: false, current: false },
	});
	await mount();
	expect(
		(
			screen.getByRole("button", {
				name: "Add to music library",
			}) as HTMLButtonElement
		).disabled,
	).toBe(true);
	expect(
		(
			screen.getByRole("button", {
				name: "Download album",
			}) as HTMLButtonElement
		).disabled,
	).toBe(false);
});

it("supports switching to Raw Masters mode and downloading raw assets", async () => {
	await mount();
	fireEvent.click(screen.getByRole("button", { name: /Raw Masters/i }));
	expect(
		screen.getByRole("button", { name: "Download raw project (ZIP)" }),
	).toBeTruthy();
	fireEvent.click(
		screen.getByRole("button", { name: "Download raw project (ZIP)" }),
	);
	await waitFor(() =>
		expect(api.exportProject).toHaveBeenCalledWith({
			id: "proj-1",
			projectName: "Album",
		}),
	);
	fireEvent.click(screen.getByRole("button", { name: "Raw Master" }));
	await waitFor(() =>
		expect(api.downloadTrack).toHaveBeenCalledWith("track-3", 13),
	);
});

it("allows raw downloads even when tagging is unavailable and reports cancellation", async () => {
	api.get.mockResolvedValue({
		...state,
		tracks: [
			{ ...state.tracks[0], can_download: false, can_download_raw: true },
		],
	});
	api.downloadTrack.mockResolvedValue({ cancelled: true });
	await mount();
	fireEvent.click(screen.getByRole("button", { name: /Raw Masters/i }));
	const button = screen.getByRole("button", { name: "Raw Master" });
	expect((button as HTMLButtonElement).disabled).toBe(false);
	fireEvent.click(button);
	await screen.findByText("Download cancelled.");
});
