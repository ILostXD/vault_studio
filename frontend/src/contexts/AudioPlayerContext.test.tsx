// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioPlayerProvider, useAudioPlayer } from "./AudioPlayerContext";
import { usePlaybackProgress } from "./PlaybackProgressContext";

vi.mock("./AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("./PreferencesContext", () => ({ usePreferences: () => ({ preferences: {} }) }));

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("updates the playback timeline without re-rendering player controls or queue consumers", () => {
  const controlsRendered = vi.fn();
  let player!: ReturnType<typeof useAudioPlayer>;
  function Controls() {
    player = useAudioPlayer();
    controlsRendered();
    return <span>{player.queue.length} queued</span>;
  }
  function Timeline() {
    return <output>{usePlaybackProgress()}</output>;
  }
  render(<AudioPlayerProvider><Controls /><Timeline /></AudioPlayerProvider>);
  const initialRenders = controlsRendered.mock.calls.length;
  for (let frame = 1; frame <= 60; frame++) {
    act(() => player.onProgressUpdate(frame / 30));
  }
  expect(screen.getByRole("status").textContent).toBe("2");
  expect(controlsRendered).toHaveBeenCalledTimes(initialRenders);
  act(() => player.stop());
  expect(screen.getByRole("status").textContent).toBe("0");
});
