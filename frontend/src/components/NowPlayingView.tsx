import { Fullscreen } from "@boengli/capacitor-fullscreen";
import { Capacitor } from "@capacitor/core";
import { EdgeToEdge } from "@capawesome/capacitor-android-edge-to-edge-support";
import {
	ChevronDown,
	FileText,
	FolderOpen,
	GripVertical,
	ListMusic,
	Menu,
	MessageSquare,
	MoreHorizontal,
	Pause,
	Play,
	Repeat,
	Repeat1,
	Shuffle,
	SkipBack,
	SkipForward,
	Trash2,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useMemo,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
} from "@hello-pangea/dnd";
import MotionArtworkStage, {
	MotionArtworkFlowBackground,
	type MotionArtworkPresentation,
} from "@/components/motion/MotionArtworkStage";
import NotesPanel from "@/components/NotesPanel";
import QueuePanel from "@/components/QueuePanel";
import WaveformComments from "@/components/WaveformComments";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useProjectMotionAssets } from "@/hooks/useProjectMotionAssets";
import { formatTrackDuration } from "@/lib/duration";
import {
	getFullscreenDesktopQueueOpen,
	setFullscreenDesktopQueueOpen,
} from "@/lib/fullscreenQueue";
import {
	isNowPlayingArtworkMode,
	NOW_PLAYING_ARTWORK_MODE_KEY,
	type NowPlayingArtworkMode,
	resolveNowPlayingArtworkMode,
} from "@/lib/motionArtwork";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/api";

interface NowPlayingViewProps {
	projectId: string;
	projectName: string;
	coverUrl?: string | null;
	variant: "mobile" | "desktop";
	tracks?: Track[];
}

const WAVEFORM_HEIGHT = 120;
const WAVEFORM_BAR_WIDTH = 0.8;
const WAVEFORM_BAR_GAP = 2;
const WAVEFORM_X_OFFSET = 0.1;

interface PlaybackWaveformProps {
	bars: number[];
	duration: number;
	progress: number;
	onSeek: (time: number) => void;
}

function PlaybackWaveform({
	bars,
	duration,
	progress,
	onSeek,
}: PlaybackWaveformProps) {
	const viewBoxWidth =
		Math.max(bars.length - 1, 0) * WAVEFORM_BAR_GAP +
		WAVEFORM_BAR_WIDTH +
		WAVEFORM_X_OFFSET * 2;
	const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
	const progressPosition = (progressPercent / 100) * viewBoxWidth;

	const seekAt = (clientX: number, element: HTMLDivElement) => {
		if (duration <= 0) return;
		const rect = element.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		onSeek(ratio * duration);
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		seekAt(event.clientX, event.currentTarget);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
		seekAt(event.clientX, event.currentTarget);
	};

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		onSeek(
			Math.max(
				0,
				Math.min(duration, progress + (event.key === "ArrowLeft" ? -5 : 5)),
			),
		);
	};

	return (
		<div
			className="relative h-[50px] w-full touch-none cursor-pointer select-none"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onKeyDown={handleKeyDown}
			role="slider"
			tabIndex={0}
			aria-label="Playback position"
			aria-valuemin={0}
			aria-valuemax={Math.floor(duration)}
			aria-valuenow={Math.floor(progress)}
		>
			<svg
				width="100%"
				height="100%"
				viewBox={`0 0 ${viewBoxWidth} ${WAVEFORM_HEIGHT}`}
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				{bars.map((height, index) => {
					const normalizedHeight = Math.max(0, Math.min(100, Number(height)));
					const scaledHeight = Math.max(
						12,
						(normalizedHeight / 100) * WAVEFORM_HEIGHT,
					);
					const x = WAVEFORM_X_OFFSET + index * WAVEFORM_BAR_GAP;
					return (
						<rect
							key={x}
							x={x}
							y={(WAVEFORM_HEIGHT - scaledHeight) / 2}
							width={WAVEFORM_BAR_WIDTH}
							height={scaledHeight}
							rx={2}
							fill={
								progressPosition >= x ? "#ffffff" : "rgba(255,255,255,0.25)"
							}
						/>
					);
				})}
			</svg>
			<div
				className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)]"
				style={{ left: `${progressPercent}%` }}
			/>
		</div>
	);
}

