import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CircleStop,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import BaseModal from "@/components/modals/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProject, useProjects, projectKeys } from "@/hooks/useProjects";
import { trackKeys } from "@/hooks/useTracks";
import { uploadTrack } from "@/api/tracks";
import type { Project } from "@/types/api";

const MAX_RECORDING_MS = 10 * 60 * 1000;
const FORMATS = [
  { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a" },
  { mimeType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
];

type RecorderStatus =
  | "ready"
  | "requesting"
  | "recording"
  | "paused"
  | "preview"
  | "uploading"
  | "success"
  | "error";

interface VoiceMemoRecorderProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatElapsed(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function defaultTitle() {
  return `Voice Memo - ${new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

export default function VoiceMemoRecorder({
  isOpen,
  onClose,
}: VoiceMemoRecorderProps) {
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const [status, setStatus] = useState<RecorderStatus>("ready");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [activity, setActivity] = useState(0);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [extension, setExtension] = useState("webm");
  const [title, setTitle] = useState(defaultTitle);
  const [projectId, setProjectId] = useState("");
  const [creatingInline, setCreatingInline] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeStartedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  const closingRef = useRef(false);
  const previewUrlRef = useRef("");

  const editableProjects = projects.filter(
    (project) => !project.is_shared || project.allow_editing,
  );
  const destinationProjects = createdProject
    ? [createdProject, ...editableProjects.filter((p) => p.id !== createdProject.id)]
    : editableProjects;

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const releaseInput = useCallback(() => {
    if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActivity(0);
    stopTimer();
  }, [stopTimer]);

  const resetPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setRecording(null);
  }, []);

  const cleanup = useCallback(() => {
    closingRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    releaseInput();
    resetPreview();
  }, [releaseInput, resetPreview]);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (!isOpen) return;
    closingRef.current = false;
    setStatus("ready");
    setError("");
    setElapsed(0);
    setTitle(defaultTitle());
    setProjectId("");
    setCreatingInline(false);
    setProjectName("");
    setCreatedProject(null);
  }, [isOpen]);

  const updateElapsed = useCallback(() => {
    const current = accumulatedRef.current + (performance.now() - activeStartedAtRef.current);
    setElapsed(current);
    if (current >= MAX_RECORDING_MS) recorderRef.current?.stop();
  }, []);

  const startMeter = (stream: MediaStream) => {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = context;

    const measure = () => {
      analyser.getByteFrequencyData(samples);
      setActivity(samples.reduce((sum, value) => sum + value, 0) / samples.length / 255);
      meterFrameRef.current = requestAnimationFrame(measure);
    };
    measure();
  };

  const startRecording = async () => {
    resetPreview();
    setError("");
    if (!window.isSecureContext) {
      setError("Microphone recording on iPad requires an HTTPS address.");
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Audio recording is not supported in this browser.");
      setStatus("error");
      return;
    }

    const format = FORMATS.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType));

    try {
      setStatus("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (closingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recorder = new MediaRecorder(
        stream,
        format ? { mimeType: format.mimeType } : undefined,
      );
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      const mimeType = recorder.mimeType || format?.mimeType || "audio/mp4";
      setExtension(
        mimeType.includes("webm")
          ? "webm"
          : mimeType.includes("ogg")
            ? "ogg"
            : "m4a",
      );
      accumulatedRef.current = 0;
      activeStartedAtRef.current = performance.now();
      setElapsed(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("Recording stopped unexpectedly. Please try again.");
        setStatus("error");
        releaseInput();
      };
      recorder.onstop = () => {
        if (recorder.state === "inactive" && activeStartedAtRef.current) {
          accumulatedRef.current += performance.now() - activeStartedAtRef.current;
          activeStartedAtRef.current = 0;
          setElapsed(Math.min(accumulatedRef.current, MAX_RECORDING_MS));
        }
        releaseInput();
        if (closingRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (!blob.size) {
          setError("No audio was captured. Please try again.");
          setStatus("error");
          return;
        }
        setRecording(blob);
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setStatus("preview");
      };

      recorder.start(1000);
      startMeter(stream);
      timerRef.current = setInterval(updateElapsed, 200);
      setStatus("recording");
    } catch (cause) {
      releaseInput();
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access in your device settings and try again."
          : "Could not start the microphone. Please try again.",
      );
      setStatus("error");
    }
  };

  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    accumulatedRef.current += performance.now() - activeStartedAtRef.current;
    activeStartedAtRef.current = 0;
    recorder.pause();
    stopTimer();
    setElapsed(accumulatedRef.current);
    setStatus("paused");
  };

  const resumeRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    activeStartedAtRef.current = performance.now();
    recorder.resume();
    timerRef.current = setInterval(updateElapsed, 200);
    setStatus("recording");
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const retry = () => {
    resetPreview();
    setElapsed(0);
    setStatus("ready");
    setError("");
  };

  const upload = async () => {
    if (!recording || !title.trim()) return;
    if (!creatingInline && !projectId) {
      setError("Choose a destination project.");
      return;
    }
    if (creatingInline && !projectName.trim() && !createdProject) {
      setError("Enter a project name.");
      return;
    }

    setError("");
    setStatus("uploading");
    try {
      let destination = createdProject;
      if (creatingInline && !destination) {
        destination = await createProject.mutateAsync({ name: projectName.trim() });
        setCreatedProject(destination);
        setProjectId(String(destination.id));
      }
      if (!creatingInline) {
        destination = destinationProjects.find((project) => String(project.id) === projectId) ?? null;
      }
      if (!destination) throw new Error("Destination project is unavailable");

      const file = new File([recording], `${title.trim()}.${extension}`, {
        type: recording.type,
      });
      await uploadTrack(file, destination.id, { title: title.trim() });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: trackKeys.lists() }),
      ]);
      setStatus("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
      setStatus("preview");
    }
  };

  const close = () => {
    cleanup();
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={close} maxWidth="lg" disableClose={status === "uploading"}>
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Record idea</h2>
            <p className="text-sm text-(--text-1)">Capture up to ten minutes.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={close} disabled={status === "uploading"} aria-label="Close recorder">
            <X />
          </Button>
        </div>

        {(status === "ready" || status === "requesting" || status === "error") && (
          <div className="flex min-h-64 flex-col items-center justify-center gap-5 rounded-3xl border border-(--card-border) bg-(--inner-card-bg) p-6 text-center">
            <div className="flex size-20 items-center justify-center rounded-full themed-control">
              <Mic className="size-8" />
            </div>
            <div>
              <p className="font-medium">Ready when you are</p>
              <p className="mt-1 text-sm text-(--text-1)">Your browser will ask for microphone access.</p>
            </div>
            {error && <p role="alert" className="text-sm text-(--danger-0)">{error}</p>}
            <Button onClick={startRecording} disabled={status === "requesting"}>
              <Mic /> {status === "requesting" ? "Requesting access..." : "Start recording"}
            </Button>
          </div>
        )}

        {(status === "recording" || status === "paused") && (
          <div className="flex min-h-64 flex-col items-center justify-center gap-6 rounded-3xl border border-(--card-border) bg-(--inner-card-bg) p-6">
            <div className="text-center">
              <p className="font-mono text-4xl tabular-nums">{formatElapsed(elapsed)}</p>
              <p className="mt-2 text-xs uppercase text-(--text-1)">{status}</p>
            </div>
            <div className="flex h-12 w-full max-w-xs items-end justify-center gap-1" aria-label="Microphone activity">
              {Array.from({ length: 18 }, (_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-(--accent-color) transition-[height]"
                  style={{ height: `${Math.max(8, activity * 90 * (0.55 + ((index * 7) % 10) / 20))}%` }}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <Button size="icon-lg" onClick={status === "paused" ? resumeRecording : pauseRecording} aria-label={status === "paused" ? "Resume recording" : "Pause recording"}>
                {status === "paused" ? <Play /> : <Pause />}
              </Button>
              <Button size="icon-lg" variant="destructive" onClick={stopRecording} aria-label="Stop recording">
                <CircleStop />
              </Button>
            </div>
          </div>
        )}

        {(status === "preview" || status === "uploading") && recording && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-(--card-border) bg-(--inner-card-bg) p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">Preview</span>
                <span className="font-mono text-sm text-(--text-1)">{formatElapsed(elapsed)}</span>
              </div>
              <audio className="w-full" controls src={previewUrl} aria-label="Voice memo preview" />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={retry} disabled={status === "uploading"}><RefreshCw /> Retry</Button>
                <Button variant="outline" size="sm" onClick={retry} disabled={status === "uploading"} className="text-(--danger-0)"><Trash2 /> Discard</Button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span>Track title</span>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
              </label>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Destination</span>
                <Button variant="ghost" size="sm" onClick={() => setCreatingInline((value) => !value)} disabled={status === "uploading"}>
                  {creatingInline ? "Choose project" : "New project"}
                </Button>
              </div>

              {creatingInline ? (
                <Input placeholder="Project name" value={projectName} onChange={(event) => { setProjectName(event.target.value); if (createdProject) setCreatedProject(null); }} maxLength={200} />
              ) : (
                <Select value={projectId} onValueChange={setProjectId} disabled={status === "uploading"}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose a project" /></SelectTrigger>
                  <SelectContent>
                    {destinationProjects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {error && <p role="alert" className="text-sm text-(--danger-0)">{error}</p>}
              <Button className="w-full" onClick={upload} disabled={status === "uploading" || !title.trim()}>
                {status === "uploading" ? "Uploading..." : "Upload voice memo"}
              </Button>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex min-h-64 flex-col items-center justify-center gap-5 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-(--success-1) text-(--success-0)"><Mic className="size-8" /></div>
            <div><p className="text-lg font-semibold">Idea captured</p><p className="text-sm text-(--text-1)">The track is ready in your project.</p></div>
            <Button onClick={close}>Done</Button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
