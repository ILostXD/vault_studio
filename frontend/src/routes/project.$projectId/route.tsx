import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
	ChevronLeftIcon,
	Copy,
	Download,
	FileText,
	Film,
	FolderInput,
	LinkIcon,
	ListPlus,
	LogOut,
	MoreHorizontal,
	PackageCheck,
	Pencil,
	SearchIcon,
	Trash2,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import * as sharingApi from "@/api/sharing";
import DeleteProjectModal from "@/components/modals/DeleteProjectModal";
import LeaveProjectModal from "@/components/modals/LeaveProjectModal";
import MoveProjectModal from "@/components/modals/MoveProjectModal";
import ShareModal from "@/components/modals/ShareModal";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePrefetchFolders } from "@/hooks/useFolders";
import { useProjectCoverImage } from "@/hooks/useProjectCoverImage";
import { useProjectMotionAssets } from "@/hooks/useProjectMotionAssets";
import {
	projectKeys,
	useDeleteProject,
	useDuplicateProject,
	useExportProject,
	useMoveProject,
	useProject,
} from "@/hooks/useProjects";
import { usePrefetchSharingData } from "@/hooks/useSharing";
import { useTracks } from "@/hooks/useTracks";
import {
	isProjectPageArtworkMode,
	PROJECT_PAGE_ARTWORK_MODE_KEY,
	type ProjectPageArtworkMode,
	resolveProjectPageArtworkMode,
} from "@/lib/motionArtwork";
import { toast } from "@/routes/__root";

const PrepareReleaseModal = lazy(() =>
	import("@/components/distribution/PrepareReleaseModal").then((m) => ({
		default: m.PrepareReleaseModal,
	})),
);
const ProjectMetadataModal = lazy(
	() => import("@/components/modals/ProjectMetadataModal"),
);

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
	const { imageUrl: projectCoverImage } = useProjectCoverImage(
		project,
		"medium",
	);
	const { data: motionAssets = [] } = useProjectMotionAssets(
		project?.public_id,
	);
	const deleteProject = useDeleteProject();
	const duplicateProject = useDuplicateProject();
	const moveProject = useMoveProject();
	const exportProject = useExportProject();
	const prefetchFolders = usePrefetchFolders();
	const prefetchSharingData = usePrefetchSharingData();
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [showMoveModal, setShowMoveModal] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [showPrepareRelease, setShowPrepareRelease] = useState(false);
	const [showMetadata, setShowMetadata] = useState(false);
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
			window.removeEventListener(
				"project-artwork-mode-change",
				handleModeChange,
			);
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

	const artworkKinds = motionAssets.map((asset) => asset.kind);
	// The menu shows what the page actually displays, not just the saved preference.
	const effectiveArtworkMode = resolveProjectPageArtworkMode(
		projectArtworkMode,
		artworkKinds,
	);
	const hasMobilePortraitArtwork = effectiveArtworkMode === "apple_portrait";

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
		} catch (_error) {
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
			`Added ${tracks.length} track${tracks.length === 1 ? "" : "s"} to queue`,
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
			<div
				className={`min-h-screen bg-background ${
					hasMobilePortraitArtwork ? "mobile-project-motion-page" : ""
				}`}
			>
				<header
					className={`project-page-header fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-linear-to-b from-background from-30% to-transparent text-(--text-0) md:p-10 p-6 ${
						hasMobilePortraitArtwork ? "mobile-project-motion-header" : ""
					}`}
				>
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
						<DropdownMenu onOpenChange={(open) => open && prefetchFolders()}>
							<DropdownMenuTrigger asChild>
								<Button variant="default" size="icon-lg" haptic="light">
									<MoreHorizontal strokeWidth={3} className="size-4.5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								sideOffset={8}
								collisionPadding={16}
								className="w-56 max-w-[calc(100vw-2rem)] border-muted bg-background sm:w-48"
							>
								<div className="sm:hidden">
									<DropdownMenuLabel className="flex items-center gap-2 text-(--text-0)/60">
										<Film className="size-4.5" />
										Artwork display
									</DropdownMenuLabel>
									<DropdownMenuRadioGroup
										value={effectiveArtworkMode}
										onValueChange={handleArtworkModeChange}
									>
										<DropdownMenuRadioItem
											value="apple_portrait"
											disabled={!artworkKinds.includes("apple_portrait")}
										>
											Apple Motion 3x4
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem
											value="apple_square"
											disabled={!artworkKinds.includes("apple_square")}
										>
											Apple Motion 1x1
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="still_cover">
											Static Cover
										</DropdownMenuRadioItem>
									</DropdownMenuRadioGroup>
									<DropdownMenuSeparator />
								</div>
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
								{isProjectOwned && (
									<DropdownMenuItem
										onSelect={() => setShowPrepareRelease(true)}
									>
										<PackageCheck className="ml-1 mr-1.5 size-4.5" />
										Prepare release
									</DropdownMenuItem>
								)}
								{canDownloadProject && (
									<DropdownMenuItem
										disabled={exportProject.isPending}
										onSelect={() => {
											if (isProjectOwned) setShowMetadata(true);
											else
												exportProject.mutate({
													id: projectId,
													projectName: project?.name || "project",
												});
										}}
									>
										<Download className="ml-1 mr-1.5 size-4.5" />
										{isProjectOwned
											? "Export & Library"
											: "Download raw project"}
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

			{project && isProjectOwned && showPrepareRelease && (
				<Suspense fallback={null}>
					<PrepareReleaseModal
						isOpen={showPrepareRelease}
						onClose={() => setShowPrepareRelease(false)}
						projectId={project.id}
					/>
				</Suspense>
			)}
			{project && isProjectOwned && showMetadata && (
				<Suspense fallback={null}>
					<ProjectMetadataModal
						projectId={project.id}
						projectPublicId={project.public_id}
						projectName={String(project.name)}
						coverUrl={projectCoverImage}
						isOwned={isProjectOwned}
						onClose={() => setShowMetadata(false)}
					/>
				</Suspense>
			)}
		</>
	);
}
