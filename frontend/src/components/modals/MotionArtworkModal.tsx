import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ChevronDown,
	CircleAlert,
	Film,
	ListMusic,
	LoaderCircle,
	MessageSquareText,
	MoreHorizontal,
	Pause,
	Play,
	SkipBack,
	SkipForward,
	Star,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
	deleteProjectMotionAsset,
	uploadProjectMotionAsset,
} from "@/api/projects";
import MotionArtworkStage from "@/components/motion/MotionArtworkStage";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
	projectMotionAssetKeys,
	useProjectMotionAssets,
} from "@/hooks/useProjectMotionAssets";
import {
	getMotionArtworkChecks,
	isMotionArtworkCompliant,
	MOTION_ARTWORK_FORMATS,
	type MotionAssetKind,
	type ProjectMotionAsset,
} from "@/lib/motionArtwork";
import { cn } from "@/lib/utils";
import { toast } from "@/routes/__root";
import BaseModal from "./BaseModal";

interface MotionArtworkModalProps {
	isOpen: boolean;
	onClose: () => void;
	projectId: string;
	projectName: string;
	artistName: string;
	trackTitle: string;
	coverUrl: string | null;
	canEdit: boolean;
}

function ArtworkMedia({
	asset,
	coverUrl,
	className,
}: {
	asset?: ProjectMotionAsset;
	coverUrl: string | null;
	className?: string;
}) {
	return (
		<div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
			{coverUrl && (
				<img src={coverUrl} alt="" className="size-full object-cover" />
			)}
			{asset?.preview_url && (
				<video
					key={asset.preview_url}
					src={asset.preview_url}
					poster={coverUrl ?? undefined}
					autoPlay
					muted
					loop
					playsInline
					disablePictureInPicture
					className="absolute inset-0 size-full object-cover motion-reduce:hidden"
				/>
			)}
		</div>
	);
}

function SpotifyPreview({
	asset,
	coverUrl,
	artistName,
	trackTitle,
}: {
	asset?: ProjectMotionAsset;
	coverUrl: string | null;
	artistName: string;
	trackTitle: string;
}) {
	return (
		<div className="relative mx-auto aspect-[9/19.5] h-[min(62dvh,640px)] overflow-hidden rounded-[30px] bg-black shadow-2xl">
			<ArtworkMedia asset={asset} coverUrl={coverUrl} />
			<div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.42),transparent_26%,transparent_55%,rgba(0,0,0,.82))]" />
			<div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5 text-white">
				<span className="text-xs font-medium text-white/80">
					Playing from Album
				</span>
				<MoreHorizontal className="size-5" />
			</div>
			<div className="absolute inset-x-0 bottom-0 p-5 text-white">
				<div className="flex items-end gap-3">
					{coverUrl && (
						<img
							src={coverUrl}
							alt=""
							className="size-11 rounded-md object-cover"
						/>
					)}
					<div className="min-w-0 flex-1">
						<p className="truncate text-xl font-semibold">{trackTitle}</p>
						<p className="truncate text-sm text-white/70">{artistName}</p>
					</div>
					<div className="flex size-10 items-center justify-center rounded-full bg-white text-black">
						<Play className="size-4" fill="currentColor" />
					</div>
				</div>
				<div className="mt-4 h-1 rounded-full bg-white/35">
					<div className="h-full w-1/3 rounded-full bg-white" />
				</div>
				<div className="mt-5 flex items-center justify-around">
					<Pause className="size-6" fill="currentColor" />
					<Play className="size-11" fill="currentColor" />
					<Film className="size-6" />
				</div>
			</div>
		</div>
	);
}

