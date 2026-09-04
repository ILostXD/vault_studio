import { describe, expect, it } from "vitest";
import {
  compactUrlForDisplay,
  parseNoteDocument,
  plainTextToDocument,
} from "./richText";

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

  it("keeps the useful parts of a pasted URL compact", () => {
    expect(
      compactUrlForDisplay(
        "https://www.example.com/projects/archive/final-mix?download=1",
      ),
    ).toBe("example.com/\u2026/final-mix");
  });

  it("leaves non-URL text unchanged", () => {
    expect(compactUrlForDisplay("not a link")).toBe("not a link");
  });
});
