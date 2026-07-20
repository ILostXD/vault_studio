import { describe, expect, it } from "vitest";

import { getCommentPosition } from "@/components/WaveformComments";

describe("getCommentPosition", () => {
  it("positions and clamps waveform comments", () => {
    expect(getCommentPosition(30, 60)).toBe(50);
    expect(getCommentPosition(-1, 60)).toBe(0);
    expect(getCommentPosition(90, 60)).toBe(100);
    expect(getCommentPosition(10, 0)).toBe(0);
  });
});
