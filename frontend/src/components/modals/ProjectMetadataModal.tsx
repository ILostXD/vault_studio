import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImageIcon, LoaderCircle, Save, X } from "lucide-react";
import { getAudioMetadata, saveAudioMetadata, downloadTaggedTrack, type ProjectAudioMetadata } from "@/api/audioMetadata";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { projectKeys } from "@/hooks/useProjects";
import { updateTrack } from "@/api/tracks";
import BaseModal from "./BaseModal";

export default function ProjectMetadataModal({ projectId, coverUrl, onClose }: {
  projectId: number;
  coverUrl?: string | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const queryKey = ["project-audio-metadata", projectId];
  const query = useQuery({ queryKey, queryFn: () => getAudioMetadata(projectId), refetchOnWindowFocus: false });
  const [draft, setDraft] = useState<ProjectAudioMetadata | null>(null);
  const [selectedId, setSelectedId] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trackDraft, setTrackDraft] = useState<{ artist: string; album: string } | null>(null);
  const data = query.data;
  const fields = draft ?? data?.metadata;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(data?.metadata);
  const selected = data?.tracks.find((track) => track.track_id === selectedId) ?? data?.tracks[0];
  const busy = saving || downloading;

  async function save() {
    if (!fields) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await saveAudioMetadata(projectId, fields);
      client.setQueryData(queryKey, result);
      setDraft(null);
      await client.invalidateQueries({ queryKey: projectKeys.all });
      setMessage("Project metadata saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save metadata.");
    } finally { setSaving(false); }
  }

  async function download() {
    if (!selected || dirty || trackDraft || busy) return;
    setDownloading(true); setProgress(undefined); setError(""); setMessage("Preparing tagged copy...");
    try {
      const result = await downloadTaggedTrack(projectId, selected, (loaded, total) => {
        setProgress(total ? (loaded / total) * 100 : undefined);
        setMessage(total ? `Downloading ${Math.round((loaded / total) * 100)}%` : "Downloading tagged copy...");
      });
      setMessage(result.cancelled ? "Download cancelled." : "Tagged copy downloaded. Original unchanged.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not download tagged copy.");
      setMessage("");
    } finally { setDownloading(false); }
  }

  async function saveTrackOverrides() {
    if (!selected || !trackDraft) return;
    setSaving(true); setError("");
    try {
      await updateTrack(selected.public_id, trackDraft);
      await client.invalidateQueries({ queryKey: ["tracks"] });
      await query.refetch();
      setTrackDraft(null);
      setMessage("Track overrides saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save track overrides.");
    } finally { setSaving(false); }
  }

  return (
    <BaseModal isOpen onClose={onClose} maxWidth="2xl" disableClose={busy}>
      <div className="p-5 sm:p-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Project Metadata</h2>
          <Button variant="ghost" size="icon" aria-label="Close project metadata" disabled={busy} onClick={onClose}><X className="size-4" /></Button>
        </header>
        {query.isPending && <p role="status" className="text-sm text-(--text-2)">Loading metadata...</p>}
        {query.isError && <div role="alert" className="text-sm text-(--danger-0)">Could not load project metadata. <Button variant="ghost" onClick={() => query.refetch()}>Retry</Button></div>}
        {fields && data && <>
          <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                ["album", "Album"], ["artist", "Artist"], ["album_artist", "Album artist"],
                ["genre", "Genre"], ["year", "Year (optional)"],
              ] as const).map(([key, label]) => (
                <label key={key} className="grid min-w-0 gap-1.5 text-sm text-(--text-2)">
                  {label}
                  <Input value={fields[key]} required={key === "album"} maxLength={key === "year" ? 4 : 512}
                    inputMode={key === "year" ? "numeric" : undefined} pattern={key === "year" ? "[0-9]{4}" : undefined}
                    placeholder={key === "album_artist" ? fields.artist || "Same as project artist" : undefined}
                    onChange={(event) => { setDraft({ ...fields, [key]: event.target.value }); setMessage(""); }} />
                </label>
              ))}
              <div className="flex min-w-0 items-center gap-3 self-end py-1">
                {data.artwork && coverUrl ? <img src={coverUrl} alt="Project artwork" className="size-12 shrink-0 rounded-md object-cover" decoding="async" /> : <ImageIcon className="size-8 shrink-0 text-(--text-2)" />}
                <div className="min-w-0 text-sm"><p>Project artwork</p><p className="text-(--text-2)">{data.artwork ? "Embedded in tagged copies" : "No project cover"}</p></div>
              </div>
            </fieldset>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy || !dirty}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Save metadata</Button>
              {dirty && <span className="text-xs text-(--text-2)">Unsaved changes</span>}
            </div>
          </form>
          <section className="mt-6 border-t border-(--border) pt-5">
            <h3 className="mb-4 font-semibold">Tagged copy</h3>
            {selected ? <>
              <Select value={String(selected.track_id)} onValueChange={(value) => { setSelectedId(Number(value)); setTrackDraft(null); }} disabled={busy || !!trackDraft}>
                <SelectTrigger aria-label="Track preview"><SelectValue /></SelectTrigger>
                <SelectContent>{data.tracks.map((track) => <SelectItem key={track.track_id} value={String(track.track_id)}>{track.track_number}. {track.title}</SelectItem>)}</SelectContent>
              </Select>
              <dl className="my-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm" aria-label="Saved track metadata">
                {([
                  ["Title", selected.title], ["Artist", selected.artist], ["Album", selected.album],
                  ["Album artist", selected.album_artist], ["Track number", String(selected.track_number)],
                  ["Genre", selected.genre], ["Year", selected.year], ["Version", selected.version_name],
                  ["Artwork", selected.artwork ? "Project cover" : "None"],
                  ["Format", selected.conversion ? `${selected.source_format.toUpperCase()} → ${selected.format.toUpperCase()}` : selected.format.toUpperCase()],
                ] as const).map(([label, value]) => <div key={label} className="contents"><dt className="text-(--text-2)">{label}</dt><dd className="min-w-0 break-words">{value || "Not set"}</dd></div>)}
              </dl>
              <details className="mb-4 border-y border-(--border) py-3">
                <summary className="cursor-pointer text-sm font-medium">Track overrides</summary>
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  {(["artist", "album"] as const).map((key) => <label key={key} className="grid min-w-0 gap-1.5 text-sm text-(--text-2)">
                    {key === "artist" ? "Track artist" : "Track album"}
                    <Input disabled={busy} maxLength={512} value={trackDraft?.[key] ?? selected[`${key}_override`]}
                      placeholder={data.metadata[key] || "Inherit project"}
                      onChange={(event) => setTrackDraft({ artist: selected.artist_override, album: selected.album_override, ...trackDraft, [key]: event.target.value })} />
                  </label>)}
                </div>
                <Button className="mt-3" onClick={saveTrackOverrides} disabled={busy || !trackDraft}><Save className="size-4" />Save track overrides</Button>
                {trackDraft && <Button className="mt-3 ml-2" variant="ghost" disabled={busy} onClick={() => setTrackDraft(null)}>Cancel</Button>}
              </details>
              {selected.conversion && <p className="mb-4 text-sm text-(--text-2)">{selected.conversion}</p>}
              {selected.reason && <p className="mb-4 text-sm text-(--text-2)">{selected.reason}</p>}
              {dirty && <p className="mb-4 text-sm text-(--text-2)">Save changes to refresh this preview.</p>}
              <Button onClick={download} disabled={busy || dirty || !!trackDraft || !selected.can_download}>
                {downloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}Download tagged copy
              </Button>
            </> : <p className="text-sm text-(--text-2)">No tracks in this project.</p>}
          </section>
        </>}
        {downloading && <Progress value={progress} className="mt-4" />}
        {message && <p role="status" className="mt-3 text-sm text-(--text-2)">{message}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-(--danger-0)">{error}</p>}
      </div>
    </BaseModal>
  );
}
