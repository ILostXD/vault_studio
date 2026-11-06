// @vitest-environment jsdom

import { act, cleanup, render, waitForElementToBeRemoved } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackProgressContext, createPlaybackProgressStore } from "@/contexts/PlaybackProgressContext";
import MusicPlayer from "./MusicPlayer";

const player = {
  currentTrack: { id: "track-1", title: "Test track", projectName: "Test album", waveform: "[10,20,30]" },
  audioUrl: "http://localhost/audio.wav",
  isPlaying: true,
  isNowPlayingOpen: false,
  queue: [],
  audioPlayerRef: { current: null as any },
  onPlayingChange: vi.fn(), onDurationChange: vi.fn(), onProgressUpdate: vi.fn(), onEnded: vi.fn(),
  getPreloadedAudio: vi.fn(), clearPreloadedAudio: vi.fn(),
};

vi.mock("@/contexts/AudioPlayerContext", () => ({ useAudioPlayer: () => player }));
vi.mock("@/contexts/PreferencesContext", () => ({ usePreferences: () => ({ preferences: { comments_enabled: false } }) }));
vi.mock("@/hooks/useProjectCoverImage", () => ({ useProjectCoverImage: () => ({ imageUrl: null }) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), useRouterState: () => ({ location: { pathname: "/" } }) }));
vi.mock("./QueuePanel", () => ({ default: () => null }));
vi.mock("./WaveformComments", () => ({ default: () => null }));
vi.mock("./ScrollingText", () => ({ default: () => null }));
vi.mock("virtual:refractionFilter?width=20&height=32&radius=10&bezelWidth=12&glassThickness=50&refractiveIndex=1.48&bezelType=convex_squircle", () => ({ Filter: () => null }));

beforeEach(() => {
  player.isNowPlayingOpen = false;
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("MusicPlayer fullscreen handoff", () => {
  it("keeps the fullscreen arrow centered and the thumbnail borderless", () => {
    const store = createPlaybackProgressStore();
    const { container } = render(<PlaybackProgressContext.Provider value={store}><MusicPlayer /></PlaybackProgressContext.Provider>);
    const button = container.querySelector('button[aria-label="Open Now Playing"]')!;
    const overlay = button.querySelector("span")!;
    expect(button.className).toContain("border-0");
    expect(button.className).toContain("bg-(--bg-2)");
    expect(overlay.className).toContain("items-center justify-center");
    expect(overlay.querySelector("svg")?.getAttribute("class")).not.toContain("translate");
  });
  it("lets skip icons inherit theme-aware hover colors from their buttons", () => {
    const store = createPlaybackProgressStore();
    const { container } = render(<PlaybackProgressContext.Provider value={store}><MusicPlayer /></PlaybackProgressContext.Provider>);
    for (const label of ["Previous track", "Next track"]) {
      const button = container.querySelector(`button[aria-label="${label}"]`)!;
      expect(button.className).toContain("player-icon-control");
      expect(button.className).toContain("hover:text-(--text-1)");
      expect(button.querySelector("svg")?.getAttribute("class")).not.toContain("text-(--text-0)");
    }
    expect(container.querySelector('[class*="hover:text-gray-300"]')).toBeNull();
  });
  it("unsubscribes the hidden controls without replacing, reloading, or pausing the audio", () => {
    const store = createPlaybackProgressStore();
    const subscribers = new Set<() => void>();
    const subscribe = store.subscribe;
    store.subscribe = (listener) => {
      subscribers.add(listener);
      const unsubscribe = subscribe(listener);
      return () => { subscribers.delete(listener); unsubscribe(); };
    };
    const view = () => <PlaybackProgressContext.Provider value={store}><MusicPlayer /></PlaybackProgressContext.Provider>;
    const { container, rerender } = render(view());
    const audio = container.querySelector("audio")!;
    const loadCalls = vi.mocked(audio.load).mock.calls.length;
    const playCalls = vi.mocked(audio.play).mock.calls.length;
    audio.currentTime = 12;
    expect(subscribers.size).toBe(2);

    for (let i = 0; i < 3; i++) {
      player.isNowPlayingOpen = true;
      rerender(view());
      expect(subscribers.size).toBe(0);
      expect(container.querySelector(".mini-player")).toBeNull();
      expect(container.querySelector("audio")).toBe(audio);
      expect(audio.currentTime).toBe(12);
      act(() => store.setProgress(15 + i));

      player.isNowPlayingOpen = false;
      rerender(view());
      expect(subscribers.size).toBe(2);
      expect(container.querySelector("audio")).toBe(audio);
    }
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.load).toHaveBeenCalledTimes(loadCalls);
    expect(audio.play).toHaveBeenCalledTimes(playCalls);
  });

  it("keeps the popover above Add and open on outside clicks until Escape", async () => {
    const store = createPlaybackProgressStore();
    const { container } = render(
      <PlaybackProgressContext.Provider value={store}>
        <MusicPlayer />
      </PlaybackProgressContext.Provider>
    );

    // Initially no popover
    expect(container.querySelector("[data-testid='miniplayer-popover']")).toBeNull();

    // Click queue button
    const queueBtn = container.querySelector("button[aria-label='Queue']");
    expect(queueBtn).not.toBeNull();
    act(() => {
      queueBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Popover is displayed
    const popover = container.querySelector("[data-testid='miniplayer-popover']")!;
    expect(popover).not.toBeNull();
    expect(popover.className).toContain("h-[min(500px,calc(100dvh-180px))]");
    expect(popover.firstElementChild?.className).toContain("min-h-0");
    expect(container.querySelector(".mini-player")?.className).toContain("z-130");

    const menu = document.createElement("div");
    menu.setAttribute("data-queue-menu", "true");
    document.body.append(menu);
    act(() => menu.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    expect(container.querySelector("[data-testid='miniplayer-popover']")).not.toBeNull();
    menu.remove();

    // Click outside popover
    act(() => {
      document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });

    expect(container.querySelector("[data-testid='miniplayer-popover']")).not.toBeNull();
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await waitForElementToBeRemoved(() =>
      container.querySelector("[data-testid='miniplayer-popover']"),
    );
  });
});
