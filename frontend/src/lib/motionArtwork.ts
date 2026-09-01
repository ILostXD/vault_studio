export type MotionAssetKind =
	| "apple_square"
	| "apple_portrait"
	| "spotify_canvas";

export type NowPlayingArtworkMode = MotionAssetKind | "still_cover";

export const NOW_PLAYING_ARTWORK_MODE_KEY = "vault.nowPlayingArtworkMode";

const ARTWORK_MODE_FALLBACKS: Record<
	NowPlayingArtworkMode,
	NowPlayingArtworkMode[]
> = {
	apple_portrait: [
		"apple_portrait",
		"spotify_canvas",
		"apple_square",
		"still_cover",
	],
	spotify_canvas: [
		"spotify_canvas",
		"apple_portrait",
		"apple_square",
		"still_cover",
	],
	apple_square: [
		"apple_square",
		"apple_portrait",
		"spotify_canvas",
		"still_cover",
	],
	still_cover: ["still_cover"],
};

export function isNowPlayingArtworkMode(
	value: string | null,
): value is NowPlayingArtworkMode {
	return value !== null && value in ARTWORK_MODE_FALLBACKS;
}

export function resolveNowPlayingArtworkMode(
	preferred: NowPlayingArtworkMode,
	availableKinds: MotionAssetKind[],
): NowPlayingArtworkMode {
	return (
		ARTWORK_MODE_FALLBACKS[preferred].find(
			(mode) => mode === "still_cover" || availableKinds.includes(mode),
		) ?? "still_cover"
	);
}

export interface ProjectMotionAsset {
	kind: MotionAssetKind;
	width: number;
	height: number;
	duration_seconds: number;
	codec: string;
	frame_rate: number;
	bitrate: number;
	has_audio: boolean;
	source_mime: string;
	updated_at: string;
	preview_url?: string;
}

export interface MotionArtworkCheck {
	label: string;
	detail: string;
	passed: boolean;
}

export const MOTION_ARTWORK_FORMATS: Array<{
	kind: MotionAssetKind;
	shortLabel: string;
	title: string;
	subtitle: string;
	aspectRatio: string;
}> = [
	{
		kind: "apple_square",
		shortLabel: "Apple 1:1",
		title: "Apple Music 1:1",
		subtitle: "Mac, iPad and smart TVs",
		aspectRatio: "1 / 1",
	},
	{
		kind: "apple_portrait",
		shortLabel: "Apple 3:4",
		title: "Apple Music 3:4",
		subtitle: "iPhone and Android album page",
		aspectRatio: "3 / 4",
	},
	{
		kind: "spotify_canvas",
		shortLabel: "Canvas 9:16",
		title: "Spotify Canvas",
		subtitle: "Mobile Now Playing view",
		aspectRatio: "9 / 16",
	},
];

const APPLE_FRAME_RATES = [23.976, 24, 25, 29.97, 30];

export function getMotionArtworkChecks(
	asset: ProjectMotionAsset,
): MotionArtworkCheck[] {
	if (asset.kind === "spotify_canvas") {
		const ratio = asset.width / asset.height;
		return [
			{
				label: "9:16 frame",
				detail: `${asset.width} x ${asset.height}`,
				passed: Math.abs(ratio - 9 / 16) < 0.01,
			},
			{
				label: "3-8 seconds",
				detail: `${asset.duration_seconds.toFixed(1)}s`,
				passed: asset.duration_seconds >= 3 && asset.duration_seconds <= 8.05,
			},
			{
				label: "MP4 source",
				detail: asset.codec.toUpperCase(),
				passed: asset.source_mime === "video/mp4",
			},
		];
	}

	const square = asset.kind === "apple_square";
	const targetWidth = square ? 3840 : 2048;
	const targetHeight = square ? 3840 : 2732;
	const codec = asset.codec.toLowerCase();
	return [
		{
			label: `${targetWidth} x ${targetHeight}`,
			detail: `${asset.width} x ${asset.height}`,
			passed: asset.width === targetWidth && asset.height === targetHeight,
		},
		{
			label: "8-35 seconds",
			detail: `${asset.duration_seconds.toFixed(1)}s`,
			passed: asset.duration_seconds >= 8 && asset.duration_seconds <= 35.05,
		},
		{
			label: "H.264 or ProRes",
			detail: asset.codec.toUpperCase(),
			passed: codec === "h264" || codec.startsWith("prores"),
		},
		{
			label: "No audio track",
			detail: asset.has_audio ? "Audio detected" : "Silent",
			passed: !asset.has_audio,
		},
		{
			label: "45-100 Mbps",
			detail: `${(asset.bitrate / 1_000_000).toFixed(1)} Mbps`,
			passed: asset.bitrate >= 45_000_000 && asset.bitrate <= 100_000_000,
		},
		{
			label: "Supported frame rate",
			detail: `${asset.frame_rate.toFixed(3)} fps`,
			passed: APPLE_FRAME_RATES.some(
				(frameRate) => Math.abs(frameRate - asset.frame_rate) < 0.02,
			),
		},
	];
}

export function isMotionArtworkCompliant(asset: ProjectMotionAsset) {
	return getMotionArtworkChecks(asset).every((check) => check.passed);
}
