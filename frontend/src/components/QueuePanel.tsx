import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { FolderOpen, GripVertical, MoreHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useProjectCoverImage } from "@/hooks/useProjectCoverImage";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/api";

interface QueuePanelProps {
	isOpen: boolean;
	onClose: () => void;
	layer?: "player" | "expanded";
	embedded?: boolean;
	panelTarget?: HTMLElement | null;
}

interface QueueTrack {
	id: string;
	title: string;
	artist?: string | null;
	projectName?: string;
	coverUrl?: string | null;
	projectId?: string;
	projectCoverUrl?: string;
}

function QueueTrackCover({ track }: { track: QueueTrack }) {
	const projectForCover =
		track.projectId && track.projectCoverUrl
			? ({
					public_id: track.projectId,
					cover_url: track.projectCoverUrl,
				} satisfies Pick<Project, "public_id" | "cover_url">)
			: undefined;
	const { imageUrl } = useProjectCoverImage(projectForCover, "small");

	const coverUrl = imageUrl || track.coverUrl;

	if (!coverUrl) {
		return null;
	}

	return (
		<img
			src={coverUrl}
			alt={track.title}
			className="w-full h-full object-cover"
			loading="lazy"
			decoding="async"
		/>
	);
}

export default function QueuePanel({
	isOpen,
	onClose,
	layer = "player",
	embedded = false,
	panelTarget = null,
}: QueuePanelProps) {
	const { queue, removeFromQueue, clearQueue, reorderQueue } = useAudioPlayer();
	const navigate = useNavigate();
	const routerState = useRouterState();
	const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
	const queueContentRef = useRef<HTMLDivElement | null>(null);

	const handleClearQueue = () => {
		clearQueue();
	};

	const handleRemoveTrack = (index: number) => {
		setOpenMenuIndex(null); // Close dropdown menu
		removeFromQueue(index);
	};

	const handleGoToProject = (projectId?: string, trackId?: string) => {
		if (projectId) {
			setOpenMenuIndex(null);

			const currentPath = routerState.location.pathname;
			const targetPath = `/project/${projectId}`;

			if (currentPath === targetPath || currentPath === `${targetPath}/`) {
				if (trackId) {
					const trackElement = document.querySelector(
						`[data-track-id="${trackId}"]`,
					);
					if (trackElement) {
						trackElement.scrollIntoView({
							behavior: "smooth",
							block: "center",
						});
					}
				}
				onClose();
			} else {
				if (trackId) {
					sessionStorage.setItem("scrollToTrack", trackId);
				}

				navigate({
					to: "/project/$projectId",
					params: { projectId },
				});
				setTimeout(() => {
					onClose();
				}, 100);
			}
		}
	};

	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) {
			return;
		}

		const sourceIndex = result.source.index;
		const destIndex = result.destination.index;

		if (sourceIndex === destIndex) {
			return;
		}

		reorderQueue(sourceIndex, destIndex);
	};

	if (embedded && !panelTarget) return null;
	const portalTarget = embedded ? panelTarget : document.body;
	if (!portalTarget) return null;

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<>
					{!embedded && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.1 }}
							className={cn(
								"fixed inset-0 overlay-backdrop",
								layer === "expanded" ? "z-[10000]" : "z-119",
							)}
							onClick={onClose}
						/>
					)}

					<motion.div
						initial={embedded ? { opacity: 0, y: 8 } : { opacity: 0, y: 5 }}
						animate={{ opacity: 1, x: 0, y: 0 }}
						exit={embedded ? { opacity: 0, y: 6 } : { opacity: 0, y: 5 }}
						transition={
							embedded
								? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
								: { type: "spring", stiffness: 700, damping: 40 }
						}
						className={cn(
							embedded
								? "h-full"
								: "fixed inset-x-2 sm:inset-x-6 mx-auto max-w-[800px]",
							!embedded &&
								(layer === "expanded"
									? "bottom-[max(env(safe-area-inset-bottom),1rem)] z-[10001]"
									: "bottom-[145px] z-120"),
						)}
						onClick={(e) => e.stopPropagation()}
					>
						<div
							className={cn(
								"relative flex w-full flex-col overflow-hidden text-(--text-0)",
								embedded
									? "h-full"
									: "max-h-[500px] rounded-3xl border border-(--card-border) overlay-surface shadow-2xl",
							)}
							style={
								embedded
									? ({
											"--text-0": "#ffffff",
											"--action-bg": "rgba(0, 0, 0, 0.16)",
											"--action-bg-hover": "rgba(255, 255, 255, 0.08)",
											"--card-border": "rgba(255, 255, 255, 0.12)",
										} as React.CSSProperties)
									: undefined
							}
						>
							<div
								className={cn(
									"flex w-full items-center justify-between gap-5",
									embedded ? "pb-4" : "p-5",
								)}
							>
								<div className="flex items-center gap-3">
									<Button
										aria-label="Close queue manager"
										className={cn(
											"flex h-8 w-8 items-center justify-center p-0 text-center transition-colors duration-200",
											embedded
												? "rounded-full bg-black/20 text-white/65 hover:bg-black/40 hover:text-white"
												: "rounded-lg border border-(--card-border) bg-(--inner-card-bg) hover:bg-[#252525]",
										)}
										type="button"
										onClick={onClose}
									>
										<X className="size-3.5" />
									</Button>
									<h3 className="text-lg font-semibold">Queue</h3>
									{queue.length > 0 && (
										<span className="text-sm text-(--text-0)/40">
											{queue.length} {queue.length === 1 ? "track" : "tracks"}
										</span>
									)}
								</div>
								{queue.length > 0 && (
									<Button
										className="bg-(--inner-card-bg) border border-(--card-border) rounded-2xl px-3 py-1 text-(--text-0) text-xs h-auto hover:bg-[#252525] transition-colors duration-200"
										onClick={handleClearQueue}
									>
										Clear
									</Button>
								)}
							</div>

							<div
								ref={queueContentRef}
								className={cn(
									"overflow-y-auto hide-scrollbar overscroll-contain touch-pan-y",
									embedded ? "min-h-0 flex-1" : "max-h-[500px] px-2",
								)}
							>
								{queue.length === 0 ? (
									<div className="flex flex-col text-center items-center justify-center pb-14">
										<p className="text-(--text-0)/40">No tracks in queue</p>
									</div>
								) : (
									<DragDropContext onDragEnd={handleDragEnd}>
										<Droppable
											droppableId="queue"
											renderClone={(provided, _snapshot, rubric) => {
												const track = queue[rubric.source.index];
												return createPortal(
													<div
														ref={provided.innerRef}
														{...provided.draggableProps}
														{...provided.dragHandleProps}
														className="relative flex items-center justify-between gap-3 rounded-2xl p-3 bg-(--bg-2)/75 shadow-2xl ring-1 ring-(--control-border) text-(--text-0) backdrop-blur-xl cursor-grabbing"
														style={{
															...provided.draggableProps.style,
															width: queueContentRef.current
																? `${queueContentRef.current.clientWidth - 16}px`
																: "calc(100% - 16px)",
															maxWidth: "780px",
															boxSizing: "border-box",
															zIndex: 100005,
														}}
													>
														<div className="flex min-w-0 flex-1 items-center justify-start gap-4">
															<div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#333333] border border-[rgba(53,51,51,0.2)]">
																<QueueTrackCover track={track} />
															</div>
															<div className="flex max-w-full flex-col text-left min-w-0">
																<span className="text-sm font-semibold line-clamp-1 break-all text-(--text-0)">
																	{track.title}
																</span>
																<span className="text-xs text-(--text-0)/40 line-clamp-1 break-all">
																	{(track.artist &&
																	track.artist.trim().length > 0
																		? track.artist
																		: track.projectName) || "Unknown Artist"}
																</span>
															</div>
														</div>
														<div className="flex items-center gap-1 shrink-0">
															<div className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70">
																<GripVertical className="size-4" />
															</div>
														</div>
													</div>,
													document.body,
												);
											}}
										>
											{(provided) => (
												<div
													{...provided.droppableProps}
													ref={provided.innerRef}
													className="pb-2"
												>
													{queue.map((track, index) => (
														<Draggable
															key={`${track.id}-${index}`}
															draggableId={`${track.id}-${index}`}
															index={index}
														>
															{(provided, snapshot) => (
																<div
																	ref={provided.innerRef}
																	{...provided.draggableProps}
																	className={cn(
																		"relative flex w-full items-center justify-between gap-3 rounded-2xl p-3 mb-1 bg-(--action-bg) hover:bg-(--action-bg-hover) transition-colors group",
																		snapshot.isDragging && "opacity-50 z-50",
																	)}
																	style={provided.draggableProps.style}
																>
																	<div className="flex min-w-0 flex-1 items-center justify-start gap-4">
																		<div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#333333] border border-[rgba(53,51,51,0.2)]">
																			<QueueTrackCover track={track} />
																		</div>

																		<div className="flex max-w-full flex-col text-left min-w-0">
																			<span className="text-sm font-semibold line-clamp-1 break-all">
																				{track.title}
																			</span>
																			<span className="text-xs text-(--text-0)/40 line-clamp-1 break-all">
																				{(track.artist &&
																				track.artist.trim().length > 0
																					? track.artist
																					: track.projectName) ||
																					"Unknown Artist"}
																				{track.projectName &&
																					track.artist &&
																					track.artist.trim().length > 0 &&
																					` • ${track.projectName}`}
																			</span>
																		</div>
																	</div>

																	<div className="flex items-center gap-1 shrink-0">
																		<DropdownMenu
																			open={openMenuIndex === index}
																			onOpenChange={(open) =>
																				setOpenMenuIndex(open ? index : null)
																			}
																		>
																			<DropdownMenuTrigger asChild>
																				<Button
																					type="button"
																					variant="ghost"
																					size="icon-sm"
																					className="h-7 w-7 shrink-0 rounded-lg hover:bg-white/10 transition-[opacity,background-color] duration-150 opacity-70 hover:opacity-100"
																					onPointerDown={(e) =>
																						e.stopPropagation()
																					}
																					onClick={(e) => e.stopPropagation()}
																				>
																					<MoreHorizontal className="size-4" />
																				</Button>
																			</DropdownMenuTrigger>
																			<DropdownMenuContent
																				align="end"
																				className="w-48 border-muted bg-background z-[10005]"
																			>
																				<DropdownMenuItem
																					onSelect={() =>
																						handleGoToProject(
																							track.projectId,
																							track.id,
																						)
																					}
																					disabled={!track.projectId}
																				>
																					<FolderOpen className="ml-1 mr-1.5 size-4.5" />
																					Go to project
																				</DropdownMenuItem>
																				<DropdownMenuSeparator />
																				<DropdownMenuItem
																					variant="destructive"
																					onSelect={() =>
																						handleRemoveTrack(index)
																					}
																				>
																					<X className="ml-1 mr-1.5 size-4.5 text-red-500!" />
																					Remove from queue
																				</DropdownMenuItem>
																			</DropdownMenuContent>
																		</DropdownMenu>

																		<button
																			type="button"
																			{...provided.dragHandleProps}
																			aria-label={`Reorder ${track.title}`}
																			className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:text-white cursor-grab active:cursor-grabbing touch-none select-none transition-colors"
																		>
																			<GripVertical className="size-4" />
																		</button>
																	</div>
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
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>,
		portalTarget,
	);
}
