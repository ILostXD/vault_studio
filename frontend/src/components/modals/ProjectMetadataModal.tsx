import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Download,
	ImageIcon,
	Library,
	LoaderCircle,
	Music,
	Save,
	X,
} from "lucide-react";
import { useState } from "react";
import {
	downloadTaggedAlbum,
	downloadTaggedTrack,
	getAudioMetadata,
	type ProjectAudioMetadata,
	publishAlbum,
	saveAudioMetadata,
} from "@/api/audioMetadata";
import { downloadTrack, updateTrack } from "@/api/tracks";
import { Button } from "@/components/ui/button";
import { DisclosureSummary } from "@/components/ui/disclosure-summary";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { projectKeys, useExportProject } from "@/hooks/useProjects";
import { plural } from "@/lib/utils";
import BaseModal from "./BaseModal";

export default function ProjectMetadataModal({
	projectId,
	projectPublicId,
	projectName,
	coverUrl,
	isOwned = true,
	onClose,
}: {
	projectId: number;
	projectPublicId?: string;
	projectName?: string;
	coverUrl?: string | null;
	isOwned?: boolean;
	onClose: () => void;
}) {
	const client = useQueryClient();
	const [mode, setMode] = useState<"tagged" | "raw">("tagged");
	const [selectedFormat, setSelectedFormat] = useState<string>();
	const queryKey = ["project-audio-metadata", projectId, selectedFormat];
	const query = useQuery({
		queryKey,
		queryFn: () => getAudioMetadata(projectId, selectedFormat),
		refetchOnWindowFocus: false,
	});

	const [draft, setDraft] = useState<ProjectAudioMetadata | null>(null);
	const [selectedId, setSelectedId] = useState<number>();
	const [saving, setSaving] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [progress, setProgress] = useState<number>();
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [trackDraft, setTrackDraft] = useState<{
		artist: string;
		album: string;
	} | null>(null);
	const [downloadingRawId, setDownloadingRawId] = useState<number | null>(null);

	const exportProject = useExportProject();

	const data = query.data;
	const activeFormat = selectedFormat || data?.target_format || "flac";
	const fields = draft ?? data?.metadata;
	const dirty =
		!!draft && JSON.stringify(draft) !== JSON.stringify(data?.metadata);
	const selected =
		data?.tracks.find((track) => track.track_id === selectedId) ??
		data?.tracks[0];
	const busy =
		saving ||
		downloading ||
		publishing ||
		exportProject.isPending ||
		downloadingRawId !== null;
	const albumReady =
		!!data?.tracks.length && data.tracks.every((track) => track.can_download);

	async function save() {
		if (!fields || !isOwned) return;
		setSaving(true);
		setError("");
		setMessage("");
		try {
			const result = await saveAudioMetadata(projectId, fields, activeFormat);
			client.setQueryData(queryKey, result);
			setDraft(null);
			await client.invalidateQueries({ queryKey: projectKeys.all });
			setMessage("Project metadata saved.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save metadata.");
		} finally {
			setSaving(false);
		}
	}

	async function download(album = false) {
		if (!selected || !data || dirty || trackDraft || busy) return;
		setDownloading(true);
		setProgress(undefined);
		setError("");
		setMessage(
			album
				? `Preparing ${data.tracks.length} tagged tracks and artwork...`
				: "Preparing tagged copy...",
		);
		try {
			const onProgress = (loaded: number, total?: number) => {
				setProgress(total ? (loaded / total) * 100 : undefined);
				setMessage(
					total
						? `Downloading ${Math.round((loaded / total) * 100)}%`
						: "Downloading tagged audio...",
				);
			};
			const result = album
				? await downloadTaggedAlbum(projectId, data, onProgress, activeFormat)
				: await downloadTaggedTrack(
						projectId,
						selected,
						onProgress,
						activeFormat,
					);
			setMessage(
				result.cancelled
					? "Download cancelled."
					: album
						? "Album downloaded. Originals unchanged."
						: "Tagged copy downloaded. Original unchanged.",
			);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Could not download tagged copy.",
			);
			setMessage("");
		} finally {
			setDownloading(false);
		}
	}

	async function publish() {
		if (!data || dirty || trackDraft || busy || !albumReady || !isOwned) return;
		setPublishing(true);
		setProgress(undefined);
		setError("");
		setMessage(
			`Preparing ${data.tracks.length} tagged tracks for your server music library...`,
		);
		try {
			const library = await publishAlbum(
				projectId,
				data.revision,
				activeFormat,
			);
			client.setQueryData(queryKey, { ...data, library });
			setMessage(
				`Album published to ${library.folder}. Your music player can now scan that folder. Originals unchanged.`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not publish album.");
			setMessage("");
		} finally {
			setPublishing(false);
		}
	}

	async function saveTrackOverrides() {
		if (!selected || !trackDraft || !isOwned) return;
		setSaving(true);
		setError("");
		try {
			await updateTrack(selected.public_id, trackDraft);
			await client.invalidateQueries({ queryKey: ["tracks"] });
			await query.refetch();
			setTrackDraft(null);
			setMessage("Track overrides saved.");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Could not save track overrides.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleDownloadRawAlbum() {
		if (!projectPublicId) return;
		try {
			const result = await exportProject.mutateAsync({
				id: projectPublicId,
				projectName: projectName || data?.metadata.album || "project",
			});
			setMessage(
				result.cancelled ? "Download cancelled." : "Raw project downloaded.",
			);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to export raw project.",
			);
		}
	}

	async function handleDownloadRawTrack(
		publicId: string,
		versionId: number,
		trackNumber: number,
	) {
		setDownloadingRawId(trackNumber);
		setError("");
		try {
			const result = await downloadTrack(publicId, versionId);
			setMessage(
				result.cancelled
					? "Download cancelled."
					: "Raw master track downloaded.",
			);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to download raw master track.",
			);
		} finally {
			setDownloadingRawId(null);
		}
	}

	return (
		<BaseModal isOpen onClose={onClose} maxWidth="2xl" disableClose={busy}>
			<div className="p-5 sm:p-6">
				<header className="mb-4 flex items-center justify-between gap-4">
					<h2 className="text-xl font-semibold">Export & Library</h2>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Close export & library"
						disabled={busy}
						onClick={onClose}
					>
						<X className="size-4" />
					</Button>
				</header>

				{/* Mode switcher tabs using Settings ToggleGroup */}
				<div className="mb-5">
					<ToggleGroup
						className="w-full"
						options={[
							{ label: "Library Ready (Tagged)", value: "tagged" },
							{ label: "Raw Masters", value: "raw" },
						]}
						value={mode}
						onValueChange={(val) => {
							if (busy) return;
							setMode(val as "tagged" | "raw");
							setMessage("");
						}}
					/>
				</div>

				{query.isPending && (
					<p role="status" className="text-sm text-(--text-2)">
						Loading project details...
					</p>
				)}
				{query.isError && (
					<div role="alert" className="text-sm text-(--danger-0)">
						Could not load project metadata.{" "}
						<Button variant="ghost" onClick={() => query.refetch()}>
							Retry
						</Button>
					</div>
				)}

				{fields && data && (
					<>
						{/* Project Overview Header */}
						<div className="mb-5 flex min-w-0 items-center gap-3">
							{data.artwork && coverUrl ? (
								<img
									src={coverUrl}
									alt="Project artwork"
									className="size-16 shrink-0 rounded-md object-cover"
									decoding="async"
								/>
							) : (
								<ImageIcon className="size-12 shrink-0 text-(--text-2)" />
							)}
							<div className="min-w-0">
								<p className="truncate font-semibold">{data.metadata.album}</p>
								<p className="truncate text-sm text-(--text-2)">
									{data.metadata.artist}
								</p>
								<p className="text-xs text-(--text-2)">
									{plural(data.tracks.length, "track")} ·{" "}
									{data.artwork ? "Cover included" : "No cover"}
								</p>
							</div>
						</div>

						{/* MODE: LIBRARY READY (TAGGED) */}
						{mode === "tagged" && (
							<>
								{/* Format selection using ToggleGroup if choices exist */}
								{data.available_formats &&
									data.available_formats.length > 1 && (
										<div className="mb-5">
											<ToggleGroup
												className="w-full"
												options={data.available_formats.map((fmt) => ({
													label:
														fmt === "flac"
															? "FLAC (Lossless)"
															: fmt === "mp3"
																? "MP3 (320 kbps)"
																: "Original",
													value: fmt,
												}))}
												value={activeFormat}
												onValueChange={(val) => {
													if (!busy) setSelectedFormat(val);
												}}
											/>
										</div>
									)}

								{/* Primary Action Buttons */}
								<div className="mb-5 flex flex-wrap gap-3">
									<Button
										onClick={() => download(true)}
										disabled={busy || dirty || !!trackDraft || !albumReady}
									>
										<Download className="size-4" />
										Download album
									</Button>
									<Button
										onClick={publish}
										disabled={
											busy ||
											dirty ||
											!!trackDraft ||
											!albumReady ||
											!isOwned ||
											!data.library?.configured ||
											!!data.library?.problem
										}
									>
										<Library className="size-4" />
										{data.library?.published_at
											? "Update music library"
											: "Add to music library"}
									</Button>
								</div>

								{/* Status alerts */}
								{data.library?.problem && (
									<p role="alert" className="mb-3 text-sm text-(--danger-0)">
										{data.library.problem}
									</p>
								)}
								{data.library?.current && data.library?.published_at && (
									<p className="mb-3 text-xs text-(--text-2)">
										Music library is up to date (last published{" "}
										{new Date(data.library.published_at).toLocaleString()}).
									</p>
								)}
								{dirty && (
									<p className="mb-3 text-xs text-(--text-2)">
										Save metadata changes before downloading or publishing.
									</p>
								)}

								{(downloading || publishing) && (
									<Progress value={progress} className="mb-3" />
								)}
								{message && (
									<p role="status" className="mb-4 text-sm text-(--text-2)">
										{message}
									</p>
								)}
								{error && (
									<p role="alert" className="mb-4 text-sm text-(--danger-0)">
										{error}
									</p>
								)}

								{/* Album Tags Collapsible */}
								<details className="group/disclosure border-t border-(--card-border) py-1">
									<DisclosureSummary>Album tags</DisclosureSummary>
									<form
										className="pt-3 pb-4"
										onSubmit={(event) => {
											event.preventDefault();
											void save();
										}}
									>
										<fieldset
											disabled={busy || !isOwned}
											className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
										>
											{(
												[
													["album", "Album"],
													["artist", "Artist"],
													["album_artist", "Album artist"],
													["genre", "Genre"],
													["year", "Year"],
												] as const
											).map(([key, label]) => (
												<label
													key={key}
													className="grid min-w-0 gap-1.5 text-sm text-(--text-2)"
												>
													{label}
													<Input
														value={fields[key]}
														required={key === "album"}
														maxLength={key === "year" ? 4 : 512}
														inputMode={key === "year" ? "numeric" : undefined}
														pattern={key === "year" ? "[0-9]{4}" : undefined}
														placeholder={
															key === "album_artist"
																? fields.artist || "Same as project artist"
																: undefined
														}
														onChange={(event) => {
															setDraft({
																...fields,
																[key]: event.target.value,
															});
															setMessage("");
														}}
													/>
												</label>
											))}
										</fieldset>
										{isOwned && (
											<div className="mt-5 flex flex-wrap items-center gap-3">
												<Button type="submit" disabled={busy || !dirty}>
													{saving ? (
														<LoaderCircle className="size-4 animate-spin" />
													) : (
														<Save className="size-4" />
													)}
													Save metadata
												</Button>
												{dirty && (
													<span className="text-xs text-(--text-2)">
														Unsaved changes
													</span>
												)}
											</div>
										)}
									</form>
								</details>

								{/* Individual Tracks & Overrides Collapsible */}
								<details className="group/disclosure border-t border-(--card-border) pt-1">
									<DisclosureSummary>
										Individual tracks & overrides
									</DisclosureSummary>
									<div className="pt-3">
										{selected ? (
											<>
												<Select
													value={String(selected.track_id)}
													onValueChange={(value) => {
														setSelectedId(Number(value));
														setTrackDraft(null);
													}}
													disabled={busy || !!trackDraft}
												>
													<SelectTrigger aria-label="Track preview">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{data.tracks.map((track) => (
															<SelectItem
																key={track.track_id}
																value={String(track.track_id)}
															>
																{track.track_number}. {track.title}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<dl
													className="my-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm"
													aria-label="Saved track metadata"
												>
													{(
														[
															["Title", selected.title],
															["Artist", selected.artist],
															["Album", selected.album],
															["Album artist", selected.album_artist],
															["Track number", String(selected.track_number)],
															["Genre", selected.genre],
															["Year", selected.year],
															["Version", selected.version_name],
															[
																"Artwork",
																selected.artwork ? "Project cover" : "None",
															],
															[
																"Format",
																selected.conversion
																	? `${selected.source_format.toUpperCase()} → ${selected.format.toUpperCase()}`
																	: selected.format.toUpperCase(),
															],
														] as const
													).map(([label, val]) => (
														<div key={label} className="contents">
															<dt className="text-(--text-2)">{label}</dt>
															<dd className="min-w-0 break-words">
																{val || "Not set"}
															</dd>
														</div>
													))}
													{selected.conversion && (
														<div className="contents">
															<dt className="text-(--text-2)">Conversion</dt>
															<dd className="min-w-0 break-words text-xs text-(--text-2)">
																{selected.conversion}
															</dd>
														</div>
													)}
												</dl>
												{isOwned && (
													<details className="group/disclosure mb-4 border-y border-(--card-border) py-1">
														<DisclosureSummary>
															Track overrides
														</DisclosureSummary>
														<div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
															{(["artist", "album"] as const).map((key) => (
																<label
																	key={key}
																	className="grid min-w-0 gap-1.5 text-sm text-(--text-2)"
																>
																	{key === "artist"
																		? "Track artist"
																		: "Track album"}
																	<Input
																		disabled={busy}
																		maxLength={512}
																		value={
																			trackDraft?.[key] ??
																			selected[`${key}_override`]
																		}
																		placeholder={
																			data.metadata[key] || "Inherit project"
																		}
																		onChange={(event) =>
																			setTrackDraft({
																				artist: selected.artist_override,
																				album: selected.album_override,
																				...trackDraft,
																				[key]: event.target.value,
																			})
																		}
																	/>
																</label>
															))}
														</div>
														<Button
															className="mt-3"
															onClick={saveTrackOverrides}
															disabled={busy || !trackDraft}
														>
															<Save className="size-4" />
															Save track overrides
														</Button>
														{trackDraft && (
															<Button
																className="mt-3 ml-2"
																variant="ghost"
																disabled={busy}
																onClick={() => setTrackDraft(null)}
															>
																Cancel
															</Button>
														)}
													</details>
												)}
												{selected.reason && (
													<p className="mb-4 text-sm text-(--text-2)">
														{selected.reason}
													</p>
												)}
												{dirty && (
													<p className="mb-4 text-sm text-(--text-2)">
														Save changes to refresh this preview.
													</p>
												)}
												<Button
													onClick={() => download()}
													disabled={
														busy ||
														dirty ||
														!!trackDraft ||
														!selected.can_download
													}
												>
													{downloading ? (
														<LoaderCircle className="size-4 animate-spin" />
													) : (
														<Download className="size-4" />
													)}
													Download tagged copy
												</Button>
											</>
										) : (
											<p className="text-sm text-(--text-2)">
												No tracks in this project.
											</p>
										)}
									</div>
								</details>
							</>
						)}

						{/* MODE: RAW MASTERS */}
						{mode === "raw" && (
							<div className="space-y-4">
								{projectPublicId && (
									<div className="flex flex-wrap gap-3">
										<Button
											onClick={handleDownloadRawAlbum}
											disabled={busy || exportProject.isPending}
										>
											{exportProject.isPending ? (
												<LoaderCircle className="size-4 animate-spin" />
											) : (
												<Download className="size-4" />
											)}
											Download raw project (ZIP)
										</Button>
									</div>
								)}

								{message && (
									<p role="status" className="text-sm text-(--text-2)">
										{message}
									</p>
								)}
								{error && (
									<p role="alert" className="text-sm text-(--danger-0)">
										{error}
									</p>
								)}

								{/* Raw Track List */}
								<div className="divide-y divide-(--card-border) rounded-lg border border-(--card-border) bg-card/20">
									<div className="px-3.5 py-2 text-xs font-semibold text-(--text-2) uppercase tracking-wider">
										Project Tracks ({data.tracks.length})
									</div>
									{data.tracks.length === 0 ? (
										<div className="p-4 text-sm text-(--text-2)">
											No tracks in this project.
										</div>
									) : (
										data.tracks.map((track) => (
											<div
												key={track.track_id}
												className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-(--hover-overlay)/40 transition-colors"
											>
												<div className="flex min-w-0 items-center gap-3">
													<Music className="size-4 shrink-0 text-(--text-2)" />
													<div className="min-w-0">
														<p className="truncate font-medium text-foreground">
															{track.track_number}. {track.title}
														</p>
														<p className="text-xs text-(--text-2)">
															Version: {track.version_name || "Active"} ·
															Format:{" "}
															<span className="font-mono uppercase">
																{track.source_format}
															</span>
														</p>
													</div>
												</div>
												<Button
													variant="outline"
													size="sm"
													disabled={
														busy ||
														!(track.can_download_raw ?? track.can_download)
													}
													onClick={() =>
														handleDownloadRawTrack(
															track.public_id,
															track.version_id,
															track.track_number,
														)
													}
												>
													{downloadingRawId === track.track_number ? (
														<LoaderCircle className="size-3.5 animate-spin" />
													) : (
														<Download className="size-3.5" />
													)}
													Raw Master
												</Button>
											</div>
										))
									)}
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</BaseModal>
	);
}
