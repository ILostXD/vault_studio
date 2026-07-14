import { describe, expect, it } from "vitest";
import { parseNoteDocument, plainTextToDocument } from "./richText";

describe("rich track notes", () => {
  it("keeps plain notes as paragraphs", () => {
    expect(plainTextToDocument("first\nsecond")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "first" }] },
        { type: "paragraph", content: [{ type: "text", text: "second" }] },
      ],
    });
  });

  it("falls back safely for malformed JSON", () => {
    expect(parseNoteDocument("not json", "tiptap_json").type).toBe("doc");
  });
});
