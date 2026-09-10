// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExportProvider } from "@/contexts/ExportContext";
import { useExportProject } from "@/hooks/useProjects";
import { ExportProgressIndicator } from "./ExportProgressIndicator";

const mocks = vi.hoisted(() => ({
  exportProject: vi.fn(),
  listeners: new Set<(message: { type: string; payload: unknown }) => void>(),
}));
vi.mock("@/api/projects", () => ({ exportProject: mocks.exportProject }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("@/contexts/AudioPlayerContext", () => ({ useAudioPlayer: () => ({ currentTrack: null, queue: [] }) }));
vi.mock("@/hooks/useWebSocket", () => ({
  onWSMessage: (fn: (message: { type: string; payload: unknown }) => void) => mocks.listeners.add(fn),
  offWSMessage: (fn: (message: { type: string; payload: unknown }) => void) => mocks.listeners.delete(fn),
}));

function Start() {
  const exportProject = useExportProject();
  return <button onClick={() => exportProject.mutate({ id: "p1", projectName: "Album" })}>Export</button>;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ExportProvider><Start /><ExportProgressIndicator /></ExportProvider></QueryClientProvider>);
}
afterEach(() => { cleanup(); mocks.listeners.clear(); vi.clearAllMocks(); });

it("shows only one themed bar, with measured preparation and download percentages", async () => {
  let finish!: (result: { cancelled: boolean }) => void;
  mocks.exportProject.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const { container } = mount();
  fireEvent.click(screen.getByText("Export"));
  await waitFor(() => expect(mocks.exportProject).toHaveBeenCalledOnce());
  const [, , id, downloadProgress] = mocks.exportProject.mock.calls[0];
  expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  act(() => {
    for (const listener of mocks.listeners) listener({ type: "project_export_progress", payload: { export_id: "other", loaded: 99, total: 100 } });
  });
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBeNull();
  act(() => {
    for (const listener of mocks.listeners) listener({ type: "project_export_progress", payload: { export_id: id, loaded: 25, total: 100, filename: "Track.wav" } });
  });
  expect(screen.getByText("25%")).toBeTruthy();
  act(() => downloadProgress(60, 100));
  expect(screen.getByText("60%")).toBeTruthy();
  expect(screen.getByText("Downloading ZIP")).toBeTruthy();
  expect(screen.queryByText("Download ready")).toBeNull();
  expect(container.querySelector('[class*="from-(--card-gradient-from)"]')).toBeTruthy();
  expect(container.querySelector('[class*="bg-zinc-900"]')).toBeNull();
  await act(async () => finish({ cancelled: false }));
  expect(screen.getByText("Download ready")).toBeTruthy();
  expect(screen.getByText("100%")).toBeTruthy();
  expect(mocks.listeners.size).toBe(0);
});

it("keeps a readable error instead of announcing a successful download", async () => {
  mocks.exportProject.mockRejectedValue(new Error("Master file unavailable"));
  mount();
  fireEvent.click(screen.getByText("Export"));
  await screen.findByText("Master file unavailable");
  expect(screen.getByRole("alert").textContent).toBe("Export failed");
  expect(screen.queryByText("Download ready")).toBeNull();
  expect(mocks.listeners.size).toBe(0);
});

it("does not announce success when the Android save dialog is cancelled", async () => {
  mocks.exportProject.mockResolvedValue({ cancelled: true });
  mount();
  fireEvent.click(screen.getByText("Export"));
  await waitFor(() => expect(mocks.exportProject).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByText("Album")).toBeNull());
  expect(screen.queryByText("Download ready")).toBeNull();
});
