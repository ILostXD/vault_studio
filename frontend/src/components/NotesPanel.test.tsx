// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotesPanel from "./NotesPanel";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/useNotes", () => ({
  useTrackNotes: () => ({ data: [], isLoading: false }),
  useProjectNotes: () => ({ data: [], isLoading: false }),
  useUpsertTrackNote: () => ({ mutateAsync: vi.fn() }),
  useUpsertProjectNote: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/components/RichTrackNote", () => ({
  RichTrackNoteContent: () => null,
  RichTrackNoteEditor: () => null,
}));

vi.mock("@/routes/__root", () => ({
  toast: { error: vi.fn() },
}));

afterEach(cleanup);

describe("NotesPanel mobile scrolling", () => {
  it("keeps the panel constrained and exposes a touch scrollport", () => {
    render(
      <NotesPanel
        mode="track"
        selectedTrack={{ public_id: "track-1", title: "Test track" } as never}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("notes-panel-root").classList).toContain("min-h-0");
    const scrollClasses = screen.getByTestId("notes-scroll-container").classList;
    for (const className of [
      "min-h-0",
      "overflow-y-auto",
      "overscroll-contain",
      "touch-pan-y",
    ]) {
      expect(scrollClasses).toContain(className);
    }
  });
});
