import { X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect } from "react";
import {
  RichTrackNoteContent,
  RichTrackNoteEditor,
} from "@/components/RichTrackNote";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProjectNotes,
  useTrackNotes,
  useUpsertProjectNote,
  useUpsertTrackNote,
} from "@/hooks/useNotes";
import { toast } from "@/routes/__root";
import type { Note, NoteContentFormat, Project, Track } from "@/types/api";

interface TrackNotesPanelProps {
  mode: "track";
  selectedTrack: Track | null;
  project?: never;
  onClose: () => void;
}

interface ProjectNotesPanelProps {
  mode: "project";
  project: Project | null;
  selectedTrack?: never;
  onClose: () => void;
}

type NotesPanelProps = TrackNotesPanelProps | ProjectNotesPanelProps;

function NoteItem({ note }: { note: Note }) {
  return (
    <div className="bg-linear-to-b from-(--card-gradient-from) to-(--card-gradient-to) border border-(--card-border) rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5">
        <div className="size-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-(--text-0)/70 shrink-0">
          {note.author_name[0]?.toUpperCase()}
        </div>
        <span className="text-sm text-(--text-0)/60">@{note.author_name}</span>
      </div>
      <div className="px-4 py-4">
        {note.content ? (
          note.content_format === "tiptap_json" ? (
            <RichTrackNoteContent content={note.content} />
          ) : (
            <p
              className="text-(--text-0)/90 text-sm whitespace-pre-wrap leading-relaxed"
              style={{ fontFamily: '"IBM Plex Mono", monospace' }}
            >
              {note.content}
            </p>
          )
        ) : (
            <span className="text-(--text-0)/30 italic">No notes yet...</span>
        )}
      </div>
    </div>
  );
}

export default function NotesPanel(props: NotesPanelProps) {
  const { mode, onClose } = props;
  const selectedTrack = mode === "track" ? props.selectedTrack : null;
  const project = mode === "project" ? props.project : null;

  const { user } = useAuth();
  const upsertTrackNote = useUpsertTrackNote();
  const upsertProjectNote = useUpsertProjectNote();

  const currentId =
    mode === "track" ? selectedTrack?.public_id : project?.public_id;
  const currentTitle = mode === "track" ? selectedTrack?.title : project?.name;

  const { data: trackNotes = [], isLoading: trackNotesLoading } = useTrackNotes(
    mode === "track" ? currentId : null,
  );
  const { data: projectNotes = [], isLoading: projectNotesLoading } =
    useProjectNotes(mode === "project" ? currentId : null);

  const notes = mode === "track" ? trackNotes : projectNotes;
  const isLoading = mode === "track" ? trackNotesLoading : projectNotesLoading;

  const myNote = notes.find((n) => n.is_owner);
  const otherNotes = notes.filter((n) => !n.is_owner);

  const saveNote = useCallback(
    async (content: string, contentFormat: NoteContentFormat = "plain") => {
      if (!currentId || !user?.username) return;

      try {
        if (mode === "track") {
          await upsertTrackNote.mutateAsync({
            trackId: currentId,
            content,
            authorName: user.username,
            contentFormat,
          });
        } else {
          await upsertProjectNote.mutateAsync({
            projectId: currentId,
            content,
            authorName: user.username,
            contentFormat,
          });
        }
      } catch (error) {
        console.error("Failed to save note:", error);
        toast.error("Failed to save note");
      }
    },
    [currentId, user?.username, mode, upsertTrackNote, upsertProjectNote],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!currentId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col h-full items-center justify-center text-muted-foreground"
      >
        <p className="text-sm">
          {mode === "track"
            ? "Select a track to view notes"
            : "No project selected"}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h2
            className="text-xl font-light text-(--text-0)"
            style={{ fontFamily: '"IBM Plex Mono", monospace' }}
          >
            Notes
          </h2>
          <p className="text-lg text-muted-foreground mt-0.5 truncate">
            {currentTitle}
          </p>
        </div>
        <Button size="icon-lg" onClick={onClose} className="shrink-0">
          <X className="size-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {!isLoading && user?.username && currentId && (
          <RichTrackNoteEditor
            key={currentId}
            initialContent={myNote?.content ?? ""}
            contentFormat={myNote?.content_format ?? "plain"}
            authorName={user.username}
            onSave={saveNote}
          />
        )}

        {!isLoading &&
          otherNotes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}

        {!isLoading && notes.length === 0 && !user && (
          <div className="text-(--text-1) text-base text-center py-4">
            No notes yet
          </div>
        )}
      </div>
    </motion.div>
  );
}
