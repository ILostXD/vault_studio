import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MessageSquarePlus, Pencil, Send, Trash2, X } from "lucide-react";

import {
  createWaveformComment,
  deleteWaveformComment,
  listWaveformComments,
  updateWaveformComment,
} from "@/api/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import type { WaveformComment } from "@/types/api";

interface WaveformCommentsProps {
  versionId?: number | null;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  shareToken?: string | null;
  sharePassword?: string;
  placement?: "waveform" | "miniPlayer";
}

export function getCommentPosition(timestamp: number, duration: number) {
  if (duration <= 0) return 0;
  return Math.max(0, Math.min(100, (timestamp / duration) * 100));
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function WaveformComments({
  versionId,
  duration,
  currentTime,
  onSeek,
  shareToken,
  sharePassword = "",
  placement = "waveform",
}: WaveformCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<WaveformComment[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState(
    () => localStorage.getItem("vault.feedbackGuestName") || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!versionId) {
      setComments([]);
      return;
    }
    listWaveformComments(
      versionId,
      shareToken ? { token: shareToken, password: sharePassword } : undefined,
    )
      .then(setComments)
      .catch(() => setComments([]));
  }, [versionId, shareToken, sharePassword]);

  if (!versionId || duration <= 0) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || (shareToken && !authorName.trim())) return;
    setIsSaving(true);
    setError("");
    try {
      const comment = await createWaveformComment(
        versionId,
        {
          timestamp_seconds: Math.min(currentTime, duration),
          text: text.trim(),
          ...(shareToken
            ? { author_name: authorName.trim(), password: sharePassword }
            : {}),
        },
        shareToken || undefined,
      );
      if (shareToken)
        localStorage.setItem("vault.feedbackGuestName", authorName.trim());
      setComments((current) =>
        [...current, comment].sort(
          (a, b) => a.timestamp_seconds - b.timestamp_seconds,
        ),
      );
      setText("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to add comment",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId || !editingText.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await updateWaveformComment(editingId, editingText.trim());
      setComments((current) =>
        current.map((comment) => (comment.id === updated.id ? updated : comment)),
      );
      setEditingId(null);
      setEditingText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to edit comment");
    } finally {
      setIsSaving(false);
    }
  };

  const removeComment = async (commentId: number) => {
    setIsSaving(true);
    setError("");
    try {
      await deleteWaveformComment(commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setDeleteId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete comment");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className={
          placement === "miniPlayer"
            ? "absolute left-3 right-3 top-1 h-[42px] pointer-events-none z-20"
            : "absolute inset-0 pointer-events-none z-20"
        }
      >
        {comments.map((comment) => (
          <button
            key={comment.id}
            type="button"
            className="absolute top-0 -translate-x-1/2 pointer-events-auto size-4 rounded-full border-2 border-background bg-accent-blue shadow-md transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
            style={{
              left: `${getCommentPosition(comment.timestamp_seconds, duration)}%`,
            }}
            aria-label={`${comment.author_name} at ${formatTime(comment.timestamp_seconds)}: ${comment.text}`}
            title={`${comment.author_name}: ${comment.text}`}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSeek(comment.timestamp_seconds);
              setIsOpen(true);
            }}
          />
        ))}
      </div>

      <Button
        type="button"
        size="icon"
        variant="outline"
        className={`${placement === "miniPlayer" ? "absolute -top-11 right-0" : "absolute right-1 top-1"} pointer-events-auto z-30 size-9 bg-background/95 shadow-md`}
        aria-label="Open waveform comments"
        title="Waveform comments"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <MessageSquarePlus className="size-4" />
        {comments.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-accent-blue text-[10px] font-bold leading-4 text-black">
            {comments.length}
          </span>
        )}
      </Button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-200 flex items-end sm:items-center justify-center bg-black/70 p-3 sm:p-6"
            onMouseDown={() => setIsOpen(false)}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="waveform-comments-title"
              className="w-full max-w-lg max-h-[min(82dvh,680px)] overflow-y-auto rounded-2xl border border-(--card-border) bg-background p-5 text-(--text-0) shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2
                    id="waveform-comments-title"
                    className="text-xl font-semibold"
                  >
                    Waveform comments
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    New comment at {formatTime(Math.min(currentTime, duration))}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close comments"
                >
                  <X className="size-5" />
                </Button>
              </header>

              <div className="space-y-2 mb-5">
                {comments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No feedback yet.
                  </p>
                ) : (
                  comments.map((comment) => {
                    const isOwn = Boolean(user && comment.user_id === user.id);
                    const isEditing = editingId === comment.id;
                    const isDeleting = deleteId === comment.id;

                    return (
                      <div
                        key={comment.id}
                        className="rounded-lg border border-(--card-border) p-3 hover:bg-(--muted-2)"
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => onSeek(comment.timestamp_seconds)}
                          >
                            <span className="text-xs text-accent-blue">
                              {formatTime(comment.timestamp_seconds)}
                            </span>
                            <span className="ml-2 text-sm font-medium">
                              {comment.author_name}
                            </span>
                          </button>
                          {isOwn && !isEditing && !isDeleting && (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label="Edit comment"
                                title="Edit comment"
                                onClick={() => {
                                  setEditingId(comment.id);
                                  setEditingText(comment.text);
                                  setDeleteId(null);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8 text-red-500"
                                aria-label="Delete comment"
                                title="Delete comment"
                                onClick={() => {
                                  setDeleteId(comment.id);
                                  setEditingId(null);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editingText}
                              onChange={(event) => setEditingText(event.target.value)}
                              maxLength={2000}
                              rows={3}
                              aria-label="Edit comment text"
                              className="flex w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-base text-(--text-0) outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklab,var(--accent-blue)_40%,transparent)]"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                disabled={isSaving || !editingText.trim()}
                                onClick={saveEdit}
                              >
                                <Check className="size-4" />
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : isDeleting ? (
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <span className="mr-auto text-sm text-(--text-1)">
                              Delete this comment?
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setDeleteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              disabled={isSaving}
                              onClick={() => removeComment(comment.id)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mt-1 w-full text-left"
                            onClick={() => onSeek(comment.timestamp_seconds)}
                          >
                            <p className="text-sm text-(--text-1) whitespace-pre-wrap break-words">
                              {comment.text}
                            </p>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={submit}
                className="space-y-3 border-t border-(--card-border) pt-4"
              >
                {shareToken && (
                  <Input
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    maxLength={80}
                    placeholder="Your name"
                    aria-label="Your name"
                    required
                  />
                )}
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Leave feedback..."
                  aria-label="Comment"
                  required
                  className="flex w-full resize-none rounded-md border border-border bg-[color-mix(in_oklab,var(--bg-1)_30%,transparent)] px-3 py-2 text-base text-(--text-0) outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklab,var(--accent-blue)_40%,transparent)]"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isSaving ||
                    !text.trim() ||
                    Boolean(shareToken && !authorName.trim())
                  }
                >
                  <Send className="size-4" />
                  {isSaving ? "Sending..." : "Add comment"}
                </Button>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