function ApplePortraitPreview({
	asset,
	coverUrl,
	projectName,
	artistName,
	trackTitle,
}: {
	asset?: ProjectMotionAsset;
	coverUrl: string | null;
	projectName: string;
	artistName: string;
	trackTitle: string;
}) {
	return (
		<div className="relative mx-auto aspect-[9/19.5] w-[min(100%,31.4dvh,320px)] overflow-hidden rounded-[32px] bg-black text-white shadow-2xl">
			<MotionArtworkStage
				presentation="apple-portrait"
				assetUrl={asset?.preview_url}
				coverUrl={coverUrl}
			/>

			<div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.18)_0%,transparent_25%,transparent_46%,rgba(0,0,0,.12)_62%,rgba(0,0,0,.3)_100%)]" />

			<div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5">
				<ChevronDown className="size-5" />
				<span className="max-w-[65%] truncate text-[10px] font-medium text-white/80">
					{projectName}
				</span>
				<MoreHorizontal className="size-5" />
			</div>

			<div className="absolute inset-x-0 top-[55%] px-6">
				<div className="flex items-end gap-3">
					<div className="min-w-0 flex-1">
						<p className="truncate text-xl font-medium">{trackTitle}</p>
						<p className="truncate text-sm text-white/65">{artistName}</p>
					</div>
					<div className="flex gap-2">
						<div className="flex size-9 items-center justify-center rounded-full bg-white/14">
							<Star className="size-4" />
						</div>
						<div className="flex size-9 items-center justify-center rounded-full bg-white/14">
							<MoreHorizontal className="size-4" />
						</div>
					</div>
				</div>

				<div className="mt-5 h-1 rounded-full bg-white/30">
					<div className="h-full w-1/4 rounded-full bg-white/75" />
				</div>
				<div className="mt-2 flex justify-between text-[10px] text-white/45">
					<span>0:12</span>
					<span>-2:24</span>
				</div>
			</div>

			<div className="absolute inset-x-0 top-[73%] flex items-center justify-around px-8">
				<SkipBack className="size-7" fill="currentColor" />
				<Play className="size-12" fill="currentColor" />
				<SkipForward className="size-7" fill="currentColor" />
			</div>

			<div className="absolute inset-x-0 bottom-7 flex items-center justify-around px-12 text-white/65">
				<MessageSquareText className="size-5" />
				<Film className="size-5" />
				<ListMusic className="size-5" />
			</div>
		</div>
	);
}

function SquarePreview({
	asset,
	coverUrl,
}: {
	asset?: ProjectMotionAsset;
	coverUrl: string | null;
}) {
	return (
		<div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl shadow-2xl">
			<ArtworkMedia asset={asset} coverUrl={coverUrl} />
		</div>
	);
}

