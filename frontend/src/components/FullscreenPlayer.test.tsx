// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FullscreenPlayer from "./FullscreenPlayer";

const state = {
  isNowPlayingOpen: true,
  currentTrack: { id: "track-a", title: "Playing track", projectId: "album-a", projectName: "Playing album", coverUrl: "/cover-a.jpg" },
};
const loadProject = vi.fn((_id?: string) => ({ data: undefined }));

vi.mock("@/contexts/AudioPlayerContext", () => ({ useAudioPlayer: () => state }));
vi.mock("@/hooks/useProjects", () => ({ useProject: (id?: string) => loadProject(id) }));
vi.mock("@/hooks/useTracks", () => ({ useTracks: () => ({ data: [] }) }));
vi.mock("@/hooks/useProjectCoverImage", () => ({ useProjectCoverImage: () => ({ imageUrl: null }) }));
vi.mock("motion/react", () => ({ AnimatePresence: ({ children }: any) => children }));
vi.mock("./NowPlayingView", () => ({ default: ({ projectId, projectName, variant, coverUrl }: any) => (
  <div role="dialog" data-project={projectId} data-variant={variant} data-cover={coverUrl}>{projectName}</div>
) }));

beforeEach(() => {
  state.isNowPlayingOpen = true;
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});
afterEach(cleanup);

it.each(["/", "/project/album-b", "/profile"])("opens the playing album independently of the route at %s", async (path) => {
  window.history.replaceState({}, "", path);
  const view = render(<FullscreenPlayer />);
  expect((await screen.findByText("Playing album")).getAttribute("data-project")).toBe("album-a");
  expect(screen.getByRole("dialog").getAttribute("data-cover")).toBe("/cover-a.jpg");
  expect(loadProject).toHaveBeenCalledWith("album-a");
  state.isNowPlayingOpen = false;
  view.rerender(<FullscreenPlayer />);
  expect(screen.queryByRole("dialog")).toBeNull();
  state.isNowPlayingOpen = true;
  view.rerender(<FullscreenPlayer />);
  expect(screen.getByRole("dialog").textContent).toBe("Playing album");
});

it("selects the mobile fullscreen layout on phones", async () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any);
  render(<FullscreenPlayer />);
  expect((await screen.findByText("Playing album")).getAttribute("data-variant")).toBe("mobile");
});
