// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MotionArtworkModal from "./MotionArtworkModal";

vi.mock("@/api/projects", () => ({ deleteProjectMotionAsset: vi.fn(), uploadProjectMotionAsset: vi.fn() }));
vi.mock("@/routes/__root", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useProjectMotionAssets", () => ({
  projectMotionAssetKeys: { detail: (id: string) => ["motion-artwork", id] },
  useProjectMotionAssets: () => ({ data: [
    { kind: "apple_portrait", preview_url: "/portrait.mp4", width: 2048, height: 2732, duration_seconds: 8, codec: "h264", source_mime: "video/mp4", frame_rate: 30, bitrate: 50000000 },
    { kind: "spotify_canvas", preview_url: "/canvas.mp4", width: 1080, height: 1920, duration_seconds: 8, codec: "h264", source_mime: "video/mp4", frame_rate: 30, bitrate: 50000000 },
  ] }),
}));
vi.mock("./BaseModal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(["Apple 3:4", "Canvas 9:16"])("actually pauses and resumes the %s artwork preview", (format) => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MotionArtworkModal isOpen onClose={() => {}} projectId="p1" projectName="Album" artistName="Artist" trackTitle="Song" coverUrl="/cover.jpg" canEdit={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByText(format));
  play.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  expect(play).toHaveBeenCalled();
});
