import { X, MoreHorizontal, FolderOpen, GripVertical } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { useProjectCoverImage } from "@/hooks/useProjectCoverImage";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useState, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
  layer?: "player" | "expanded";
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
        } as any)
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
    />
  );
}

export default function QueuePanel({
  isOpen,
  onClose,
  layer = "player",
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

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
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

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{
              type: "spring",
              stiffness: 700,
              damping: 40,
            }}
            className={cn(
              "fixed inset-x-2 sm:inset-x-6 mx-auto max-w-[800px]",
              layer === "expanded"
                ? "bottom-[max(env(safe-area-inset-bottom),1rem)] z-[10001]"
                : "bottom-[145px] z-120",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex max-h-[500px] w-full flex-col overflow-hidden rounded-3xl text-(--text-0) shadow-2xl border border-(--card-border) overlay-surface">
              <div className="flex w-full items-center justify-between gap-5 p-5">
                <div className="flex items-center gap-3">
                  <Button
                    aria-label="Close queue manager"
                    className="h-8 w-8 rounded-lg bg-(--inner-card-bg) border border-(--card-border) p-0 text-center hover:bg-[#252525] transition-all duration-200 flex items-center justify-center"
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
                    className="bg-(--inner-card-bg) border border-(--card-border) rounded-2xl px-3 py-1 text-(--text-0) text-xs h-auto hover:bg-[#252525] transition-all duration-200"
                    onClick={handleClearQueue}
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div
                ref={queueContentRef}
                className="max-h-[500px] overflow-y-auto px-2 hide-scrollbar overscroll-contain touch-pan-y"
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
                                          className="h-7 w-7 shrink-0 rounded-lg hover:bg-white/10 transition-all opacity-70 hover:opacity-100"
                                          onPointerDown={(e) => e.stopPropagation()}
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

                                    <div
                                      {...provided.dragHandleProps}
                                      aria-label={`Reorder ${track.title}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:text-white cursor-grab active:cursor-grabbing touch-none select-none transition-colors"
                                    >
                                      <GripVertical className="size-4" />
                                    </div>
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
    document.body,
  );
}
