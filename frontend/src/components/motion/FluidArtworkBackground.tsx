// Fluid artwork background inspired by Navic (https://github.com/ssalggnikool/Navic) by ssalggnikool
// Independently implemented for Vault Studio using React, CSS animations, and compositor-friendly GPU transforms.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import MobileArtworkBackdrop from "./MobileArtworkBackdrop";

interface FluidArtworkBackgroundProps {
	coverUrl?: string | null;
	isPlaying?: boolean;
	className?: string;
	rasterized?: boolean;
	/** Optional test id override */
	"data-testid"?: string;
}

const STYLE_ID = "vault-fluid-artwork-bg-styles";

function ensureKeyframesInjected() {
	if (typeof document === "undefined") return;
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
@keyframes vault-fluid-spin-ccw {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}
@keyframes vault-fluid-spin-cw {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes vault-fluid-drift-1 {
  0%   { transform: translate(-8%, -10%) scale(1.02); }
  33%  { transform: translate(10%, -4%) scale(1.22); }
  66%  { transform: translate(-4%, 12%) scale(0.94); }
  100% { transform: translate(-8%, -10%) scale(1.02); }
}
@keyframes vault-fluid-drift-2 {
  0%   { transform: translate(10%, 8%) scale(1.15); }
  33%  { transform: translate(-10%, 10%) scale(0.92); }
  66%  { transform: translate(8%, -12%) scale(1.2); }
  100% { transform: translate(10%, 8%) scale(1.15); }
}
`;
	document.head.appendChild(style);
}

export default function FluidArtworkBackground({
	coverUrl,
	isPlaying = true,
	className,
	rasterized = false,
	"data-testid": testId = "fluid-artwork-bg",
}: FluidArtworkBackgroundProps) {
	const shouldReduceMotion = useReducedMotion();
	useEffect(ensureKeyframesInjected, []);

	const animPlayState = shouldReduceMotion || !isPlaying ? "paused" : "running";
	const hasArtwork = Boolean(coverUrl);

	// Styles for the active fluid layers
	const orbitFrameStyle = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-spin-ccw 25s linear infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	const counterOrbitStyle = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-spin-cw 32s linear infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	const topLeftStyle = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-spin-cw 14s linear infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	const botRightStyle = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-spin-cw 18s linear infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	const topRightStyle = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-spin-ccw 20s linear infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	const botLeftStyle = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-spin-cw 16s linear infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	const drift1Style = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-drift-1 20s ease-in-out infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	const drift2Style = useMemo(
		() => ({
			animation: shouldReduceMotion
				? "none"
				: "vault-fluid-drift-2 23s ease-in-out infinite",
			animationPlayState: animPlayState,
			willChange: "transform",
		}),
		[shouldReduceMotion, animPlayState],
	);

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-0 isolate overflow-hidden bg-black select-none",
				className,
			)}
			data-testid={testId}
			data-cover-url={coverUrl ?? undefined}
			data-is-playing={isPlaying}
		>
			{rasterized && coverUrl ? (
				<MobileArtworkBackdrop coverUrl={coverUrl} isPlaying={isPlaying} />
			) : (
				<AnimatePresence initial={false}>
					<motion.div
						key={coverUrl || "fallback-gradient"}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.5, ease: "easeInOut" }}
						className="absolute inset-0 overflow-hidden"
					>
						<div
							className={cn(
								"absolute inset-0",
								hasArtwork && "fluid-artwork-raster",
							)}
						>
							{hasArtwork ? (
								/* Oversized blurred container with 15% bleed on all sides to prevent edge fade */
								<div
									className="absolute -inset-[15%] size-[130%] overflow-hidden filter blur-[var(--fluid-artwork-blur,50px)] saturate-[1.8] contrast-[1.12] brightness-[0.95]"
									style={{ transform: "translateZ(0)" }}
								>
									{/* Base Layer: static blurred cover art covering full space */}
									<img
										src={coverUrl!}
										alt=""
										className="absolute inset-0 size-full object-cover opacity-60"
										draggable={false}
									/>

									{/* Primary Orbiting Frame: sized closely to viewport so orbiting blobs pass across the screen */}
									<div
										className="absolute inset-[-10%] size-[120%]"
										style={orbitFrameStyle}
									>
										{/* Top-Left Quadrant blob */}
										<div className="absolute left-0 top-0 size-[58%] overflow-hidden rounded-full opacity-85">
											<img
												src={coverUrl!}
												alt=""
												className="size-full scale-135 object-cover object-top"
												style={topLeftStyle}
												draggable={false}
											/>
										</div>

										{/* Bottom-Right Quadrant blob */}
										<div className="absolute bottom-0 right-0 size-[58%] overflow-hidden rounded-full opacity-85">
											<img
												src={coverUrl!}
												alt=""
												className="size-full scale-135 object-cover object-bottom"
												style={botRightStyle}
												draggable={false}
											/>
										</div>
									</div>

									{/* Counter-Orbiting Frame: creates opposing movement across other diagonal */}
									<div
										className="absolute inset-[-8%] size-[116%]"
										style={counterOrbitStyle}
									>
										{/* Top-Right Quadrant blob with blend mode for luminous color crossing */}
										<div className="absolute right-0 top-0 size-[54%] overflow-hidden rounded-full opacity-70 mix-blend-screen">
											<img
												src={coverUrl!}
												alt=""
												className="size-full scale-135 object-cover object-top"
												style={topRightStyle}
												draggable={false}
											/>
										</div>

										{/* Bottom-Left Quadrant blob */}
										<div className="absolute bottom-0 left-0 size-[54%] overflow-hidden rounded-full opacity-75">
											<img
												src={coverUrl!}
												alt=""
												className="size-full scale-135 object-cover object-bottom"
												style={botLeftStyle}
												draggable={false}
											/>
										</div>
									</div>

									{/* Floating Organic Drift Blobs: expand and morph across the screen */}
									<div
										className="absolute left-[15%] top-[20%] size-[60%] rounded-full opacity-65 mix-blend-screen"
										style={drift1Style}
									>
										<img
											src={coverUrl!}
											alt=""
											className="size-full scale-140 object-cover object-center"
											draggable={false}
										/>
									</div>

									<div
										className="absolute bottom-[15%] right-[15%] size-[60%] rounded-full opacity-60 mix-blend-screen"
										style={drift2Style}
									>
										<img
											src={coverUrl!}
											alt=""
											className="size-full scale-140 object-cover object-center"
											draggable={false}
										/>
									</div>
								</div>
							) : (
								/* Fallback when no artwork exists: rich ambient dark radial gradients */
								<div className="absolute inset-0 bg-[#0d0d11]">
									<div className="absolute -left-[20%] -top-[20%] size-[80vw] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.22)_0%,transparent_70%)] blur-[80px]" />
									<div className="absolute -bottom-[20%] -right-[20%] size-[80vw] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.2)_0%,transparent_70%)] blur-[80px]" />
									<div className="absolute inset-[15%] rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.1)_0%,transparent_70%)] blur-[90px]" />
								</div>
							)}
						</div>
					</motion.div>
				</AnimatePresence>
			)}

			{/* Uniform darkening wash: 28% black keeps colors punchy and fluid while keeping text legible */}
			<div className="absolute inset-0 bg-black/28" />

			{/* Subtle ambient vertical gradient: soft vignette for top header & bottom controls */}
			<div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25)_0%,transparent_20%,transparent_78%,rgba(0,0,0,0.30)_100%)]" />
		</div>
	);
}
