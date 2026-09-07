import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	Download,
	FileImage,
	Film,
	History,
	Link2,
	LoaderCircle,
	RefreshCw,
	Save,
	Send,
	Unplug,
	X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import {
	connectTooLost,
	createTooLostDraft,
	disconnectTooLost,
	distributionKeys,
	type ExportProgress,
	exportReleasePackage,
	getArtistProfile,
	getDistributionHistory,
	getReleasePreparation,
	getTooLostLookups,
	getTooLostStatus,
	type ReleaseMetadata,
	type ReleasePreparation,
	type ReleasePreparationResponse,
	type ReleaseValidation,
	type ResolvedTrack,
	refreshDistributionStatus,
	saveReleasePreparation,
	type TrackOverride,
} from "@/api/distribution";
import BaseModal from "@/components/modals/BaseModal";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { CreditsEditor, fieldClass } from "./CreditsEditor";
import {
	fallbackGenres,
	fallbackLanguages,
	withCurrentOption,
} from "./catalog";

type Tab = "release" | "tracks" | "delivery" | "history";

const emptyPreparation = (): ReleasePreparation => ({
	release: {},
	tracks: {},
});
const textAreaClass = `${fieldClass} h-24 resize-y py-2`;

export function PrepareReleaseModal({
	isOpen,
	onClose,
	projectId,
}: {
	isOpen: boolean;
	onClose: () => void;
	projectId: number;
}) {
	const client = useQueryClient();
	const [tab, setTab] = useState<Tab>("release");
	const [draft, setDraft] = useState<ReleasePreparation | null>(null);
	const [actionError, setActionError] = useState("");
	const [providerValidation, setProviderValidation] =
		useState<ReleaseValidation | null>(null);
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState<ExportProgress | null>(
		null,
	);
	const preparation = useQuery({
		queryKey: distributionKeys.preparation(projectId),
		queryFn: () => getReleasePreparation(projectId),
		enabled: isOpen,
	});
	const profile = useQuery({
		queryKey: distributionKeys.profile,
		queryFn: getArtistProfile,
		enabled: isOpen,
	});
	const tooLost = useQuery({
		queryKey: distributionKeys.toolost,
		queryFn: getTooLostStatus,
		enabled: isOpen,
	});
	const tooLostLookups = useQuery({
		queryKey: distributionKeys.toolostLookups,
		queryFn: getTooLostLookups,
		enabled: isOpen && tooLost.data?.connected === true,
		staleTime: 60 * 60 * 1000,
	});
	const history = useQuery({
		queryKey: distributionKeys.history(projectId),
		queryFn: () => getDistributionHistory(projectId),
		enabled: isOpen && tab === "history",
	});

	useEffect(() => {
		if (isOpen && preparation.data)
			setDraft(structuredClone(preparation.data.preparation));
	}, [isOpen, preparation.data]);

	const save = useMutation({
		mutationFn: (value: ReleasePreparation) =>
			saveReleasePreparation(projectId, value),
		onSuccess: (result) => {
			client.setQueryData(distributionKeys.preparation(projectId), result);
			setDraft(structuredClone(result.preparation));
			setProviderValidation(null);
		},
	});
	const connect = useMutation({
		mutationFn: connectTooLost,
		onSuccess: (result) => {
			if (result.url) window.location.assign(result.url);
			else
				setActionError(
					result.message ||
						"Too Lost is not configured on this Vault instance.",
				);
		},
	});
	const disconnect = useMutation({
		mutationFn: disconnectTooLost,
		onSuccess: () =>
			void client.invalidateQueries({ queryKey: distributionKeys.toolost }),
	});
	const send = useMutation({
		mutationFn: async () => {
			if (draft) await save.mutateAsync(draft);
			return createTooLostDraft(projectId);
		},
		onSuccess: (result) => {
			setProviderValidation(result.validation);
			void client.invalidateQueries({
				queryKey: distributionKeys.history(projectId),
			});
			setTab("history");
		},
		onError: (error) => {
			if (error instanceof ApiError && error.data?.validation)
				setProviderValidation(error.data.validation);
			setActionError(error.message);
		},
	});
	const refresh = useMutation({
		mutationFn: (historyId: number) =>
			refreshDistributionStatus(projectId, historyId),
		onSuccess: () =>
			void client.invalidateQueries({
				queryKey: distributionKeys.history(projectId),
			}),
	});

	const response = preparation.data;
	const validation = providerValidation ?? response?.validation;
	const errors =
		validation?.issues.filter((issue) => issue.severity === "error") ?? [];
	const warnings =
		validation?.issues.filter((issue) => issue.severity === "warning") ?? [];
	const ready = useMemo(() => {
		if (!response) return [];
		return [
			response.release.title && "Release title",
			response.release.artist && "Primary artist",
			response.release.tracks.length > 0 &&
				`${response.release.tracks.length} track${response.release.tracks.length === 1 ? "" : "s"}`,
			response.release.artwork && "Cover artwork",
			response.release.credits.length > 0 && "Reusable credits",
		].filter(Boolean) as string[];
	}, [response]);

	const updateRelease = <K extends keyof ReleaseMetadata>(
		key: K,
		value: ReleaseMetadata[K],
	) => {
		setDraft((current) => ({
			...(current ?? emptyPreparation()),
			release: { ...(current?.release ?? {}), [key]: value },
		}));
	};
	const updateTrack = <K extends keyof TrackOverride>(
		trackId: number,
		key: K,
		value: TrackOverride[K],
	) => {
		setDraft((current) => {
			const next = current ?? emptyPreparation();
			const id = String(trackId);
			return {
				...next,
				tracks: {
					...next.tracks,
					[id]: { ...(next.tracks[id] ?? {}), [key]: value },
				},
			};
		});
	};
	const clearTrackField = (trackId: number, key: keyof TrackOverride) => {
		setDraft((current) => {
			if (!current) return current;
			const id = String(trackId);
			const override = { ...(current.tracks[id] ?? {}) };
			delete override[key];
			return { ...current, tracks: { ...current.tracks, [id]: override } };
		});
	};
	const handleExport = async () => {
		setActionError("");
		setIsExporting(true);
		setExportProgress({ phase: "preparing", loaded: 0 });
		try {
			if (draft) await save.mutateAsync(draft);
			const blob = await exportReleasePackage(projectId, setExportProgress);
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${String(response?.release.title || "Release").replace(/[<>:"/\\|?*]/g, "-")}-release-package.zip`;
			anchor.click();
			URL.revokeObjectURL(url);
			void client.invalidateQueries({
				queryKey: distributionKeys.history(projectId),
			});
		} catch (error) {
			if (error instanceof ApiError && error.data?.validation) {
				setProviderValidation(error.data.validation);
			}
			setActionError(
				error instanceof Error
					? error.message
					: "Could not export the release package",
			);
		} finally {
			setIsExporting(false);
			window.setTimeout(() => setExportProgress(null), 1200);
		}
	};
	const languages = tooLostLookups.data?.languages ?? fallbackLanguages;
	const genres = tooLostLookups.data?.genres ?? fallbackGenres;

	return (
		<BaseModal
			isOpen={isOpen}
			onClose={onClose}
			maxWidth="2xl"
			disableClose={save.isPending || send.isPending || isExporting}
		>
			<div className="min-h-0 text-(--text-0)">
				<header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-(--card-border) bg-(--surface-overlay-to) px-5 py-4 sm:px-6">
					<div>
						<p className="text-xs font-medium uppercase text-(--text-2)">
							Distribution
						</p>
						<h2 className="text-2xl font-semibold">Prepare Release</h2>
						<p className="mt-1 text-sm text-(--text-1)">
							Review what Vault knows, then export it or create a distributor
							draft.
						</p>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						aria-label="Close prepare release"
						onClick={onClose}
					>
						<X />
					</Button>
				</header>

				<div
					className="grid grid-cols-4 border-b border-(--card-border) px-2 sm:px-4"
					role="tablist"
					aria-label="Release preparation sections"
				>
					{(["release", "tracks", "delivery", "history"] as Tab[]).map(
						(item) => (
							<button
								key={item}
								type="button"
								role="tab"
								aria-selected={tab === item}
								onClick={() => setTab(item)}
								className={`relative min-w-0 border-b-2 border-transparent px-1 py-3 text-xs font-medium capitalize transition-colors duration-200 sm:text-sm ${tab === item ? "text-(--text-0)" : "text-(--text-2) hover:text-(--text-0)"}`}
							>
								{tab === item && (
									<motion.span
										layoutId="prepare-release-active-tab"
										className="absolute inset-x-1 -bottom-0.5 h-0.5 rounded-full bg-(--accent-blue)"
										transition={{ type: "spring", stiffness: 500, damping: 38 }}
									/>
								)}
								<span className="relative">{item}</span>
							</button>
						),
					)}
				</div>

				{preparation.isPending ? (
					<output className="flex min-h-64 items-center justify-center">
						<LoaderCircle className="mr-2 animate-spin" />
						Loading release...
					</output>
				) : preparation.isError ? (
					<div className="p-6" role="alert">
						<p>{preparation.error.message}</p>
						<Button className="mt-4" onClick={() => void preparation.refetch()}>
							Retry
						</Button>
					</div>
				) : response && draft ? (
					<motion.div
						key={tab}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
						className="p-5 sm:p-6"
					>
						{tab === "release" && (
							<ReleaseTab
								response={response}
								draft={draft}
								profileNames={[
									profile.data?.display_name ?? "",
									profile.data?.legal_name ?? "",
								]}
								ready={ready}
								errors={errors.length}
								warnings={warnings.length}
								languages={languages}
								genres={genres}
								providerCatalog={tooLostLookups.data != null}
								update={updateRelease}
							/>
						)}
						{tab === "tracks" && (
							<TracksTab
								tracks={response.release.tracks}
								draft={draft}
								languages={languages}
								update={updateTrack}
								clear={clearTrackField}
							/>
						)}
						{tab === "delivery" && (
							<div className="space-y-7">
								<ValidationSummary
									validation={validation}
									tracks={response.release.tracks}
								/>
								<section className="border-t border-(--card-border) pt-5">
									<h3 className="text-lg font-semibold">Release Package</h3>
									<p className="mt-1 text-sm text-(--text-1)">
										Original active masters, artwork, metadata, credits,
										checksums, and a README in one ZIP. Vault never modifies
										your masters.
									</p>
									<ArtworkSummary release={response.release} />
									<Button
										className="mt-4"
										onClick={() => void handleExport()}
										disabled={
											!validation?.can_export || save.isPending || isExporting
										}
									>
										{isExporting ? (
											<LoaderCircle className="animate-spin" />
										) : (
											<Download />
										)}
										{isExporting ? "Building package..." : "Export package"}
									</Button>
									{exportProgress && (
										<div className="mt-3 max-w-sm" aria-live="polite">
											<Progress
												value={
													exportProgress.phase === "downloading" &&
													exportProgress.total
														? (exportProgress.loaded / exportProgress.total) *
															100
														: undefined
												}
											/>
											<p className="mt-1.5 text-xs text-(--text-2)">
												{exportProgress.phase === "preparing"
													? "Collecting masters, artwork, metadata, and checksums..."
													: exportProgress.total
														? `Downloading ${Math.round((exportProgress.loaded / exportProgress.total) * 100)}%`
														: "Downloading release package..."}
											</p>
										</div>
									)}
								</section>
								<section className="border-t border-(--card-border) pt-5">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<h3 className="text-lg font-semibold">Too Lost</h3>
											<p className="mt-1 text-sm text-(--text-1)">
												Vault creates or updates a draft and sends the square
												cover when available. Stores, territories, licensing,
												review, and final submission stay in Too Lost.
											</p>
										</div>
										<span className="rounded-full border border-(--card-border) px-2.5 py-1 text-xs text-(--text-1)">
											{tooLost.data?.connected
												? `Connected (${tooLost.data.environment})`
												: tooLost.data?.configured
													? "Not connected"
													: "Not configured"}
										</span>
									</div>
									{tooLost.data?.configured === false && (
										<button
											type="button"
											style={{ width: "100%", maxWidth: "none" }}
											onClick={() => {
												onClose();
												window.location.assign("/profile#too-lost-settings");
											}}
											className="mt-4 flex w-full items-center gap-3 rounded-[var(--button-radius)] border border-(--card-border) bg-(--action-bg) p-3 text-left text-sm text-(--text-1) transition-[border-color,background-color] hover:border-(--button-hot-border) hover:bg-(--action-bg-hover)"
										>
											<div className="min-w-0 flex-1">
												<p className="font-medium text-(--text-0)">
													OAuth setup required
												</p>
												<p className="mt-1">
													Add the Too Lost client credentials and public HTTPS
													URL in Settings.
												</p>
											</div>
											<ChevronRight className="size-4 shrink-0" />
										</button>
									)}
									<div className="mt-4 flex items-center gap-3 rounded-[var(--button-radius)] border border-(--card-border) bg-(--action-bg) p-3">
										<FileImage className="size-4 shrink-0 text-(--text-1)" />
										<div className="min-w-0 flex-1">
											<p className="text-sm font-medium">Static square cover</p>
											<p className="text-xs text-(--text-2)">
												{response.release.artwork
													? `${response.release.artwork.filename} will be sent with the Too Lost draft.`
													: "No cover is available to send. Add one to the album before creating the draft."}
											</p>
										</div>
										<span className="shrink-0 text-xs font-medium text-(--text-1)">
											{response.release.artwork ? "Included" : "Missing"}
										</span>
									</div>
									{response.release.motion_artwork.length > 0 && (
										<p className="mt-3 text-xs text-(--text-2)">
											Apple motion artwork is included in the Release Package.
											Too Lost's published API does not define a stable MP4
											upload contract for it yet, so complete that step in Too
											Lost.
										</p>
									)}
									<div className="mt-4 flex flex-wrap gap-2">
										{tooLost.data?.connected ? (
											<>
												<Button
													onClick={() => {
														setActionError("");
														send.mutate();
													}}
													disabled={send.isPending}
												>
													<Send />
													{send.isPending
														? "Preparing draft..."
														: "Create or update Too Lost draft"}
												</Button>
												<Button
													variant="outline"
													onClick={() => disconnect.mutate()}
													disabled={disconnect.isPending}
												>
													<Unplug />
													Disconnect
												</Button>
											</>
										) : (
											<Button
												onClick={() => connect.mutate()}
												disabled={
													connect.isPending ||
													tooLost.isPending ||
													tooLost.data?.configured === false
												}
											>
												<Link2 />
												Connect Too Lost
											</Button>
										)}
									</div>
								</section>
							</div>
						)}
						{tab === "history" && (
							<section>
								<div className="mb-4 flex items-center justify-between">
									<div>
										<h3 className="text-lg font-semibold">
											Distribution history
										</h3>
										<p className="text-sm text-(--text-1)">
											Exports and distributor drafts keep the exact metadata and
											asset hashes used at that moment.
										</p>
									</div>
									<History className="text-(--text-2)" />
								</div>
								{history.isPending ? (
									<output>Loading history...</output>
								) : history.data?.length ? (
									<div className="divide-y divide-(--card-border)">
										{history.data.map((entry) => (
											<div key={entry.id} className="py-4">
												<div className="flex items-start justify-between gap-3">
													<div>
														<p className="font-medium">
															{entry.kind === "export"
																? "Release Package"
																: "Too Lost draft"}
														</p>
														<p className="text-sm text-(--text-1)">
															{new Date(entry.created_at).toLocaleString()} ·{" "}
															{entry.status}
															{entry.provider_status
																? ` · ${entry.provider_status}`
																: ""}
														</p>
														{entry.remote_id && (
															<p className="mt-1 font-mono text-xs text-(--text-2)">
																ID {entry.remote_id}
															</p>
														)}
													</div>
													{entry.provider === "toolost" &&
														entry.remote_id &&
														tooLost.data?.connected && (
															<Button
																size="icon"
																variant="ghost"
																title="Refresh Too Lost status"
																aria-label="Refresh Too Lost status"
																onClick={() => refresh.mutate(entry.id)}
															>
																<RefreshCw
																	className={
																		refresh.isPending ? "animate-spin" : ""
																	}
																/>
															</Button>
														)}
												</div>
												{entry.message && (
													<p className="mt-2 text-sm text-(--text-1)">
														{entry.message}
													</p>
												)}
											</div>
										))}
									</div>
								) : (
									<p className="py-10 text-center text-(--text-2)">
										No release operations yet.
									</p>
								)}
							</section>
						)}
						{actionError && (
							<p className="mt-5 text-sm text-red-500" role="alert">
								{actionError}
							</p>
						)}
						{(tab === "release" || tab === "tracks") && (
							<div className="mt-7 flex items-center justify-end gap-3 border-t border-(--card-border) pt-5">
								<Button
									onClick={() => draft && save.mutate(draft)}
									disabled={save.isPending}
								>
									<Save />
									{save.isPending ? "Saving..." : "Save preparation"}
								</Button>
							</div>
						)}
					</motion.div>
				) : null}
			</div>
		</BaseModal>
	);
}

function ReleaseTab({
	response,
	draft,
	profileNames,
	ready,
	errors,
	warnings,
	languages,
	genres,
	providerCatalog,
	update,
}: {
	response: ReleasePreparationResponse;
	draft: ReleasePreparation;
	profileNames: string[];
	ready: string[];
	errors: number;
	warnings: number;
	languages: { code: string; name: string }[];
	genres: string[];
	providerCatalog: boolean;
	update: <K extends keyof ReleaseMetadata>(
		key: K,
		value: ReleaseMetadata[K],
	) => void;
}) {
	const profileNamesId = useId();
	const resolved = response.release;
	const value = <K extends keyof ReleaseMetadata>(key: K) =>
		draft.release[key] ?? resolved[key];
	const language = String(value("language") ?? "");
	const selectedGenres = (value("genres") ?? []) as string[];
	return (
		<div className="space-y-7">
			<section className="grid gap-4 sm:grid-cols-2">
				<div>
					<p className="flex items-center gap-2 font-medium">
						<CheckCircle2 className="size-4 text-emerald-500" />
						Ready
					</p>
					<p className="mt-2 text-sm text-(--text-1)">
						{ready.join(" · ") || "Add the core release details below."}
					</p>
				</div>
				<div>
					<p className="flex items-center gap-2 font-medium">
						<AlertCircle className="size-4 text-amber-500" />
						Needs attention
					</p>
					<p className="mt-2 text-sm text-(--text-1)">
						{errors} blocking · {warnings} to review
					</p>
				</div>
			</section>
			<section className="grid gap-4 border-t border-(--card-border) pt-5 sm:grid-cols-2">
				<Field label="Release title">
					<Input
						value={String(value("title") ?? "")}
						onChange={(e) => update("title", e.target.value)}
					/>
				</Field>
				<Field label="Primary artist">
					<Input
						list={profileNamesId}
						value={String(value("artist") ?? "")}
						onChange={(e) => update("artist", e.target.value)}
					/>
					<datalist id={profileNamesId}>
						{profileNames.filter(Boolean).map((name) => (
							<option key={name} value={name} />
						))}
					</datalist>
				</Field>
				<Field label="Release type">
					<ValueSelect
						value={String(value("release_type") ?? "")}
						placeholder="Choose release type"
						options={["Single", "EP", "Album", "Compilation"]}
						onChange={(next) => update("release_type", next)}
					/>
				</Field>
				<Field label="Metadata language">
					<ValueSelect
						value={language}
						placeholder="Choose language"
						options={withCurrentOption(
							languages.map((item) => item.code),
							language,
						)}
						labels={Object.fromEntries(
							languages.map((item) => [
								item.code,
								`${item.name} (${item.code})`,
							]),
						)}
						onChange={(next) => update("language", next)}
					/>
				</Field>
				<Field label="Release date">
					<DatePicker
						value={String(value("release_date") ?? "")}
						onValueChange={(next) => update("release_date", next)}
					/>
				</Field>
				<Field label="Original release date (optional)">
					<DatePicker
						value={String(value("original_release_date") ?? "")}
						onValueChange={(next) => update("original_release_date", next)}
					/>
					<small className="text-(--text-2)">
						Leave blank when this is the release's first publication.
					</small>
				</Field>
				<Field label="Primary genre">
					<ValueSelect
						value={selectedGenres[0] ?? ""}
						placeholder="Choose primary genre"
						options={withCurrentOption(genres, selectedGenres[0])}
						onChange={(next) =>
							update("genres", [next, selectedGenres[1]].filter(Boolean))
						}
					/>
				</Field>
				<Field label="Secondary genre (optional)">
					<ValueSelect
						value={selectedGenres[1] ?? ""}
						placeholder="No secondary genre"
						allowEmpty
						options={withCurrentOption(
							genres.filter((genre) => genre !== selectedGenres[0]),
							selectedGenres[1],
						)}
						onChange={(next) =>
							update("genres", [selectedGenres[0], next].filter(Boolean))
						}
					/>
					<small className="text-(--text-2)">
						{providerCatalog
							? "Genres loaded from Too Lost."
							: "Connect Too Lost to refresh its full genre catalog."}
					</small>
				</Field>
				<Field label="Label">
					<Input
						value={String(value("label") ?? "")}
						onChange={(e) => update("label", e.target.value)}
					/>
				</Field>
				<Field label="Copyright (C-line)">
					<Input
						value={String(value("copyright") ?? "")}
						onChange={(e) => update("copyright", e.target.value)}
					/>
				</Field>
				<Field label="Phonographic copyright (P-line)">
					<Input
						value={String(value("phonographic_copyright") ?? "")}
						onChange={(e) => update("phonographic_copyright", e.target.value)}
					/>
				</Field>
				<Field label="Existing UPC (optional)">
					<Input
						value={String(value("upc") ?? "")}
						onChange={(e) => update("upc", e.target.value)}
						inputMode="numeric"
					/>
					<small className="text-(--text-2)">
						Leave blank for the distributor to assign one.
					</small>
				</Field>
			</section>
			<section className="border-t border-(--card-border) pt-5">
				<div className="mb-3 flex items-center justify-between gap-3">
					<div>
						<h3 className="font-semibold">Release credits</h3>
						<p className="text-sm text-(--text-1)">
							Inherited by every track unless that track has an override.
						</p>
					</div>
					{draft.release.credits !== undefined && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => update("credits", undefined)}
						>
							Use profile defaults
						</Button>
					)}
				</div>
				<CreditsEditor
					value={(value("credits") ?? []) as { name: string; role: string }[]}
					onChange={(credits) => update("credits", credits)}
				/>
			</section>
		</div>
	);
}

function TracksTab({
	tracks,
	draft,
	languages,
	update,
	clear,
}: {
	tracks: ResolvedTrack[];
	draft: ReleasePreparation;
	languages: { code: string; name: string }[];
	update: <K extends keyof TrackOverride>(
		trackId: number,
		key: K,
		value: TrackOverride[K],
	) => void;
	clear: (trackId: number, key: keyof TrackOverride) => void;
}) {
	return (
		<div className="divide-y divide-(--card-border)">
			{tracks.map((track) => {
				const override = draft.tracks[String(track.track_id)] ?? {};
				const value = <K extends keyof TrackOverride>(key: K) =>
					override[key] ?? track[key];
				const hasCreditOverride = override.credits !== undefined;
				const language = String(value("language") ?? "");
				return (
					<details key={track.track_id} className="py-4 first:pt-0">
						<summary className="cursor-pointer font-medium">
							<span className="mr-3 font-mono text-sm text-(--text-2)">
								{track.number}
							</span>
							{String(value("title") ?? track.title)}
						</summary>
						<div className="mt-4 grid gap-4 pl-0 sm:grid-cols-2 sm:pl-7">
							<Field label="Title">
								<Input
									value={String(value("title") ?? "")}
									onChange={(e) =>
										update(track.track_id, "title", e.target.value)
									}
								/>
							</Field>
							<Field label="Artist">
								<Input
									value={String(value("artist") ?? "")}
									onChange={(e) =>
										update(track.track_id, "artist", e.target.value)
									}
								/>
							</Field>
							<Field label="Language">
								<ValueSelect
									value={language}
									placeholder="Choose language"
									options={withCurrentOption(
										languages.map((item) => item.code),
										language,
									)}
									labels={Object.fromEntries(
										languages.map((item) => [
											item.code,
											`${item.name} (${item.code})`,
										]),
									)}
									onChange={(next) => update(track.track_id, "language", next)}
								/>
							</Field>
							<Field label="Explicit">
								<ValueSelect
									value={
										override.explicit == null
											? "unknown"
											: override.explicit
												? "explicit"
												: "clean"
									}
									placeholder="Not set"
									onChange={(next) =>
										next === "unknown"
											? clear(track.track_id, "explicit")
											: update(track.track_id, "explicit", next === "explicit")
									}
									options={["unknown", "clean", "explicit"]}
									labels={{
										unknown: "Not set",
										clean: "Clean",
										explicit: "Explicit",
									}}
								/>
							</Field>
							<Field label="Existing ISRC (optional)">
								<Input
									value={String(value("isrc") ?? "")}
									onChange={(e) =>
										update(track.track_id, "isrc", e.target.value)
									}
								/>
								<small className="text-(--text-2)">
									Leave blank for the distributor to assign one.
								</small>
							</Field>
							<Field label="Lyrics" className="sm:col-span-2">
								<textarea
									className={textAreaClass}
									value={String(value("lyrics") ?? "")}
									onChange={(e) =>
										update(track.track_id, "lyrics", e.target.value)
									}
								/>
							</Field>
							<div className="sm:col-span-2">
								<label className="mb-3 flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={hasCreditOverride}
										onChange={(e) =>
											e.target.checked
												? update(track.track_id, "credits", track.credits)
												: clear(track.track_id, "credits")
										}
									/>
									Override inherited credits for this track
								</label>
								{hasCreditOverride && (
									<CreditsEditor
										value={override.credits ?? []}
										onChange={(credits) =>
											update(track.track_id, "credits", credits)
										}
									/>
								)}
							</div>
						</div>
					</details>
				);
			})}
		</div>
	);
}

function ArtworkSummary({
	release,
}: {
	release: ReleasePreparationResponse["release"];
}) {
	const motionLabels: Record<string, string> = {
		apple_square: "Apple Motion 1x1",
		apple_portrait: "Apple Motion 3x4",
		spotify_canvas: "Spotify Canvas",
	};
	return (
		<div className="mt-4 grid gap-2 sm:grid-cols-2">
			<div className="flex items-center gap-3 rounded-[var(--button-radius)] border border-(--card-border) bg-(--action-bg) p-3">
				<FileImage className="size-4 shrink-0 text-(--text-1)" />
				<div className="min-w-0">
					<p className="text-sm font-medium">Square cover</p>
					<p className="truncate text-xs text-(--text-2)">
						{release.artwork?.filename ?? "Not available"}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-3 rounded-[var(--button-radius)] border border-(--card-border) bg-(--action-bg) p-3">
				<Film className="size-4 shrink-0 text-(--text-1)" />
				<div className="min-w-0">
					<p className="text-sm font-medium">Motion artwork</p>
					<p className="truncate text-xs text-(--text-2)">
						{release.motion_artwork.length
							? release.motion_artwork
									.map((item) => motionLabels[item.kind] ?? item.kind)
									.join(", ")
							: "Not available"}
					</p>
				</div>
			</div>
		</div>
	);
}

function ValueSelect({
	value,
	placeholder,
	options,
	labels = {},
	allowEmpty = false,
	onChange,
}: {
	value: string;
	placeholder: string;
	options: string[];
	labels?: Record<string, string>;
	allowEmpty?: boolean;
	onChange: (value: string) => void;
}) {
	const emptyValue = "__vault_empty__";
	return (
		<Select
			value={value || emptyValue}
			onValueChange={(next) => onChange(next === emptyValue ? "" : next)}
		>
			<SelectTrigger>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{(allowEmpty || !value) && (
					<SelectItem value={emptyValue}>{placeholder}</SelectItem>
				)}
				{options.map((option) => (
					<SelectItem key={option} value={option}>
						{labels[option] ?? option}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function ValidationSummary({
	validation,
	tracks,
}: {
	validation?: ReleaseValidation;
	tracks: ResolvedTrack[];
}) {
	if (!validation) return null;
	return (
		<section>
			<h3 className="text-lg font-semibold">Release readiness</h3>
			<p className="mt-1 text-sm text-(--text-1)">
				{validation.can_send
					? "Vault has enough information to prepare a distributor draft."
					: "Resolve the blocking items before sending this release."}
			</p>
			{validation.issues.length > 0 ? (
				<ul className="mt-4 space-y-2">
					{validation.issues.map((issue, index) => (
						<li
							key={`${issue.code}-${issue.track_id ?? 0}-${index}`}
							className="flex gap-2 text-sm"
						>
							<span
								aria-hidden
								className={
									issue.severity === "error" ? "text-red-500" : "text-amber-500"
								}
							>
								●
							</span>
							<span>
								<strong>
									{issue.track_id
										? `${tracks.find((track) => track.track_id === issue.track_id)?.title ?? "Track"}: `
										: ""}
								</strong>
								{issue.message}
								{issue.remediation === "complete_in_provider" && (
									<span className="text-(--text-2)">
										{" "}
										Complete in Too Lost.
									</span>
								)}
							</span>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-4 flex items-center gap-2 text-sm text-emerald-500">
					<CheckCircle2 className="size-4" />
					Ready to prepare
				</p>
			)}
		</section>
	);
}

function Field({
	label,
	children,
	className = "",
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: children contain the shared Input component or a native form control.
		<label className={`min-w-0 space-y-1 text-sm ${className}`}>
			<span className="block text-(--text-1)">{label}</span>
			{children}
		</label>
	);
}
