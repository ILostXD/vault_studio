// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TrackDetailsModal from "./TrackDetailsModal";

vi.mock("@/hooks/usePreferredKey", () => ({ usePreferredKey: (key: string) => key }));
vi.mock("@/hooks/useProjects", () => ({ usePrefetchProjects: () => vi.fn() }));
vi.mock("@/hooks/useSharing", () => ({ usePrefetchSharingData: () => vi.fn() }));
vi.mock("@/hooks/useTracks", () => ({ trackKeys: { detail: (id: string) => [id] } }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/contexts/AudioPlayerContext", () => ({ useAudioPlayer: () => ({ addToQueue: vi.fn(), stop: vi.fn() }) }));
vi.mock("@/routes/__root", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("./TrackVersionsModal", () => ({ default: () => null }));
vi.mock("./DeleteTrackModal", () => ({ default: () => null }));
vi.mock("./MoveTrackModal", () => ({ default: () => null }));
vi.mock("./ShareModal", () => ({ default: () => null }));
vi.mock("@/components/ScrollingText", () => ({ default: ({ text }: { text: string }) => text }));

const track = { title: "Test track", duration: "3:00" };

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("TrackDetailsModal closing", () => {
  it("notifies the owner immediately, then completes its exit and releases scrolling", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<TrackDetailsModal isOpen onClose={onClose} trackId="track-1" track={track} />);
    fireEvent.click(screen.getByRole("button", { name: "Close track details" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<TrackDetailsModal isOpen={false} onClose={onClose} trackId="track-1" track={track} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Close track details" })).toBeNull());
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<TrackDetailsModal isOpen onClose={onClose} trackId="track-1" track={track} />);
    expect(screen.getByRole("button", { name: "Close track details" })).toBeTruthy();
  });

  it("uses the latest close callback without requiring a different track", () => {
    const oldClose = vi.fn();
    const newClose = vi.fn();
    const { rerender } = render(<TrackDetailsModal isOpen onClose={oldClose} trackId="track-1" track={track} />);
    rerender(<TrackDetailsModal isOpen onClose={newClose} trackId="track-1" track={track} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(newClose).toHaveBeenCalledTimes(1);
    expect(oldClose).not.toHaveBeenCalled();
  });
});
