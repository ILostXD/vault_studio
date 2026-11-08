import { useEffect } from "react";
import { resolveApiMediaUrl } from "@/api/media";
import { getCoverAccent } from "@/api/preferences";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePreferences } from "@/contexts/PreferencesContext";

function toHex(r: number, g: number, b: number) {
	return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

// Most vivid color in the image: pixels weighted by saturation, bucketed by hue.
async function dominantColor(url: string): Promise<string | null> {
	const img = new Image();
	img.crossOrigin = "anonymous";
	img.src = url;
	try {
		await img.decode();
		const size = 32;
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;
		ctx.drawImage(img, 0, 0, size, size);
		const { data } = ctx.getImageData(0, 0, size, size);
		const buckets = Array.from({ length: 12 }, () => ({
			w: 0,
			r: 0,
			g: 0,
			b: 0,
		}));
		for (let i = 0; i < data.length; i += 4) {
			const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			if (max < 60 || max === min) continue;
			const sat = (max - min) / max;
			let h = 0;
			if (max === r) h = ((g - b) / (max - min) + 6) % 6;
			else if (max === g) h = (b - r) / (max - min) + 2;
			else h = (r - g) / (max - min) + 4;
			const bucket = buckets[Math.floor((h / 6) * 12) % 12];
			const w = sat * sat * (max / 255);
			bucket.w += w;
			bucket.r += r * w;
			bucket.g += g * w;
			bucket.b += b * w;
		}
		const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
		if (best.w === 0) return null;
		let [r, g, b] = [best.r / best.w, best.g / best.w, best.b / best.w];
		// Keep it bright enough to read on dark backgrounds.
		const max = Math.max(r, g, b);
		if (max < 200) {
			const k = 200 / max;
			[r, g, b] = [
				Math.min(255, r * k),
				Math.min(255, g * k),
				Math.min(255, b * k),
			];
		}
		return toHex(r, g, b);
	} catch {
		return null; // tainted canvas or decode failure: keep the chosen accent
	}
}

export default function DynamicAccent() {
	const { accentColor, preferences } = usePreferences();
	const enabled = preferences?.dynamic_accent === true;
	const { currentTrack } = useAudioPlayer();
	const projectId = currentTrack?.projectId;
	const cover = currentTrack?.projectCoverUrl ?? currentTrack?.coverUrl;

	useEffect(() => {
		const root = document.documentElement.style;
		const url = enabled ? resolveApiMediaUrl(cover) : undefined;
		if (!url) {
			root.setProperty("--accent-color", accentColor);
			return;
		}
		let cancelled = false;
		// Server colour first so every device matches; local extraction only as a fallback (e.g. shared projects).
		const server = projectId
			? getCoverAccent(projectId).catch(() => null)
			: Promise.resolve(null);
		server
			.then((color) => color ?? dominantColor(url))
			.then((color) => {
				if (!cancelled)
					root.setProperty("--accent-color", color ?? accentColor);
			});
		return () => {
			cancelled = true;
		};
	}, [enabled, cover, projectId, accentColor]);

	return null;
}
