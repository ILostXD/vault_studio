// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ProjectMetadataModal from "./ProjectMetadataModal";
import type { AudioMetadataState } from "@/api/audioMetadata";

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), download: vi.fn() }));
vi.mock("@/api/audioMetadata", () => ({ getAudioMetadata: api.get, saveAudioMetadata: api.save, downloadTaggedTrack: api.download }));
vi.mock("@/hooks/useProjects", () => ({ projectKeys: { all: ["projects"] } }));
vi.mock("./BaseModal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const metadata = { album: "Album", artist: "DiRO", album_artist: "", genre: "Rap", year: "2026" };
const state: AudioMetadataState = { metadata, artwork: true, tracks: [{
  ...metadata, album_artist: "DiRO", track_id: 3, version_id: 13, version_name: "v13", title: "Canonical title",
  public_id: "track-3", artist_override: "", album_override: "",
  track_number: 1, artwork: true, source_format: "aac", format: "m4a", can_download: true,
  conversion: "AAC will be repackaged as M4A without re-encoding.",
}] };
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(state); api.download.mockResolvedValue({ cancelled: false }); });
afterEach(cleanup);
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProjectMetadataModal projectId={1} coverUrl="/cover.png" onClose={vi.fn()} /></QueryClientProvider>);
}

it("previews the canonical title, version, artwork and non-lossy AAC remux", async () => {
  mount();
  await screen.findByLabelText("Album");
  expect(screen.getByText("v13")).toBeTruthy();
  expect(screen.getByText("Project cover")).toBeTruthy();
  expect(screen.getByText("AAC → M4A")).toBeTruthy();
  expect(screen.getByText(/without re-encoding/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Download tagged copy" }));
  await waitFor(() => expect(api.download).toHaveBeenCalledWith(1, state.tracks[0], expect.any(Function)));
  await screen.findByText("Tagged copy downloaded. Original unchanged.");
});

it("requires saving edits before export and uses the server's refreshed preview", async () => {
  mount();
  fireEvent.change(await screen.findByLabelText("Artist"), { target: { value: "New artist" } });
  expect((screen.getByRole("button", { name: "Download tagged copy" }) as HTMLButtonElement).disabled).toBe(true);
  api.save.mockResolvedValue({ ...state, metadata: { ...metadata, artist: "New artist" } });
  fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
  await screen.findByText("Project metadata saved.");
  expect(api.save).toHaveBeenCalledWith(1, { ...metadata, artist: "New artist" });
  expect((screen.getByRole("button", { name: "Download tagged copy" }) as HTMLButtonElement).disabled).toBe(false);
});

it("shows real transfer progress and download errors without reporting success", async () => {
  let rejectDownload!: (reason: Error) => void;
  api.download.mockImplementation((_id, _track, progress) => {
    progress(25, 100);
    return new Promise((_resolve, reject) => { rejectDownload = reject; });
  });
  mount(); await screen.findByLabelText("Album");
  fireEvent.click(screen.getByRole("button", { name: "Download tagged copy" }));
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
  rejectDownload(new Error("Source unavailable"));
  await screen.findByRole("alert");
  expect(screen.getByText("Source unavailable")).toBeTruthy();
  expect(screen.queryByText("Tagged copy downloaded. Original unchanged.")).toBeNull();
});

it("does not offer a download when the active source is still processing", async () => {
  api.get.mockResolvedValue({ ...state, tracks: [{ ...state.tracks[0], can_download: false, reason: "Source is processing." }] });
  mount(); await screen.findByLabelText("Album");
  expect(screen.getByText("Source is processing.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Download tagged copy" }) as HTMLButtonElement).disabled).toBe(true);
});
