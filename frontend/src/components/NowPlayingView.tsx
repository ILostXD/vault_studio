import {
	ChevronDown,
	ListMusic,
	Pause,
	Play,
	Repeat,
	Repeat1,
	Shuffle,
	SkipBack,
	SkipForward,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import MotionArtworkStage, {
	MotionArtworkFlowBackground,
	type MotionArtworkPresentation,
} from "@/components/motion/MotionArtworkStage";
import QueuePanel from "@/components/QueuePanel";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useProjectMotionAssets } from "@/hooks/useProjectMotionAssets";
import { formatTrackDuration } from "@/lib/duration";
import type { MotionAssetKind } from "@/lib/motionArtwork";
import { cn } from "@/lib/utils";

interface NowPlayingViewProps {
	projectId: string;
	projectName: string;
	coverUrl?: string | null;
	variant: "mobile" | "desktop";
}

export default function NowPlayingView({
	projectId,
	projectName,
	coverUrl,
	variant,
}: NowPlayingViewProps) {
	const {
		currentTrack,
		isPlaying,
		duration,
		previewProgress,
		pause,
		resume,
		previousTrack,
		nextTrack,
		seekTo,
		loopMode,
		toggleLoop,
		isShuffled,
		toggleShuffle,
		closeNowPlaying,
		queue,
		currentProjectTracks,
		play,
		removeFromQueue,
		clearQueue,
	} = useAudioPlayer();
	const { data: motionAssets = [] } = useProjectMotionAssets(projectId);
	const [selectedTallKind, setSelectedTallKind] =
		useState<MotionAssetKind>("spotify_canvas");
	const [isQueueOpen, setIsQueueOpen] = useState(variant === "desktop");
	const tallAssets = useMemo(
		() =>
			motionAssets.filter(
				(asset) =>
					asset.kind === "spotify_canvas" || asset.kind === "apple_portrait",
			),
		[motionAssets],
	);
	const squareAsset = motionAssets.find(
		(asset) => asset.kind === "apple_square",
	);

	useEffect(() => {
		if (tallAssets.some((asset) => asset.kind === selectedTallKind)) return;
		setSelectedTallKind(tallAssets[0]?.kind ?? "spotify_canvas");
	}, [selectedTallKind, tallAssets]);

	useEffect(() => {
		setIsQueueOpen(variant === "desktop");
	}, [variant]);

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (isQueueOpen) {
				setIsQueueOpen(false);
				return;
			}
			closeNowPlaying();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [closeNowPlaying, isQueueOpen]);

	if (!currentTrack) return null;

	const tallAsset =
		tallAssets.find((asset) => asset.kind === selectedTallKind) ??
		tallAssets[0];
	const activeMobileAsset = tallAsset ?? squareAsset;
	const mobilePresentation: MotionArtworkPresentation = tallAsset
		? tallAsset.kind === "apple_portrait"
			? "apple-portrait"
			: "fill"
		: "square";
	const progress = duration > 0 ? Math.min(previewProgress, duration) : 0;
	const artist = currentTrack.artist || currentTrack.projectName || projectName;
	const toggleOptions = tallAssets.map((asset) => ({
		label: asset.kind === "spotify_canvas" ? "Canvas" : "Apple",
		value: asset.kind,
	}));

	if (variant === "desktop") {
		return createPortal(
			<motion.section
				initial={{ opacity: 0, scale: 1.015 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 1.01 }}
				transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
				className="fixed inset-0 z-[9999] isolate overflow-hidden bg-black text-white"
				role="dialog"
				aria-modal="true"
				aria-label={`Now playing ${currentTrack.title}`}
			>
				<div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
					<MotionArtworkFlowBackground
						assetUrl={squareAsset?.preview_url}
						coverUrl={coverUrl ?? currentTrack.coverUrl}
					/>
					<div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.4)_0%,rgba(0,0,0,0.06)_52%,rgba(0,0,0,0.24)_100%)]" />
					<div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.1)_0%,transparent_42%,rgba(0,0,0,0.3)_100%)]" />
				</div>

				<div className="absolute right-7 top-7 z-50">
					<Button
						type="button"
						variant="ghost"
						size="icon-lg"
						className="size-12 rounded-full bg-black/35 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-xl transition-[transform,background-color,color,box-shadow] duration-200 ease-out hover:scale-110 hover:rotate-90 hover:bg-white hover:text-black hover:shadow-xl active:scale-95"
						onClick={closeNowPlaying}
						aria-label="Close Now Playing"
						title="Close Now Playing"
					>
						<X className="size-6" />
					</Button>
				</div>

				<div className="relative z-10 flex h-full w-full items-center justify-center px-8 py-14 lg:px-14">
					<div className="relative flex w-full max-w-[92rem] items-center justify-center">
						<motion.div
							initial={false}
							animate={{ x: isQueueOpen ? "-22vw" : "0vw" }}
							transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
							className="flex w-full max-w-[36rem] flex-col items-center will-change-transform"
						>
							<div className="relative size-[min(54dvh,32vw,36rem)] shrink-0 overflow-hidden rounded-lg shadow-2xl">
								<MotionArtworkStage
									presentation="fill"
									assetUrl={squareAsset?.preview_url}
									coverUrl={coverUrl ?? currentTrack.coverUrl}
								/>
							</div>

							<div className="relative mt-7 w-full px-14 text-center">
								<h2 className="truncate text-xl font-semibold">
									{currentTrack.title}
								</h2>
								<p className="mt-1 truncate text-base text-white/60">
									{artist}
								</p>
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className={cn(
										"absolute right-0 top-1/2 size-11 -translate-y-1/2 rounded-full bg-black/20 text-white/75 backdrop-blur-md hover:bg-black/40 hover:text-white",
										isQueueOpen && "bg-white/15 text-white",
									)}
									onClick={() => setIsQueueOpen((open) => !open)}
									aria-label={isQueueOpen ? "Hide queue" : "Show queue"}
									aria-pressed={isQueueOpen}
									title={isQueueOpen ? "Hide queue" : "Show queue"}
								>
									<ListMusic className="size-5" />
								</Button>
							</div>

							<div className="mt-6 w-full">
								<input
									type="range"
									min={0}
									max={Math.max(duration, 0)}
									step={0.1}
									value={progress}
									onChange={(event) => seekTo(Number(event.target.value))}
									className="h-1.5 w-full cursor-pointer accent-white"
									aria-label="Playback position"
								/>
								<div className="mt-1.5 flex justify-between font-mono text-xs text-white/55">
									<span>{formatTrackDuration(progress) ?? "0:00"}</span>
									<span>{formatTrackDuration(duration) ?? "0:00"}</span>
								</div>
							</div>

							<div className="mt-5 flex w-full items-center justify-between">
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className={cn(
										"size-11 rounded-full text-white",
										isShuffled && "text-[var(--accent-color)]",
									)}
									onClick={toggleShuffle}
									aria-label="Toggle shuffle"
									aria-pressed={isShuffled}
								>
									<Shuffle className="size-5" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className="size-12 rounded-full text-white"
									onClick={previousTrack}
									aria-label="Previous track"
								>
									<SkipBack className="size-7 fill-current" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className="size-16 rounded-full border-0 text-black shadow-xl hover:brightness-90"
									style={{ background: "#ffffff", border: 0 }}
									onClick={isPlaying ? pause : resume}
									aria-label={isPlaying ? "Pause" : "Play"}
								>
									{isPlaying ? (
										<Pause className="size-7 fill-current" />
									) : (
										<Play className="ml-1 size-7 fill-current" />
									)}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className="size-12 rounded-full text-white"
									onClick={nextTrack}
									aria-label="Next track"
								>
									<SkipForward className="size-7 fill-current" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className={cn(
										"size-11 rounded-full text-white",
										loopMode !== "off" && "text-[var(--accent-color)]",
									)}
									onClick={toggleLoop}
									aria-label="Change repeat mode"
								>
									{loopMode === "track" ? (
										<Repeat1 className="size-5" />
									) : (
										<Repeat className="size-5" />
									)}
								</Button>
							</div>
						</motion.div>

						<div className="pointer-events-none absolute inset-y-0 right-0 flex w-[min(38rem,42vw)] items-center">
							<AnimatePresence initial={false}>
								{isQueueOpen && (
									<motion.aside
										initial={{ opacity: 0, x: 32, filter: "blur(8px)" }}
										animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
										exit={{ opacity: 0, x: 24, filter: "blur(6px)" }}
										transition={{
											duration: 0.35,
											ease: [0.22, 1, 0.36, 1],
										}}
										className="pointer-events-auto flex max-h-[72dvh] w-full flex-col overflow-hidden"
									>
										<div className="mb-6 flex items-end justify-between gap-4">
											<div>
												<p className="text-sm text-white/50">Playing next</p>
												<h2 className="text-3xl font-semibold">Queue</h2>
											</div>
											{queue.length > 0 && (
												<Button
													type="button"
													variant="ghost"
													className="h-9 rounded-lg bg-black/20 px-3 text-white/70 hover:bg-black/35 hover:text-white"
													onClick={clearQueue}
												>
													Clear
												</Button>
											)}
										</div>

										<div className="min-h-0 flex-1 overflow-y-auto pr-2">
											{queue.length === 0 ? (
												<div className="border-t border-white/10 py-10 text-white/45">
													The queue is empty.
												</div>
											) : (
												queue.map((track, index) => (
													<div
														key={`${track.id}-${index}`}
														className="group flex items-center gap-3 border-t border-white/10 py-3"
													>
														<button
															type="button"
															className="flex min-w-0 flex-1 items-center gap-4 text-left"
															onClick={() =>
																play(
																	track,
																	currentProjectTracks,
																	true,
																	false,
																	queue.slice(index + 1),
																)
															}
														>
															<div className="size-12 shrink-0 overflow-hidden rounded-md bg-black/25">
																{(track.coverUrl || track.projectCoverUrl) && (
																	<img
																		src={
																			track.coverUrl || track.projectCoverUrl
																		}
																		alt=""
																		className="size-full object-cover"
																	/>
																)}
															</div>
															<div className="min-w-0">
																<p className="truncate font-medium">
																	{track.title}
																</p>
																<p className="truncate text-sm text-white/50">
																	{track.artist ||
																		track.projectName ||
																		"Unknown artist"}
																</p>
															</div>
														</button>
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															className="size-8 rounded-full text-white/45 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
															onClick={() => removeFromQueue(index)}
															aria-label={`Remove ${track.title} from queue`}
														>
															<X className="size-4" />
														</Button>
													</div>
												))
											)}
										</div>
									</motion.aside>
								)}
							</AnimatePresence>
						</div>
					</div>
				</div>
			</motion.section>,
			document.body,
		);
	}

	return (
		<>
			<motion.section
				initial={{ opacity: 0, y: 28, scale: 0.975 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: 24, scale: 0.98 }}
				transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
				className="fixed inset-0 z-[130] h-[100dvh] w-screen isolate overflow-hidden bg-black text-white shadow-2xl will-change-transform"
				aria-label={`Now playing ${currentTrack.title}`}
			>
				<MotionArtworkStage
					presentation={mobilePresentation}
					assetUrl={activeMobileAsset?.preview_url}
					coverUrl={coverUrl ?? currentTrack.coverUrl}
				/>
				<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.24)_0%,transparent_28%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.76)_70%,rgba(0,0,0,0.97)_100%)]" />

				<div className="absolute inset-0 flex flex-col justify-between px-7 pb-[max(env(safe-area-inset-bottom),2rem)] pt-[max(env(safe-area-inset-top),1.25rem)]">
					<div className="flex items-center justify-between gap-3">
						<Button
							type="button"
							variant="ghost"
							size="icon-lg"
							className="size-12 rounded-full bg-black/30 text-white backdrop-blur-md hover:bg-black/50"
							onClick={closeNowPlaying}
							aria-label="Close Now Playing"
						>
							<ChevronDown className="size-7" />
						</Button>
						{toggleOptions.length > 1 && (
							<ToggleGroup
								options={toggleOptions}
								value={selectedTallKind}
								onValueChange={(value) =>
									setSelectedTallKind(value as MotionAssetKind)
								}
								size="sm"
								className="w-40 border-white/15 bg-black/40 text-white backdrop-blur-md [&_button]:text-white/65"
							/>
						)}
					</div>

					<div className="space-y-5">
						<div className="flex items-end justify-between gap-4">
							<div className="min-w-0">
								<h2 className="truncate text-2xl font-semibold">
									{currentTrack.title}
								</h2>
								<p className="mt-1 truncate text-base text-white/65">
									{artist}
								</p>
							</div>
						</div>

						<div>
							<input
								type="range"
								min={0}
								max={Math.max(duration, 0)}
								step={0.1}
								value={progress}
								onChange={(event) => seekTo(Number(event.target.value))}
								className="h-1.5 w-full cursor-pointer accent-white"
								aria-label="Playback position"
							/>
							<div className="mt-1.5 flex justify-between font-mono text-[11px] text-white/55">
								<span>{formatTrackDuration(progress) ?? "0:00"}</span>
								<span>{formatTrackDuration(duration) ?? "0:00"}</span>
							</div>
						</div>

						<div className="flex items-center justify-between gap-2">
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className={cn(
									"size-12 rounded-full text-white",
									isShuffled && "text-[var(--accent-color)]",
								)}
								onClick={toggleShuffle}
								aria-label="Toggle shuffle"
								aria-pressed={isShuffled}
							>
								<Shuffle className="size-6" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className="size-12 rounded-full text-white"
								onClick={previousTrack}
								aria-label="Previous track"
							>
								<SkipBack className="size-8 fill-current" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className="size-18 rounded-full border-0 shadow-[0_10px_35px_rgba(0,0,0,0.35)] hover:brightness-90"
								style={{ background: "#ffffff", border: 0, color: "#000000" }}
								onClick={isPlaying ? pause : resume}
								aria-label={isPlaying ? "Pause" : "Play"}
							>
								{isPlaying ? (
									<Pause className="size-8 fill-current" />
								) : (
									<Play className="ml-1 size-8 fill-current" />
								)}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className="size-12 rounded-full text-white"
								onClick={nextTrack}
								aria-label="Next track"
							>
								<SkipForward className="size-8 fill-current" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className={cn(
									"size-12 rounded-full text-white",
									loopMode !== "off" && "text-[var(--accent-color)]",
								)}
								onClick={toggleLoop}
								aria-label="Change repeat mode"
							>
								{loopMode === "track" ? (
									<Repeat1 className="size-6" />
								) : (
									<Repeat className="size-6" />
								)}
							</Button>
						</div>

						<div className="flex justify-end pt-1">
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className="size-12 rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/45"
								onClick={() => setIsQueueOpen(true)}
								aria-label="Open queue"
							>
								<ListMusic className="size-6" />
							</Button>
						</div>
					</div>
				</div>
			</motion.section>
			<QueuePanel
				isOpen={isQueueOpen}
				onClose={() => setIsQueueOpen(false)}
				layer="expanded"
			/>
		</>
	);
}
