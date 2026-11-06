// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MobileArtworkBackdrop from "./MobileArtworkBackdrop";

vi.mock("motion/react", () => ({ useReducedMotion: () => false }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("draws immediately, freezes on pause, resumes and releases its animation", () => {
  const drawImage = vi.fn();
  const context = {
    drawImage, fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), createRadialGradient: () => ({ addColorStop: vi.fn() }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  let loaded: (() => void) | null = null;
  vi.stubGlobal("Image", class {
    naturalWidth = 600;
    naturalHeight = 600;
    complete = false;
    set onload(callback: (() => void) | null) { loaded = callback; }
    set src(_value: string) {}
  });
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = disconnect; });
  let tick: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { tick = callback; return 1; }));
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const { rerender, unmount, container } = render(<MobileArtworkBackdrop coverUrl="/cover.jpg" isPlaying />);
  (loaded as unknown as () => void)();
  expect(drawImage).toHaveBeenCalled();
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
  expect(container.querySelector("canvas")!.width).toBe(160);
  drawImage.mockClear();
  tick(100);
  expect(drawImage).toHaveBeenCalled();
  rerender(<MobileArtworkBackdrop coverUrl="/cover.jpg" isPlaying={false} />);
  drawImage.mockClear();
  tick(200);
  expect(drawImage).not.toHaveBeenCalled();
  rerender(<MobileArtworkBackdrop coverUrl="/cover.jpg" isPlaying />);
  tick(300);
  expect(drawImage).toHaveBeenCalled();
  unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledWith(1);
});
