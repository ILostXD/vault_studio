import type { JSONContent } from "@tiptap/core";
import type { NoteContentFormat } from "@/types/api";

export function plainTextToDocument(content: string): JSONContent {
  return {
    type: "doc",
    content: content.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

export function parseNoteDocument(
  content: string,
  format: NoteContentFormat,
): JSONContent {
  if (format === "plain") return plainTextToDocument(content);

  try {
    const document = JSON.parse(content) as JSONContent;
    return document?.type === "doc" ? document : plainTextToDocument(content);
  } catch {
    return plainTextToDocument(content);
  }
}

export function compactUrlForDisplay(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "");
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length === 0) return host;

    const path =
      segments.length <= 2 ? segments.join("/") : `\u2026/${segments.at(-1)}`;
    const display = `${host}/${path}`;

    return display.length <= 56
      ? display
      : `${host}/\u2026/${segments.at(-1)?.slice(0, 24)}`;
  } catch {
    return value;
  }
}
