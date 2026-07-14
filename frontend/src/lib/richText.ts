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
