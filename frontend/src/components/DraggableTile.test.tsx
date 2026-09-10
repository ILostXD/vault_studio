// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import DraggableTile from "./DraggableTile";

const handlers = vi.hoisted(() => ({
  onDrag: undefined as undefined | ((event: unknown, info: { point: { x: number; y: number } }) => void),
}));

vi.mock("motion/react", async () => {
  const { createElement, forwardRef } = await import("react");
  return {
    motion: {
      div: forwardRef<HTMLDivElement, { onDrag: typeof handlers.onDrag; children: ReactNode }>((props, ref) => {
        handlers.onDrag = props.onDrag;
        return createElement("div", { ref }, props.children);
      }),
    },
    useDragControls: () => ({ start: vi.fn() }),
    useMotionValue: (value: number) => ({ get: () => value, set: vi.fn(), stop: vi.fn() }),
    animate: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([[0, 0], [60, 2000]])("hit-tests in viewport coordinates after scrolling (%i, %i)", (scrollX, scrollY) => {
  vi.stubGlobal("scrollX", scrollX);
  vi.stubGlobal("scrollY", scrollY);
  const onDragMove = vi.fn();
  render(
    <DraggableTile
      id="project-1"
      registerRef={() => vi.fn()}
      isDragging={false}
      isBeingDropped={false}
      onDragStart={vi.fn()}
      onDragMove={onDragMove}
      onDragCancel={vi.fn()}
      onDrop={() => false}
    >
      {() => <button>Project</button>}
    </DraggableTile>,
  );
  handlers.onDrag?.(null, { point: { x: 120 + scrollX, y: 300 + scrollY } });
  expect(onDragMove).toHaveBeenCalledWith({ x: 120, y: 300 });
});
