import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useProjectCoverImage } from "@/hooks/useProjectCoverImage";
import { useProject } from "@/hooks/useProjects";
import { useTracks } from "@/hooks/useTracks";
import NowPlayingView from "./NowPlayingView";

function CurrentNowPlaying() {
	const { currentTrack } = useAudioPlayer();
	const { data: project } = useProject(currentTrack?.projectId);
	const { data: tracks } = useTracks(project?.id ?? null);
	const { imageUrl } = useProjectCoverImage(project, "large");
	const [mobile, setMobile] = useState(
		() => window.matchMedia("(max-width: 768px)").matches,
	);

	useEffect(() => {
		const query = window.matchMedia("(max-width: 768px)");
		const update = () => setMobile(query.matches);
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	if (!currentTrack) return null;
	return (
		<NowPlayingView
			projectId={currentTrack.projectId ?? ""}
			projectName={project?.name ?? currentTrack.projectName ?? ""}
			coverUrl={imageUrl ?? currentTrack.coverUrl}
			tracks={tracks}
			variant={mobile ? "mobile" : "desktop"}
		/>
	);
}

export default function FullscreenPlayer() {
	const { currentTrack, isNowPlayingOpen } = useAudioPlayer();
	return (
		<AnimatePresence initial={false}>
			{isNowPlayingOpen && currentTrack && (
				<CurrentNowPlaying key="now-playing" />
			)}
		</AnimatePresence>
	);
}
