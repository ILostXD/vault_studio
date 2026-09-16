// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MotionArtworkStage, { MotionArtworkFlowBackground } from "./MotionArtworkStage";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("MotionArtworkFlowBackground", () => {
	it("limits the cover flow to the requested layers without decoding video", () => {
		const { container } = render(
			<MotionArtworkFlowBackground coverUrl="/cover.jpg" maxLayers={2} />,
		);

		expect(container.querySelector("video")).toBeNull();
		expect(container.querySelectorAll("img")).toHaveLength(2);
	});

	it("starts decorative video silently only when active and pauses it on exit", () => {
		const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLVideoElement) {
			expect(this.muted).toBe(true);
			expect(this.defaultMuted).toBe(true);
			expect(this.volume).toBe(0);
			return Promise.resolve();
		});
		const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
		const { container, rerender, unmount } = render(
			<MotionArtworkStage presentation="fill" assetUrl="/motion.mp4" coverUrl="/cover.jpg" active={false} />,
		);
		const video = container.querySelector("video")!;
		expect(video.autoplay).toBe(false);
		expect(video.preload).toBe("none");
		expect(play).not.toHaveBeenCalled();
		rerender(<MotionArtworkStage presentation="fill" assetUrl="/motion.mp4" coverUrl="/cover.jpg" active />);
		expect(play).toHaveBeenCalledTimes(1);
		// Updating the poster must not restart a playing video.
		rerender(<MotionArtworkStage presentation="fill" assetUrl="/motion.mp4" coverUrl="/new-cover.jpg" active />);
		expect(play).toHaveBeenCalledTimes(1);
		expect(container.querySelector("video")).toBe(video);
		pause.mockClear();
		rerender(<MotionArtworkStage presentation="fill" assetUrl="/motion.mp4" active={false} />);
		expect(pause).toHaveBeenCalled();
		pause.mockClear();
		unmount();
		expect(pause).toHaveBeenCalled();
	});
});
