import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useExport, useExportStatus } from "@/contexts/ExportContext";

export function ExportProgressIndicator() {
	const activeExports = useExportStatus();
	const { dismissExport } = useExport();
	const { currentTrack, queue } = useAudioPlayer();
	const hasPlayer = !!currentTrack || queue.length > 0;
	return (
		<div aria-label="Exports" className={`pointer-events-none fixed inset-x-4 z-120 flex max-h-[50dvh] flex-col gap-2 overflow-y-auto sm:left-auto sm:right-6 sm:w-80 ${hasPlayer ? "bottom-[calc(env(safe-area-inset-bottom)+10rem)] sm:bottom-36" : "bottom-[calc(env(safe-area-inset-bottom)+1rem)] sm:bottom-6"}`}>
			<AnimatePresence initial={false}>
				{activeExports.map((item) => {
					const finished = item.phase === "complete";
					const failed = item.phase === "error";
					const Icon = failed ? AlertCircle : finished ? Check : Download;
					return (
						<motion.div key={item.id}
							initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
							transition={{ duration: 0.18 }}
							className="pointer-events-auto rounded-2xl border border-(--card-border) bg-linear-to-b from-(--card-gradient-from) to-(--card-gradient-to) p-4 text-(--text-0) shadow-lg">
							<div className="flex min-w-0 items-center gap-2.5">
								<Icon aria-hidden="true" className={`size-4 shrink-0 ${failed ? "text-(--danger-0)" : "text-(--accent-blue)"}`} />
								<p className="min-w-0 flex-1 truncate text-sm font-medium" title={item.title}>{item.title}</p>
								<Button variant="ghost" size="icon" className="-mr-2 size-8 shrink-0" aria-label={`Dismiss export of ${item.title}`} title="Dismiss export status" onClick={() => dismissExport(item.id)}><X className="size-4" /></Button>
							</div>
							<div role={failed ? "alert" : "status"} className="mt-2 flex items-center justify-between gap-3 text-xs text-(--text-1)">
								<span>{failed ? "Export failed" : finished ? "Download ready" : item.phase === "preparing" ? "Preparing ZIP" : "Downloading ZIP"}</span>
								{!failed && item.progress !== undefined && <span className="shrink-0 tabular-nums">{Math.floor(item.progress)}%</span>}
							</div>
							{!failed && <Progress value={item.progress} className="mt-2" />}
							{item.statusText && <p className="mt-2 break-words text-xs text-(--text-2)">{item.statusText}</p>}
						</motion.div>
					);
				})}
			</AnimatePresence>
		</div>
	);
}
