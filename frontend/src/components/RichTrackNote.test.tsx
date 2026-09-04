// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RichTrackNoteContent } from "./RichTrackNote";

afterEach(cleanup);

describe("RichTrackNoteContent", () => {
  it("shows a compact clickable URL without changing its destination", () => {
    const href = "https://www.example.com/projects/archive/final-mix?download=1";
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: href,
              marks: [{ type: "link", attrs: { href } }],
            },
          ],
        },
      ],
    });

    render(<RichTrackNoteContent content={content} />);

    const link = screen.getByRole("link");
    expect(link.textContent).toBe("example.com/\u2026/final-mix");
    expect(link.getAttribute("href")).toBe(href);
  });

  it("keeps intentional link labels", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Final mix",
              marks: [
                { type: "link", attrs: { href: "https://example.com/mix" } },
              ],
            },
          ],
        },
      ],
    });

    render(<RichTrackNoteContent content={content} />);

    expect(screen.getByRole("link").textContent).toBe("Final mix");
  });
});
