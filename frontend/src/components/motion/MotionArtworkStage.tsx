import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type MotionArtworkPresentation = "fill" | "apple-portrait" | "square";

interface MotionArtworkStageProps {
	presentation: MotionArtworkPresentation;
	assetUrl?: string | null;
	coverUrl?: string | null;
	className?: string;
	active?: boolean;
}

interface MotionArtworkFlowBackgroundProps {
	assetUrl?: string | null;
	coverUrl?: string | null;
	className?: string;
	maxLayers?: number;
	paused?: boolean;
}

interface ArtworkSourceProps {
	assetUrl?: string | null;
	coverUrl?: string | null;
	className: string;
	active?: boolean;
}

function ArtworkSource({ assetUrl, coverUrl, className, active = true }: ArtworkSourceProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		// Decorative media must be silent before playback starts in WebView.
		video.defaultMuted = true;
		video.muted = true;
		video.volume = 0;
		if (active && !reduceMotion) void video.play().catch(() => undefined);
		else video.pause();
		return () => video.pause();
	}, [assetUrl, active, reduceMotion]);

	return (
		<>
			{coverUrl && <img src={coverUrl} alt="" className={className} />}
			{assetUrl && (
				<video
					ref={videoRef}
					key={assetUrl}
					src={assetUrl}
					poster={coverUrl ?? undefined}
					preload="none"
					muted
					loop
					playsInline
					disablePictureInPicture
					className={cn(className, "motion-reduce:hidden")}
				/>
			)}
		</>
	);
}

const FLOW_LAYERS = [
	{
		size: "size-[150vmax]",
		opacity: "opacity-80",
		duration: 14,
		rotate: [-9, 351],
		x: ["-6%", "3%", "7%", "-2%", "-6%"],
		y: ["-3%", "-7%", "2%", "6%", "-3%"],
		scale: [1.02, 1.08, 1.04, 1.1, 1.02],
	},
	{
		size: "size-[92vmax]",
		opacity: "opacity-55 mix-blend-screen",
		duration: 12,
		rotate: [12, -348],
		x: ["10%", "-3%", "-12%", "4%", "10%"],
		y: ["-9%", "8%", "3%", "-11%", "-9%"],
		scale: [0.96, 1.09, 1.02, 0.92, 0.96],
	},
	{
		size: "size-[62vmax]",
		opacity: "opacity-45 mix-blend-soft-light",
		duration: 10,
		rotate: [-18, 342],
		x: ["-19%", "13%", "18%", "-12%", "-19%"],
		y: ["13%", "18%", "-14%", "-18%", "13%"],
		scale: [1.08, 0.93, 1.12, 0.98, 1.08],
	},
	{
		size: "size-[38vmax]",
		opacity: "opacity-40 mix-blend-screen",
		duration: 8,
		rotate: [20, -340],
		x: ["23%", "-18%", "-25%", "16%", "23%"],
		y: ["19%", "-23%", "-12%", "24%", "19%"],
		scale: [0.9, 1.14, 0.96, 1.08, 0.9],
	},
];

const FLOW_STYLE_ID = "vault-desktop-flow-styles";

