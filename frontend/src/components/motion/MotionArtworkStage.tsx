import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type MotionArtworkPresentation = "fill" | "apple-portrait" | "square";

interface MotionArtworkStageProps {
	presentation: MotionArtworkPresentation;
	assetUrl?: string | null;
	coverUrl?: string | null;
	className?: string;
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
}

function ArtworkSource({
	assetUrl,
	coverUrl,
	className,
}: ArtworkSourceProps) {
	return (
		<>
			{coverUrl && <img src={coverUrl} alt="" className={className} />}
			{assetUrl && (
				<video
					key={assetUrl}
					src={assetUrl}
					poster={coverUrl ?? undefined}
					autoPlay
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

export function MotionArtworkFlowBackground({
	assetUrl,
	coverUrl,
	className,
	maxLayers = FLOW_LAYERS.length,
	paused = false,
}: MotionArtworkFlowBackgroundProps) {
	const shouldReduceMotion = useReducedMotion();
	const layers = FLOW_LAYERS.slice(0, maxLayers);

	return (
		<div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
			{layers.map((layer) => (
				<div
					key={layer.size}
					className="absolute inset-0 flex items-center justify-center"
				>
					<motion.div
						animate={
							shouldReduceMotion || paused
								? { rotate: 0, x: 0, y: 0, scale: 1 }
								: {
										rotate: layer.rotate,
										x: layer.x,
										y: layer.y,
										scale: layer.scale,
									}
						}
						transition={
							paused || shouldReduceMotion
								? { duration: 0.18 }
								: {
										duration: layer.duration,
										repeat: Infinity,
										ease: "linear",
									}
						}
						className={cn(
							"relative shrink-0 overflow-hidden blur-[90px] brightness-[0.8] saturate-[1.9] will-change-transform",
							layer.size,
							layer.opacity,
						)}
					>
						<ArtworkSource
							assetUrl={assetUrl}
							coverUrl={coverUrl}
							className="absolute inset-0 size-full object-cover"
						/>
					</motion.div>
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
}: MotionArtworkStageProps) {
	if (presentation === "fill") {
		return (
			<div
				className={cn("absolute inset-0 overflow-hidden bg-black", className)}
			>
				<ArtworkSource
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
						assetUrl={assetUrl}
						coverUrl={coverUrl}
						className="absolute inset-0 size-full object-cover"
					/>
				</div>
			) : (
				<div className="absolute inset-x-[7%] top-[8%] aspect-square overflow-hidden rounded-[7%] shadow-2xl">
					<ArtworkSource
						assetUrl={assetUrl}
						coverUrl={coverUrl}
						className="absolute inset-0 size-full object-cover"
					/>
				</div>
			)}
		</div>
	);
}
