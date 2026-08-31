import { describe, expect, it } from "vitest";
import {
	getMotionArtworkChecks,
	isMotionArtworkCompliant,
	type ProjectMotionAsset,
} from "./motionArtwork";

const appleSquare: ProjectMotionAsset = {
	kind: "apple_square",
	width: 3840,
	height: 3840,
	duration_seconds: 12,
	codec: "h264",
	frame_rate: 29.97,
	bitrate: 50_000_000,
	has_audio: false,
	source_mime: "video/mp4",
	updated_at: "2026-08-31T00:00:00Z",
};

describe("motion artwork compliance", () => {
	it("accepts a delivery-ready Apple square asset", () => {
		expect(isMotionArtworkCompliant(appleSquare)).toBe(true);
	});

	it("reports Spotify aspect and duration problems independently", () => {
		const checks = getMotionArtworkChecks({
			...appleSquare,
			kind: "spotify_canvas",
			width: 1000,
			height: 1000,
			duration_seconds: 9,
		});
		expect(checks.map((check) => check.passed)).toEqual([false, false, true]);
	});
});
