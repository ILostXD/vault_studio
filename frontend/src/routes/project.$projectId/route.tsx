import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  LinkIcon,
  SearchIcon,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Copy,
  FileText,
  Download,
  ListPlus,
  Trash2,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  type ProjectPageArtworkMode,
  PROJECT_PAGE_ARTWORK_MODE_KEY,
  isProjectPageArtworkMode,
} from "@/lib/motionArtwork";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useDeleteProject,
  useProject,
  useDuplicateProject,
  useExportProject,
  useMoveProject,
  projectKeys,
} from "@/hooks/useProjects";
import { usePrefetchFolders } from "@/hooks/useFolders";
import { usePrefetchSharingData } from "@/hooks/useSharing";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useTracks } from "@/hooks/useTracks";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useProjectCoverImage } from "@/hooks/useProjectCoverImage";
import DeleteProjectModal from "@/components/modals/DeleteProjectModal";
import LeaveProjectModal from "@/components/modals/LeaveProjectModal";
import MoveProjectModal from "@/components/modals/MoveProjectModal";
import ShareModal from "@/components/modals/ShareModal";
import { toast } from "@/routes/__root";
import * as sharingApi from "@/api/sharing";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/project/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: tracks = [] } = useTracks(project ? project.id : null);
  const { addProjectToQueue, currentTrack, isNowPlayingOpen, closeNowPlaying } =
    useAudioPlayer();
  const { imageUrl: projectCoverImage } = useProjectCoverImage(project, "medium");
  const deleteProject = useDeleteProject();
  const duplicateProject = useDuplicateProject();
  const exportProject = useExportProject();
  const moveProject = useMoveProject();
  const prefetchFolders = usePrefetchFolders();
  const prefetchSharingData = usePrefetchSharingData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const projectArtist =
    project?.author_override || project?.owner_username || user?.username;
  const isCurrentProjectNowPlaying = Boolean(
    isNowPlayingOpen && currentTrack?.projectId === project?.public_id,
  );

  const [projectArtworkMode, setProjectArtworkMode] =
    useState<ProjectPageArtworkMode>(() => {
      if (typeof window === "undefined") return "apple_portrait";
      const saved = window.localStorage.getItem(PROJECT_PAGE_ARTWORK_MODE_KEY);
      return isProjectPageArtworkMode(saved) ? saved : "apple_portrait";
    });

  useEffect(() => {
    const handleModeChange = () => {
      const saved = window.localStorage.getItem(PROJECT_PAGE_ARTWORK_MODE_KEY);
      if (isProjectPageArtworkMode(saved)) {
        setProjectArtworkMode(saved);
      }
    };
    window.addEventListener("project-artwork-mode-change", handleModeChange);
    window.addEventListener("storage", handleModeChange);
    return () => {
      window.removeEventListener("project-artwork-mode-change", handleModeChange);
      window.removeEventListener("storage", handleModeChange);
    };
  }, []);

  const handleArtworkModeChange = (mode: string) => {
    if (!isProjectPageArtworkMode(mode)) return;
    setProjectArtworkMode(mode);
    window.localStorage.setItem(PROJECT_PAGE_ARTWORK_MODE_KEY, mode);
    window.dispatchEvent(
      new CustomEvent("project-artwork-mode-change", { detail: mode }),
    );
  };

  const { data: sharedProjects = [] } = useQuery({
    queryKey: ["shared-projects"],
    queryFn: sharingApi.listProjectsSharedWithMe,
    staleTime: 5 * 60 * 1000,
  });

  const isProjectOwned = project && user ? project.user_id === user.id : true;
  const isProjectShared =
    project && sharedProjects.some((p) => p.id === project.id);

  const sharedProject = project
    ? sharedProjects.find((p) => p.id === project.id)
    : null;

  const canDownloadProject = isProjectOwned || sharedProject?.allow_downloads;

  const handleLeaveProject = async () => {
    if (!project?.public_id || isLeaving) return;

    setIsLeaving(true);
    try {
      await sharingApi.leaveSharedProject(project.public_id);
      queryClient.invalidateQueries({ queryKey: ["shared-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/" });
    } catch (error) {
      toast.error("Failed to leave project");
      console.error("Failed to leave project:", error);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!project) return;

    try {
      await deleteProject.mutateAsync(project.public_id);
      setShowDeleteModal(false);
      navigate({ to: "/" });
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  const handleAddToQueue = () => {
    if (!project || tracks.length === 0) {
      toast.error("No tracks to add to queue");
      return;
    }

    const projectTracks = tracks.map((t) => ({
      id: t.public_id,
      title: String(t.title),
      artist: t.artist || projectArtist,
      projectName: String(project.name),
      coverUrl: projectCoverImage,
      projectId: project.public_id,
      projectCoverUrl: project.cover_url ?? undefined,
      waveform: t.waveform,
      versionId: t.active_version_id ?? undefined,
    }));

    addProjectToQueue(projectTracks);
    toast.success(
      `Added ${tracks.length} track${tracks.length === 1 ? "" : "s"} to queue`
    );
  };

  const handleDuplicateProject = async () => {
    if (!project) return;

    try {
      await duplicateProject.mutateAsync(project.public_id);
    } catch (_error) {
      toast.error("Failed to duplicate project");
    }
  };

  const handleExportProject = async () => {
    if (!project) return;

    try {
      await exportProject.mutateAsync({
        id: project.public_id,
        projectName: String(project.name),
      });
    } catch (_error) {
      toast.error("Failed to export project");
    }
  };

  const handleMoveClick = () => {
    setShowMoveModal(true);
  };

  const handleMoveConfirm = async (folderId: number | null) => {
    if (!project) return;

    try {
      await moveProject.mutateAsync({
        id: project.public_id,
        folderId,
      });
      setShowMoveModal(false);
    } catch (_error) {
      toast.error("Failed to move project");
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-linear-to-b from-background from-30% to-transparent text-(--text-0) md:p-10 p-6">
          <Button
            variant="default"
            size="icon-lg"
            haptic="light"
            onClick={() => {
              if (isCurrentProjectNowPlaying) closeNowPlaying();
              window.history.back();
            }}
            className="transition-transform duration-300"
          >
            <ChevronLeftIcon className="size-4.5" />
          </Button>
          <div className="flex items-center gap-2.5">
            {isProjectOwned && (
              <Button
                variant="default"
                size="icon-lg"
                haptic="light"
                onClick={() => {
                  if (project) {
                    prefetchSharingData("project", project.public_id);
                  }
                  setShowShareModal(true);
                }}
              >
                <LinkIcon className="size-4.5" />
              </Button>
            )}
            <Button
              variant="default"
              size="icon-lg"
              haptic="light"
              onClick={() => window.dispatchEvent(new Event("project-search"))}
            >
              <SearchIcon strokeWidth={3} className="size-4.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="icon-lg"
                  haptic="light"
                  className="sm:hidden"
                  aria-label="Choose artwork mode"
                >
                  <Film className="size-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 border-muted bg-background"
              >
                <DropdownMenuRadioGroup
                  value={projectArtworkMode}
                  onValueChange={handleArtworkModeChange}
                >
                  <DropdownMenuRadioItem value="apple_portrait">
                    Apple Motion 3x4
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="apple_square">
                    Apple Motion 1x1
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="still_cover">
                    Static Cover
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu onOpenChange={(open) => open && prefetchFolders()}>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="icon-lg" haptic="light">
                  <MoreHorizontal strokeWidth={3} className="size-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-48 border-muted bg-background"
              >
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Film className="ml-1 mr-1.5 size-4.5" />
                    Artwork display
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56 border-muted bg-background">
                    <DropdownMenuRadioGroup
                      value={projectArtworkMode}
                      onValueChange={handleArtworkModeChange}
                    >
                      <DropdownMenuRadioItem value="apple_portrait">
                        Apple Motion 3x4
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="apple_square">
                        Apple Motion 1x1
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="still_cover">
                        Static Cover
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    window.dispatchEvent(new Event("project-rename"))
                  }
                >
                  <Pencil className="ml-1 mr-1.5 size-4.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleMoveClick}>
                  <FolderInput className="ml-1 mr-1.5 size-4.5" />
                  Move project
                </DropdownMenuItem>
                {isProjectOwned && (
                  <DropdownMenuItem onSelect={handleDuplicateProject}>
                    <Copy className="ml-1 mr-1.5 size-4.5" />
                    Duplicate project
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() =>
                    window.dispatchEvent(new Event("project-notes"))
                  }
                >
                  <FileText className="ml-1 mr-1.5 size-4.5" />
                  Notes
                </DropdownMenuItem>
                {canDownloadProject && (
                  <DropdownMenuItem onSelect={handleExportProject}>
                    <Download className="ml-1 mr-1.5 size-4.5" />
                    Export project
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={handleAddToQueue}>
                  <ListPlus className="ml-1 mr-1.5 size-4.5" />
                  Add to queue
                </DropdownMenuItem>
                {isProjectShared && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setShowLeaveModal(true)}
                    >
                      <LogOut className="ml-1 mr-1.5 size-4.5" />
                      Leave Project
                    </DropdownMenuItem>
                  </>
                )}
                {isProjectOwned && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={handleDeleteClick}
                    >
                      <Trash2 className="ml-1 mr-1.5 size-4.5" />
                      Delete project
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <Outlet />
      </div>

      <DeleteProjectModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        projectName={project ? String(project.name) : ""}
        isDeleting={deleteProject.isPending}
      />

      {isProjectShared && project && (
        <LeaveProjectModal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          onConfirm={() => {
            setShowLeaveModal(false);
            handleLeaveProject();
          }}
          projectName={String(project.name)}
          isLeaving={isLeaving}
        />
      )}

      <MoveProjectModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onConfirm={handleMoveConfirm}
        projectName={project ? String(project.name) : ""}
        currentFolderId={project?.folder_id ?? null}
        isMoving={moveProject.isPending}
      />

      {project && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          onBack={() => setShowShareModal(false)}
          resourceType="project"
          resourceId={project.public_id}
          resourceName={String(project.name)}
          currentVisibility={project.visibility_status}
          onUpdate={() => {
            queryClient.invalidateQueries({
              queryKey: projectKeys.detail(project.public_id),
            });
          }}
          showBackdrop={true}
          isOwned={isProjectOwned}
        />
      )}
    </>
  );
}
