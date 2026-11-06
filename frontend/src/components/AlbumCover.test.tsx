// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AlbumCover from "./AlbumCover";

vi.mock("@/hooks/useColorExtractor", () => {
	const colors: string[] = [];
	return { useColorExtractor: () => colors };
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("plays album artwork independently of audio and pauses on unmount", () => {
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	);
	const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
	const pause = vi
		.spyOn(HTMLMediaElement.prototype, "pause")
		.mockImplementation(() => {});
	const { rerender, unmount } = render(
		<AlbumCover title="Album" motionUrl="/cover.mp4" isPlaying={false} />,
	);
	expect(play).toHaveBeenCalledOnce();
	rerender(<AlbumCover title="Album" motionUrl="/cover.mp4" isPlaying />);
	rerender(
		<AlbumCover title="Album" motionUrl="/cover.mp4" isPlaying={false} />,
	);
	expect(pause).not.toHaveBeenCalled();
	unmount();
	expect(pause).toHaveBeenCalledOnce();
});
