import { AnimatePresence } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useProjectCoverImage } from "@/hooks/useProjectCoverImage";
import { useProject } from "@/hooks/useProjects";
import { useTracks } from "@/hooks/useTracks";
import { Button } from "./ui/button";

const loadNowPlaying = () => import("./NowPlayingView");
const NowPlayingView = lazy(loadNowPlaying);

function LoadingPlayer() {
  const { closeNowPlaying } = useAudioPlayer();
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white" role="dialog" aria-modal="true" aria-label="Loading Now Playing">
      <Button onClick={closeNowPlaying} variant="ghost" size="icon-lg" aria-label="Collapse Now Playing" className="absolute left-6 top-[max(env(safe-area-inset-top),1.5rem)] text-white">
        <ChevronDown />
      </Button>
      <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-label="Loading" />
    </div>
  );
}

function CurrentNowPlaying() {
  const { currentTrack } = useAudioPlayer();
  const { data: project } = useProject(currentTrack?.projectId);
  const { data: tracks } = useTracks(project?.id ?? null);
  const { imageUrl } = useProjectCoverImage(project, "large");
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);

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
  useEffect(() => {
    if (currentTrack) void loadNowPlaying().catch(() => {});
  }, [currentTrack?.id]);
  return (
    <Suspense fallback={<LoadingPlayer />}>
      <AnimatePresence initial={false}>
        {isNowPlayingOpen && currentTrack && <CurrentNowPlaying key="now-playing" />}
      </AnimatePresence>
    </Suspense>
  );
}
