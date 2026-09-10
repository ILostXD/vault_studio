import { lazy, Suspense, useState, useEffect } from "react";
import BaseModal from "@/components/modals/BaseModal";
import type { Track, Project, VisibilityStatus } from "@/types/api";

const TrackDetailsModal = lazy(() => import("@/components/modals/TrackDetailsModal"));
const TrackVersionsModal = lazy(() => import("@/components/modals/TrackVersionsModal"));
const CoverArtOptionsModal = lazy(() => import("@/components/modals/CoverArtOptionsModal"));
const MotionArtworkModal = lazy(() => import("@/components/modals/MotionArtworkModal"));
const NotesPanel = lazy(() => import("@/components/NotesPanel"));
const GlobalSearchModal = lazy(() => import("@/components/GlobalSearchModal"));

interface TrackDetailsData {
	title: string;
	duration?: string;
	key?: string | null;
	bpm?: number | null;
	fileName?: string;
	active_version_id?: number | null;
	waveform?: string | null;
	visibility_status?: VisibilityStatus;
}

interface ProjectModalsProps {
	// Track details modal
	selectedTrack: Track | null;
	trackDetailsData: TrackDetailsData | null;
	isModalOpen: boolean;
	onCloseModal: () => void;
	project: Project;
	projectCoverImage: string | null;
	isProjectOwned: boolean;
	canEditTrack: (track: Track | null) => boolean;
	isInSharedProject: boolean;
	projectAllowsDownloads: boolean;
	onTrackUpdate: () => void;
	onOpenNotes: (track: Track) => void;

	// Versions modal
	versionUploadTrack: Track | null;
	isVersionsModalOpen: boolean;
	onCloseVersionsModal: () => void;
	onBackFromVersions: () => void;

	// Cover art modal
	isCoverModalOpen: boolean;
	onCloseCoverModal: () => void;
	onLibraryClick: () => void;
	onExportCover: () => void;
	onOpenMotionArtwork: () => void;
	hasExistingCover: boolean;
	hasMotionArtwork: boolean;
	canEditCover: boolean;
	canDownloadCover: boolean;
	isMotionArtworkOpen: boolean;
	onCloseMotionArtwork: () => void;
	motionArtistName: string;
	motionTrackTitle: string;

	// Notes modal (mobile)
	isSmallScreen: boolean;
	isNotesOpen: boolean;
	onCloseNotes: () => void;
	notesTrack: Track | null;

	// Global search
	isGlobalSearchOpen: boolean;
	onCloseGlobalSearch: () => void;
}

export function ProjectModals({
	selectedTrack,
	trackDetailsData,
	isModalOpen,
	onCloseModal,
	project,
	projectCoverImage,
	isProjectOwned,
	canEditTrack,
	isInSharedProject,
	projectAllowsDownloads,
	onTrackUpdate,
	onOpenNotes,
	versionUploadTrack,
	isVersionsModalOpen,
	onCloseVersionsModal,
	onBackFromVersions,
	isCoverModalOpen,
	onCloseCoverModal,
	onLibraryClick,
	onExportCover,
	onOpenMotionArtwork,
	hasExistingCover,
	hasMotionArtwork,
	canEditCover,
	canDownloadCover,
	isMotionArtworkOpen,
	onCloseMotionArtwork,
	motionArtistName,
	motionTrackTitle,
	isSmallScreen,
	isNotesOpen,
	onCloseNotes,
	notesTrack,
	isGlobalSearchOpen,
	onCloseGlobalSearch,
}: ProjectModalsProps) {
	const [hasOpenedCover, setHasOpenedCover] = useState(false);
	const [hasOpenedMotion, setHasOpenedMotion] = useState(false);
	const [hasOpenedSearch, setHasOpenedSearch] = useState(false);

	useEffect(() => {
		if (isCoverModalOpen) setHasOpenedCover(true);
	}, [isCoverModalOpen]);

	useEffect(() => {
		if (isMotionArtworkOpen) setHasOpenedMotion(true);
	}, [isMotionArtworkOpen]);

	useEffect(() => {
		if (isGlobalSearchOpen) setHasOpenedSearch(true);
	}, [isGlobalSearchOpen]);

	return (
		<Suspense fallback={null}>
			{selectedTrack && trackDetailsData && (
				<TrackDetailsModal
					isOpen={isModalOpen}
					onClose={onCloseModal}
					trackId={selectedTrack.public_id}
					track={trackDetailsData}
					onUpdate={onTrackUpdate}
					projectName={project.name}
					artist={selectedTrack.artist}
					coverUrl={projectCoverImage}
					projectId={project.public_id}
					projectCoverUrl={project.cover_url ?? undefined}
					isProjectOwned={isProjectOwned}
					canEdit={canEditTrack(selectedTrack)}
					isInSharedProject={isInSharedProject}
					projectAllowsDownloads={projectAllowsDownloads}
					onOpenNotes={() => onOpenNotes(selectedTrack)}
				/>
			)}

			{versionUploadTrack && (
				<TrackVersionsModal
					isOpen={isVersionsModalOpen}
					onClose={onCloseVersionsModal}
					onBack={onBackFromVersions}
					trackId={versionUploadTrack.public_id}
					track={{
						title: String(versionUploadTrack.title),
						key: versionUploadTrack.key,
						bpm: versionUploadTrack.bpm,
						active_version_id: versionUploadTrack.active_version_id,
					}}
					onUpdate={onTrackUpdate}
					showBackdrop={true}
				/>
			)}

			{hasOpenedCover && (
				<CoverArtOptionsModal
					isOpen={isCoverModalOpen}
					onClose={onCloseCoverModal}
					onLibraryClick={onLibraryClick}
					onExportClick={onExportCover}
					onMotionClick={onOpenMotionArtwork}
					hasExistingCover={hasExistingCover}
					hasMotionArtwork={hasMotionArtwork}
					canEdit={canEditCover}
					canDownload={canDownloadCover}
				/>
			)}

			{hasOpenedMotion && (
				<MotionArtworkModal
					isOpen={isMotionArtworkOpen}
					onClose={onCloseMotionArtwork}
					projectId={project.public_id}
					projectName={project.name}
					artistName={motionArtistName}
					trackTitle={motionTrackTitle}
					coverUrl={projectCoverImage}
					canEdit={canEditCover}
				/>
			)}

			{isSmallScreen && isNotesOpen && (
				<BaseModal isOpen={isNotesOpen} onClose={onCloseNotes} maxWidth="lg">
					<div className="p-6 min-h-[300px]">
						{notesTrack ? (
							<NotesPanel
								mode="track"
								selectedTrack={notesTrack}
								onClose={onCloseNotes}
							/>
						) : (
							<NotesPanel
								mode="project"
								project={project}
								onClose={onCloseNotes}
							/>
						)}
					</div>
				</BaseModal>
			)}

			{hasOpenedSearch && (
				<GlobalSearchModal
					isOpen={isGlobalSearchOpen}
					onClose={onCloseGlobalSearch}
				/>
			)}
		</Suspense>
	);
}
