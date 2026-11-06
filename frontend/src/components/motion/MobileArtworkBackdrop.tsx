import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

// Rasterize the blur at a bounded size instead of filtering moving WebView layers.
export default function MobileArtworkBackdrop({
	coverUrl,
	isPlaying,
}: {
	coverUrl: string;
	isPlaying: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const playingRef = useRef(isPlaying);
	const reduceMotion = useReducedMotion();
	playingRef.current = isPlaying && !reduceMotion;

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		let disposed = false;
		let frame = 0;
		let previous = 0;
		let elapsed = 0;
		const source = new Image();
		const texture = document.createElement("canvas");
		texture.width = texture.height = 128;
		const textureContext = texture.getContext("2d");
		if (!textureContext) return;
		const patch = document.createElement("canvas");
		patch.width = patch.height = 128;
		const patchContext = patch.getContext("2d");
		if (!patchContext) return;

		const paint = () => {
			const w = canvas.width;
			const h = canvas.height;
			context.fillStyle = "#000";
			context.fillRect(0, 0, w, h);
			context.globalAlpha = 0.6;
			context.drawImage(texture, 0, 0, w, h);
			// Opposing orbits and drifting patches retain the artwork's moving colors.
			for (let i = 0; i < 6; i++) {
				const angle =
					(elapsed / (i % 2 ? -18000 : 14000)) * Math.PI * 2 +
					(i * Math.PI) / 3;
				const size =
					Math.max(w, h) * (0.65 + Math.sin(elapsed / 11000 + i) * 0.08);
				context.save();
				context.globalAlpha = i < 2 ? 0.85 : 0.65;
				context.globalCompositeOperation =
					i === 2 || i === 4 ? "screen" : "source-over";
				context.translate(
					w / 2 + Math.cos(angle) * w * 0.3,
					h / 2 + Math.sin(angle) * h * 0.3,
				);
				context.rotate(angle * (i % 2 ? -1 : 1));
				context.drawImage(patch, -size / 2, -size / 2, size, size);
				context.restore();
			}
			context.globalAlpha = 1;
		};

		const tick = (now: number) => {
			if (disposed) return;
			const delta = now - previous;
			if (delta >= 1000 / 24) {
				previous = now;
				if (playingRef.current && !document.hidden) {
					elapsed += Math.min(delta, 100);
					paint();
				}
			}
			frame = requestAnimationFrame(tick);
		};

		const resize = () => {
			const bounds = canvas.getBoundingClientRect();
			canvas.width = 160;
			canvas.height = Math.max(
				1,
				Math.min(
					360,
					Math.round((160 * bounds.height) / Math.max(1, bounds.width)),
				),
			);
			if (source.complete && source.naturalWidth) paint();
		};
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		resize();
		source.onload = () => {
			if (disposed) return;
			// Blur once, including bleed at the edges; subsequent frames only draw bitmaps.
			const side = Math.min(source.naturalWidth, source.naturalHeight);
			textureContext.filter =
				"blur(12px) saturate(1.8) contrast(1.12) brightness(0.95)";
			textureContext.drawImage(
				source,
				(source.naturalWidth - side) / 2,
				(source.naturalHeight - side) / 2,
				side,
				side,
				-24,
				-24,
				176,
				176,
			);
			patchContext.drawImage(texture, 0, 0);
			patchContext.globalCompositeOperation = "destination-in";
			const feather = patchContext.createRadialGradient(64, 64, 12, 64, 64, 64);
			feather.addColorStop(0, "#000");
			feather.addColorStop(1, "transparent");
			patchContext.fillStyle = feather;
			patchContext.fillRect(0, 0, 128, 128);
			paint();
			frame = requestAnimationFrame(tick);
		};
		source.src = coverUrl;
		return () => {
			disposed = true;
			source.onload = null;
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [coverUrl]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			className="absolute inset-0 size-full"
		/>
	);
}