function ensureFlowKeyframesInjected() {
	if (typeof document === "undefined") return;
	if (document.getElementById(FLOW_STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = FLOW_STYLE_ID;
	style.textContent = `
@keyframes vault-flow-layer-0 {
  0%   { transform: rotate(-9deg) translate(-6%, -3%) scale(1.02); }
  25%  { transform: rotate(81deg) translate(3%, -7%) scale(1.08); }
  50%  { transform: rotate(171deg) translate(7%, 2%) scale(1.04); }
  75%  { transform: rotate(261deg) translate(-2%, 6%) scale(1.1); }
  100% { transform: rotate(351deg) translate(-6%, -3%) scale(1.02); }
}
@keyframes vault-flow-layer-1 {
  0%   { transform: rotate(12deg) translate(10%, -9%) scale(0.96); }
  25%  { transform: rotate(-78deg) translate(-3%, 8%) scale(1.09); }
  50%  { transform: rotate(-168deg) translate(-12%, 3%) scale(1.02); }
  75%  { transform: rotate(-258deg) translate(4%, -11%) scale(0.92); }
  100% { transform: rotate(-348deg) translate(10%, -9%) scale(0.96); }
}
@keyframes vault-flow-layer-2 {
  0%   { transform: rotate(-18deg) translate(-19%, 13%) scale(1.08); }
  25%  { transform: rotate(72deg) translate(13%, 18%) scale(0.93); }
  50%  { transform: rotate(162deg) translate(18%, -14%) scale(1.12); }
  75%  { transform: rotate(252deg) translate(-12%, -18%) scale(0.98); }
  100% { transform: rotate(342deg) translate(-19%, 13%) scale(1.08); }
}
@keyframes vault-flow-layer-3 {
  0%   { transform: rotate(20deg) translate(23%, 19%) scale(0.9); }
  25%  { transform: rotate(-70deg) translate(-18%, -23%) scale(1.14); }
  50%  { transform: rotate(-160deg) translate(-25%, -12%) scale(0.96); }
  75%  { transform: rotate(-250deg) translate(16%, 24%) scale(1.08); }
  100% { transform: rotate(-340deg) translate(23%, 19%) scale(0.9); }
}
`;
	document.head.appendChild(style);
}

export function MotionArtworkFlowBackground({
	assetUrl,
	coverUrl,
	className,
	maxLayers = FLOW_LAYERS.length,
	paused = false,
}: MotionArtworkFlowBackgroundProps) {
	const shouldReduceMotion = useReducedMotion();
	ensureFlowKeyframesInjected();
	const layers = FLOW_LAYERS.slice(0, maxLayers);

	return (
		<div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
			{layers.map((layer, index) => (
				<div
					key={layer.size}
					className="absolute inset-0 flex items-center justify-center"
				>
					<div
						style={{
							animation: shouldReduceMotion
								? "none"
								: `vault-flow-layer-${index} ${layer.duration}s linear infinite`,
							animationPlayState:
								paused || shouldReduceMotion ? "paused" : "running",
							willChange: "transform",
						}}
						className={cn(
							"relative shrink-0 overflow-hidden blur-[90px] brightness-[0.8] saturate-[1.9]",
							layer.size,
							layer.opacity,
						)}
					>
						<ArtworkSource
							active={!paused}
							assetUrl={assetUrl}
							coverUrl={coverUrl}
							className="absolute inset-0 size-full object-cover"
						/>
					</div>
				</div>
			))}
			<div className="absolute inset-0 bg-black/12" />
		</div>
	);
}

export default function MotionArtworkStage({
	presentation,
	assetUrl,
	coverUrl,
	className,
	active = true,
}: MotionArtworkStageProps) {
	if (presentation === "fill") {
		return (
			<div
				className={cn("absolute inset-0 overflow-hidden bg-black", className)}
			>
				<ArtworkSource
					active={active}
					assetUrl={assetUrl}
					coverUrl={coverUrl}
					className="absolute inset-0 size-full object-cover"
				/>
			</div>
		);
	}

	return (
		<div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
			<div className="absolute inset-0 overflow-hidden bg-black">
				<ArtworkSource
					active={active}
					assetUrl={coverUrl ? undefined : assetUrl}
					coverUrl={coverUrl}
					className="absolute -inset-[14%] size-[128%] scale-110 object-cover blur-[34px] brightness-[0.48] saturate-125"
				/>
			</div>

			{presentation === "apple-portrait" ? (
				<div
					className="absolute inset-x-0 top-0 aspect-[3/4] overflow-hidden"
					style={{
						WebkitMaskImage:
							"linear-gradient(to bottom, black 0%, black 72%, transparent 100%)",
						maskImage:
							"linear-gradient(to bottom, black 0%, black 72%, transparent 100%)",
					}}
				>
					<ArtworkSource
						active={active}
						assetUrl={assetUrl}
						coverUrl={coverUrl}
						className="absolute inset-0 size-full object-cover"
					/>
				</div>
			) : (
				<div className="absolute inset-x-[7%] top-[8%] aspect-square overflow-hidden rounded-[7%] shadow-2xl">
					<ArtworkSource
						active={active}
						assetUrl={assetUrl}
						coverUrl={coverUrl}
						className="absolute inset-0 size-full object-cover"
					/>
				</div>
			)}
		</div>
	);
}