export default function NowPlayingView({
	projectId,
	projectName,
	coverUrl,
	variant,
	tracks,
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
		reorderQueue,
		clearQueue,
	} = useAudioPlayer();
	const navigate = useNavigate();
	const { preferences } = usePreferences();
	const { data: motionAssets = [] } = useProjectMotionAssets(projectId);
	const [preferredArtworkMode, setPreferredArtworkMode] =
		useState<NowPlayingArtworkMode>(() => {
			if (typeof window === "undefined") return "spotify_canvas";
			const saved = window.localStorage.getItem(NOW_PLAYING_ARTWORK_MODE_KEY);
			return isNowPlayingArtworkMode(saved) ? saved : "spotify_canvas";
		});
	const [isQueueOpen, setIsQueueOpen] = useState(() =>
		variant === "desktop" ? getFullscreenDesktopQueueOpen() : false,
	);
	const [isNotesOpen, setIsNotesOpen] = useState(false);
	const [isCommentsOpen, setIsCommentsOpen] = useState(false);
	const squareAsset = motionAssets.find(
		(asset) => asset.kind === "apple_square",
	);

	const handleQueueDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		if (result.destination.index === result.source.index) return;
		reorderQueue(result.source.index, result.destination.index);
	};

	useEffect(() => {
		setIsQueueOpen(
			variant === "desktop" ? getFullscreenDesktopQueueOpen() : false,
		);
	}, [variant]);

	const toggleQueue = () => {
		setIsQueueOpen((prev) => {
			const next = !prev;
			if (variant === "desktop") {
				setFullscreenDesktopQueueOpen(next);
			}
			if (next) {
				setIsNotesOpen(false);
			}
			return next;
		});
	};

	useEffect(() => {
		if (variant !== "mobile" || !Capacitor.isNativePlatform()) return;

		void EdgeToEdge.disable()
			.then(() => Fullscreen.activateImmersiveMode())
			.catch((error) => {
				console.error("Failed to enter immersive mode:", error);
			});

		return () => {
			void Fullscreen.deactivateImmersiveMode()
				.then(() => EdgeToEdge.enable())
				.catch((error) => {
					console.error("Failed to leave immersive mode:", error);
				});
		};
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
			if (isCommentsOpen) {
				setIsCommentsOpen(false);
				return;
			}
			if (isNotesOpen) {
				setIsNotesOpen(false);
				return;
			}
			if (isQueueOpen) {
				setIsQueueOpen(false);
				if (variant === "desktop") {
					setFullscreenDesktopQueueOpen(false);
				}
				return;
			}
			closeNowPlaying();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [closeNowPlaying, isCommentsOpen, isNotesOpen, isQueueOpen, variant]);

	const waveformBars = useMemo(() => {
		if (currentTrack?.waveform) {
			try {
				const parsed = JSON.parse(currentTrack.waveform);
				if (Array.isArray(parsed) && parsed.length > 0) {
					return parsed.map(Number).filter(Number.isFinite);
				}
			} catch {
				// Fall back to a stable placeholder while analysis is unavailable.
			}
		}
		return Array.from({ length: 200 }, (_, index) => {
			const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
			return (value - Math.floor(value)) * 60 + 20;
		});
	}, [currentTrack?.waveform]);

	if (!currentTrack) return null;

	const activeTrack: Track = useMemo(() => {
		const found = tracks?.find((t) => t.public_id === currentTrack.id);
		if (found) return found;
		return {
			id: 0,
			user_id: 0,
			project_id: 0,
			public_id: currentTrack.id,
			title: currentTrack.title,
			artist: currentTrack.artist ?? null,
			track_order: 0,
			created_at: "",
			updated_at: "",
			active_version_id: currentTrack.versionId ?? null,
		} as Track;
	}, [
		tracks,
		currentTrack.id,
		currentTrack.title,
		currentTrack.artist,
		currentTrack.versionId,
	]);

	const activeVersionId =
		currentTrack.versionId ?? activeTrack.active_version_id;
	const isCommentsEnabled = preferences?.comments_enabled !== false;

	const resolvedArtworkMode = resolveNowPlayingArtworkMode(
		preferredArtworkMode,
		motionAssets.map((asset) => asset.kind),
	);
	const activeMobileAsset = motionAssets.find(
		(asset) => asset.kind === resolvedArtworkMode,
	);
	const isTallArtwork =
		resolvedArtworkMode === "apple_portrait" ||
		resolvedArtworkMode === "spotify_canvas";
	const mobilePresentation: MotionArtworkPresentation =
		resolvedArtworkMode === "apple_portrait" ? "apple-portrait" : "fill";
	const progress = duration > 0 ? Math.min(previewProgress, duration) : 0;
	const artist = currentTrack.artist || currentTrack.projectName || projectName;
	const selectArtworkMode = (mode: string) => {
		if (!isNowPlayingArtworkMode(mode)) return;
		setPreferredArtworkMode(mode);
		window.localStorage.setItem(NOW_PLAYING_ARTWORK_MODE_KEY, mode);
	};

	if (variant === "desktop") {
		return createPortal(
			<>
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
							className="flex w-[min(36rem,44vw)] flex-col items-center will-change-transform"
						>
							<div className="relative size-[min(54dvh,32vw,36rem)] max-w-full shrink-0 overflow-hidden rounded-lg shadow-2xl">
								<MotionArtworkStage
									presentation="fill"
									assetUrl={squareAsset?.preview_url}
									coverUrl={coverUrl ?? currentTrack.coverUrl}
								/>
							</div>

							<div className="relative mt-7 w-full px-28 text-center">
								<div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
									{isCommentsEnabled && activeVersionId && (
										<Button
											type="button"
											variant="ghost"
											size="icon-lg"
											className={cn(
												"size-10 rounded-full bg-black/20 text-white/75 backdrop-blur-md hover:bg-black/40 hover:text-white",
												isCommentsOpen && "bg-white/15 text-white",
											)}
											onClick={() => setIsCommentsOpen(true)}
											aria-label="Comments"
											aria-pressed={isCommentsOpen}
											title="Comments"
										>
											<MessageSquare className="size-5" />
										</Button>
									)}
									<Button
										type="button"
										variant="ghost"
										size="icon-lg"
										className={cn(
											"size-10 rounded-full bg-black/20 text-white/75 backdrop-blur-md hover:bg-black/40 hover:text-white",
											isNotesOpen && "bg-white/15 text-white",
										)}
										onClick={() => setIsNotesOpen((open) => !open)}
										aria-label={isNotesOpen ? "Hide notes" : "Show notes"}
										aria-pressed={isNotesOpen}
										title={isNotesOpen ? "Hide notes" : "Show notes"}
									>
										<FileText className="size-5" />
									</Button>
								</div>

								<h2 className="truncate text-xl font-semibold">
									{currentTrack.title}
								</h2>
								<p className="mt-1 truncate text-base text-white/60">
									{artist}
								</p>

								<div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
									<Button
										type="button"
										variant="ghost"
										size="icon-lg"
										className={cn(
											"size-10 rounded-full bg-black/20 text-white/75 backdrop-blur-md hover:bg-black/40 hover:text-white",
											isQueueOpen && "bg-white/15 text-white",
										)}
										onClick={toggleQueue}
										aria-label={isQueueOpen ? "Hide queue" : "Show queue"}
										aria-pressed={isQueueOpen}
										title={isQueueOpen ? "Hide queue" : "Show queue"}
									>
										<ListMusic className="size-5" />
									</Button>
								</div>
							</div>

							<div className="relative mt-6 w-full">
								{isCommentsEnabled && activeVersionId && (
									<WaveformComments
										versionId={activeVersionId}
										duration={duration}
										currentTime={progress}
										onSeek={seekTo}
										placement="fullscreen"
										isOpen={isCommentsOpen}
										onOpenChange={setIsCommentsOpen}
										showButton={false}
									/>
								)}
								<PlaybackWaveform
									bars={waveformBars}
									duration={duration}
									progress={progress}
									onSeek={seekTo}
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

						<div className="pointer-events-none absolute inset-y-0 right-0 flex w-[min(38rem,40vw)] items-center">
							<AnimatePresence initial={false}>
								{isQueueOpen && (
									<motion.aside
										key="fullscreen-queue-panel"
										initial={{ opacity: 0, x: 32 }}
										animate={{ opacity: 1, x: 0 }}
										exit={{ opacity: 0, x: 24 }}
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
												<DragDropContext onDragEnd={handleQueueDragEnd}>
													<Droppable
														droppableId="fullscreen-desktop-queue"
														renderClone={(provided, _snapshot, rubric) => {
															const track = queue[rubric.source.index];
															return createPortal(
																<div
																	ref={provided.innerRef}
																	{...provided.draggableProps}
																	{...provided.dragHandleProps}
																	className="flex items-center gap-2 rounded-xl border border-white/20 bg-neutral-900/95 px-3 py-3 text-white shadow-2xl backdrop-blur-xl"
																	style={{
																		...provided.draggableProps.style,
																		zIndex: 100005,
																		width: "min(36rem, 36vw)",
																		boxSizing: "border-box",
																	}}
																>
																	<div className="text-white/70 p-1">
																		<GripVertical className="size-4" />
																	</div>
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
																	<div className="min-w-0 flex-1">
																		<p className="truncate font-medium">
																			{track.title}
																		</p>
																		<p className="truncate text-sm text-white/50">
																			{track.artist ||
																				track.projectName ||
																				"Unknown artist"}
																		</p>
																	</div>
																</div>,
																document.body,
															);
														}}
													>
														{(provided) => (
															<div
																ref={provided.innerRef}
																{...provided.droppableProps}
																className="space-y-1"
															>
																{queue.map((track, index) => (
																	<Draggable
																		key={`${track.id}-${index}`}
																		draggableId={`${track.id}-${index}`}
																		index={index}
																	>
																		{(dragProvided, dragSnapshot) => (
																			<div
																				ref={dragProvided.innerRef}
																				{...dragProvided.draggableProps}
																				className={cn(
																					"group flex items-center gap-2 border-t border-white/10 py-3 transition-colors",
																					dragSnapshot.isDragging &&
																						"bg-white/10 rounded-xl px-2 border-transparent shadow-lg",
																				)}
																			>
																				<div
																					{...dragProvided.dragHandleProps}
																					className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white p-1 rounded transition-colors touch-none"
																					title="Drag to reorder"
																					aria-label={`Reorder ${track.title}`}
																				>
																					<GripVertical className="size-4" />
																				</div>
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
																				<DropdownMenu>
																					<DropdownMenuTrigger asChild>
																						<Button
																							type="button"
																							variant="ghost"
																							size="icon-sm"
																							className="size-8 rounded-full text-white/45 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
																							aria-label={`Options for ${track.title}`}
																						>
																							<MoreHorizontal className="size-4" />
																						</Button>
																					</DropdownMenuTrigger>
																					<DropdownMenuContent
																						align="end"
																						className="w-48 z-[10005] bg-neutral-900 border-white/10 text-white"
																					>
																						{track.projectId && (
																							<DropdownMenuItem
																								onClick={() => {
																									navigate({
																										to: "/project/$projectId",
																										params: {
																											projectId: track.projectId!,
																										},
																									});
																									closeNowPlaying();
																								}}
																								className="gap-2 cursor-pointer hover:bg-white/10"
																							>
																								<FolderOpen className="size-4" />
																								<span>Go to project</span>
																							</DropdownMenuItem>
																						)}
																						<DropdownMenuItem
																							variant="destructive"
																							onClick={() => removeFromQueue(index)}
																							className="gap-2 text-red-400 cursor-pointer hover:bg-white/10 hover:text-red-300"
																						>
																							<Trash2 className="size-4 text-red-500!" />
																							<span>Remove from queue</span>
																						</DropdownMenuItem>
																					</DropdownMenuContent>
																				</DropdownMenu>
																			</div>
																		)}
																	</Draggable>
																))}
																{provided.placeholder}
															</div>
														)}
													</Droppable>
												</DragDropContext>
											)}
										</div>
									</motion.aside>
								)}
							</AnimatePresence>
						</div>
					</div>
				</div>
			</motion.section>
			<AnimatePresence>
				{isNotesOpen && (
					<div
						className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 p-4 sm:p-6"
						onMouseDown={() => setIsNotesOpen(false)}
					>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 10 }}
							transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
							className="relative flex max-h-[82dvh] w-full max-w-[800px] flex-col overflow-hidden rounded-3xl border border-(--card-border) bg-background text-(--text-0) shadow-2xl p-6"
							onMouseDown={(e) => e.stopPropagation()}
						>
							<NotesPanel
								mode="track"
								selectedTrack={activeTrack}
								onClose={() => setIsNotesOpen(false)}
							/>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</>,
		document.body,
	);
}

	return createPortal(
		<>
			<motion.section
				initial={{ opacity: 0, y: 28, scale: 0.975 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: 24, scale: 0.98 }}
				transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
				className="fixed inset-0 z-[9999] isolate h-[100dvh] w-screen overflow-hidden bg-black text-white shadow-2xl will-change-transform"
				role="dialog"
				aria-modal="true"
				aria-label={`Now playing ${currentTrack.title}`}
			>
				{isTallArtwork ? (
					<MotionArtworkStage
						presentation={mobilePresentation}
						assetUrl={activeMobileAsset?.preview_url}
						coverUrl={coverUrl ?? currentTrack.coverUrl}
					/>
				) : (
					<MotionArtworkFlowBackground
						assetUrl={activeMobileAsset?.preview_url}
						coverUrl={coverUrl ?? currentTrack.coverUrl}
					/>
				)}
				<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.24)_0%,transparent_28%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.76)_70%,rgba(0,0,0,0.97)_100%)]" />

				<div className="absolute inset-0 grid grid-rows-[auto_minmax(0,1fr)_auto] px-7 pb-[max(env(safe-area-inset-bottom),2rem)] pt-[max(env(safe-area-inset-top),2rem)]">
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
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className="size-12 rounded-full bg-black/30 text-white backdrop-blur-md hover:bg-black/50"
									aria-label="Choose artwork"
								>
									<Menu className="size-6" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								sideOffset={8}
								className="z-[10002] w-64 border-white/15 bg-black/90 text-white backdrop-blur-xl"
							>
								<DropdownMenuRadioGroup
									value={preferredArtworkMode}
									onValueChange={selectArtworkMode}
								>
									<DropdownMenuRadioItem value="apple_portrait">
										Apple Motion Artwork 3x4
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="spotify_canvas">
										Spotify Canvas
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="apple_square">
										Apple Motion Artwork 1x1
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="still_cover">
										Still Cover
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<div className="flex min-h-0 items-center justify-center py-4">
						{!isTallArtwork && (
							<div className="relative aspect-square w-[min(86vw,48dvh)] max-w-full shrink-0 overflow-hidden rounded-[6%] shadow-2xl">
								<MotionArtworkStage
									presentation="fill"
									assetUrl={activeMobileAsset?.preview_url}
									coverUrl={coverUrl ?? currentTrack.coverUrl}
								/>
							</div>
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

						<div className="relative">
							{isCommentsEnabled && activeVersionId && (
								<WaveformComments
									versionId={activeVersionId}
									duration={duration}
									currentTime={progress}
									onSeek={seekTo}
									placement="fullscreen"
									isOpen={isCommentsOpen}
									onOpenChange={setIsCommentsOpen}
									showButton={false}
								/>
							)}
							<PlaybackWaveform
								bars={waveformBars}
								duration={duration}
								progress={progress}
								onSeek={seekTo}
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

						<div className="flex items-center justify-end gap-2.5 pt-1">
							{isCommentsEnabled && activeVersionId && (
								<Button
									type="button"
									variant="ghost"
									size="icon-lg"
									className={cn(
										"size-12 rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/45",
										isCommentsOpen && "bg-white/15 text-white",
									)}
									onClick={() => setIsCommentsOpen(true)}
									aria-label="Comments"
									title="Comments"
								>
									<MessageSquare className="size-6" />
								</Button>
							)}
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className={cn(
									"size-12 rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/45",
									isNotesOpen && "bg-white/15 text-white",
								)}
								onClick={() => setIsNotesOpen(true)}
								aria-label="Notes"
								title="Notes"
							>
								<FileText className="size-6" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className={cn(
									"size-12 rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/45",
									isQueueOpen && "bg-white/15 text-white",
								)}
								onClick={() => setIsQueueOpen(true)}
								aria-label="Open queue"
								title="Queue"
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
			<AnimatePresence>
				{isNotesOpen && (
					<div
						className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center bg-black/70 p-3 sm:p-6"
						onMouseDown={() => setIsNotesOpen(false)}
					>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 15 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 15 }}
							transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
							className="relative flex max-h-[82dvh] w-full max-w-[800px] flex-col overflow-hidden rounded-3xl border border-(--card-border) bg-background text-(--text-0) shadow-2xl p-6"
							onMouseDown={(e) => e.stopPropagation()}
						>
							<NotesPanel
								mode="track"
								selectedTrack={activeTrack}
								onClose={() => setIsNotesOpen(false)}
							/>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</>,
		document.body,
	);
}