export default function MotionArtworkModal({
	isOpen,
	onClose,
	projectId,
	projectName,
	artistName,
	trackTitle,
	coverUrl,
	canEdit,
}: MotionArtworkModalProps) {
	const [selectedKind, setSelectedKind] =
		useState<MotionAssetKind>("apple_square");
	const inputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();
	const { data: assets = [], isLoading } = useProjectMotionAssets(projectId);
	const selectedAsset = assets.find((asset) => asset.kind === selectedKind);
	const selectedFormat =
		MOTION_ARTWORK_FORMATS.find((format) => format.kind === selectedKind) ??
		MOTION_ARTWORK_FORMATS[0];
	const checks = useMemo(
		() => (selectedAsset ? getMotionArtworkChecks(selectedAsset) : []),
		[selectedAsset],
	);

	const uploadMutation = useMutation({
		mutationFn: (file: File) =>
			uploadProjectMotionAsset(projectId, selectedKind, file),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: projectMotionAssetKeys.detail(projectId),
			});
			toast.success("Motion artwork ready to preview");
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Motion artwork upload failed",
			),
	});

	const deleteMutation = useMutation({
		mutationFn: () => deleteProjectMotionAsset(projectId, selectedKind),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: projectMotionAssetKeys.detail(projectId),
			});
			toast.success("Motion artwork removed");
		},
		onError: () => toast.error("Failed to remove motion artwork"),
	});

	const busy = uploadMutation.isPending || deleteMutation.isPending;

	return (
		<BaseModal
			isOpen={isOpen}
			onClose={onClose}
			maxWidth="2xl"
			disableClose={busy}
		>
			<div className="flex items-center justify-between border-b border-(--control-border) p-5">
				<div>
					<h2 className="text-lg font-semibold">Motion artwork</h2>
					<p className="text-sm text-(--text-0)/55">Preview before delivery</p>
				</div>
				<Button
					size="icon-lg"
					onClick={onClose}
					aria-label="Close motion artwork"
				>
					<X className="size-5" />
				</Button>
			</div>

			<div className="p-4 sm:p-6">
				<ToggleGroup
					options={MOTION_ARTWORK_FORMATS.map((format) => ({
						value: format.kind,
						label: format.shortLabel,
					}))}
					value={selectedKind}
					onValueChange={(value) => setSelectedKind(value as MotionAssetKind)}
					size="sm"
					className="mb-5 w-full"
					layoutId="motion-artwork-format"
				/>

				<div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
					<div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-[var(--bg-1)] p-3 sm:p-5">
						{isLoading ? (
							<LoaderCircle className="size-7 animate-spin text-(--text-0)/50" />
						) : selectedKind === "apple_square" ? (
							<SquarePreview asset={selectedAsset} coverUrl={coverUrl} />
						) : selectedKind === "apple_portrait" ? (
							<ApplePortraitPreview
								asset={selectedAsset}
								coverUrl={coverUrl}
								projectName={projectName}
								artistName={artistName}
								trackTitle={trackTitle}
							/>
						) : (
							<SpotifyPreview
								asset={selectedAsset}
								coverUrl={coverUrl}
								artistName={artistName}
								trackTitle={trackTitle}
							/>
						)}
					</div>

					<div className="space-y-4">
						<div>
							<h3 className="font-semibold">{selectedFormat.title}</h3>
							<p className="text-sm text-(--text-0)/55">
								{selectedFormat.subtitle}
							</p>
						</div>

						{selectedAsset ? (
							<div className="space-y-2">
								<div
									className={cn(
										"flex items-center gap-2 rounded-xl border p-3 text-sm",
										isMotionArtworkCompliant(selectedAsset)
											? "border-emerald-500/35 bg-emerald-500/10 text-emerald-500"
											: "border-amber-500/35 bg-amber-500/10 text-amber-500",
									)}
								>
									{isMotionArtworkCompliant(selectedAsset) ? (
										<Check className="size-4" />
									) : (
										<CircleAlert className="size-4" />
									)}
									{isMotionArtworkCompliant(selectedAsset)
										? "Matches delivery checks"
										: "Preview works; delivery checks need attention"}
								</div>

								<div className="divide-y divide-(--control-border) rounded-xl border border-(--control-border)">
									{checks.map((check) => (
										<div
											key={check.label}
											className="flex items-center gap-2 px-3 py-2 text-xs"
										>
											{check.passed ? (
												<Check className="size-3.5 text-emerald-500" />
											) : (
												<CircleAlert className="size-3.5 text-amber-500" />
											)}
											<span className="min-w-0 flex-1">{check.label}</span>
											<span className="text-right text-(--text-0)/50">
												{check.detail}
											</span>
										</div>
									))}
								</div>
							</div>
						) : (
							<p className="rounded-xl border border-dashed border-(--control-border) p-4 text-sm text-(--text-0)/55">
								Upload an MP4 or MOV to see it in context.
							</p>
						)}

						{canEdit && (
							<div className="flex gap-2">
								<Button
									className="min-w-0 flex-1"
									onClick={() => inputRef.current?.click()}
									disabled={busy}
								>
									{uploadMutation.isPending ? (
										<LoaderCircle className="size-4 animate-spin" />
									) : (
										<Upload className="size-4" />
									)}
									{selectedAsset ? "Replace" : "Upload"}
								</Button>
								{selectedAsset && (
									<Button
										variant="destructive"
										size="icon"
										onClick={() => deleteMutation.mutate()}
										disabled={busy}
										aria-label="Remove motion artwork"
									>
										<Trash2 className="size-4" />
									</Button>
								)}
								<input
									ref={inputRef}
									type="file"
									accept="video/mp4,video/quicktime,.mov"
									className="hidden"
									onChange={(event) => {
										const file = event.target.files?.[0];
										if (file) uploadMutation.mutate(file);
										event.target.value = "";
									}}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</BaseModal>
	);
}
