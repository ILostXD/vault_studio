// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, usePresence } from "motion/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GridTileViewport } from "./GridTileViewport";

const liveCards = new Set<number>();
let columns = 2;

class VisibilityObserver {
  static instances: VisibilityObserver[] = [];
  targets = new Set<Element>();
  observe = vi.fn((element: Element) => { this.targets.add(element); });
  unobserve = vi.fn((element: Element) => { this.targets.delete(element); });
  disconnect = vi.fn(() => { this.targets.clear(); });

  constructor(
    private callback: IntersectionObserverCallback,
    public options: IntersectionObserverInit,
  ) {
    VisibilityObserver.instances.push(this);
  }

  notify() {
    this.callback(Array.from(this.targets, (target) => {
      const rect = target.getBoundingClientRect();
      return {
        target,
        isIntersecting: rect.bottom >= -600 && rect.top <= window.innerHeight + 600,
      } as IntersectionObserverEntry;
    }), this as unknown as IntersectionObserver);
  }
}

function Card({ index }: { index: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    liveCards.add(index);
    return () => { liveCards.delete(index); };
  }, [index]);

  return (
    <>
      <button data-testid="mounted-card" onClick={() => setMenuOpen(true)}>Card {index}</button>
      <button onClick={() => setMenuOpen(true)}>Options {index}</button>
      {menuOpen && createPortal(
        <div role="menu">
          <button autoFocus>First action</button>
          <button>Second action</button>
        </div>,
        document.body,
      )}
    </>
  );
}

function Grid({ pinned = -1 }: { pinned?: number }) {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-6 gap-y-3">
        {Array.from({ length: 200 }, (_, index) => (
          <GridTileViewport key={index} label={`Item ${index}`} pinned={index === pinned}>
            <Card index={index} />
          </GridTileViewport>
        ))}
      </div>
      <button>Outside grid</button>
    </>
  );
}

beforeEach(() => {
  columns = 2;
  VisibilityObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", VisibilityObserver);
  vi.stubGlobal("innerHeight", 640);
  vi.stubGlobal("scrollY", 0);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = Number(this.getAttribute("aria-label")?.replace("Item ", "") ?? 0);
    return new DOMRect((index % columns) * 184, Math.floor(index / columns) * 228 - window.scrollY, 160, 216);
  });
});

afterEach(() => {
  cleanup();
  expect(liveCards.size).toBe(0);
  for (const observer of VisibilityObserver.instances) expect(observer.targets.size).toBe(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("mounts only the viewport plus overscan, with one observer and stable slots", () => {
  const { container, unmount } = render(<Grid />);
  expect(liveCards.size).toBe(12);
  expect(screen.queryByRole("button", { name: "Card 150" })).toBeNull();
  expect(VisibilityObserver.instances).toHaveLength(1);
  const observer = VisibilityObserver.instances[0];
  expect(observer.options.rootMargin).toBe("600px 0px");
  expect(container.querySelectorAll("[data-grid-slot]")).toHaveLength(200);
  expect(screen.getByRole("group", { name: "Item 150" }).className).toContain("h-54");

  act(() => {
    window.scrollY = 10000;
    observer.notify();
  });
  expect(liveCards.size).toBeGreaterThan(0);
  expect(liveCards.size).toBeLessThan(20);
  expect(liveCards.has(0)).toBe(false);
  expect(container.querySelectorAll("[data-grid-slot]")).toHaveLength(200);

  act(() => {
    window.scrollY = 0;
    columns = 4;
    observer.notify();
  });
  expect(liveCards.size).toBe(24);
  expect(VisibilityObserver.instances).toHaveLength(1);
  unmount();
  expect(observer.disconnect).toHaveBeenCalledOnce();
});

it("keeps a dragged or drop-target card mounted beyond overscan until it is released", () => {
  const { rerender } = render(<Grid pinned={150} />);
  const card = screen.getByRole("button", { name: "Card 150" });
  act(() => VisibilityObserver.instances[0].notify());
  expect(screen.getByRole("button", { name: "Card 150" })).toBe(card);
  rerender(<Grid />);
  expect(screen.queryByRole("button", { name: "Card 150" })).toBeNull();
  expect(liveCards.has(150)).toBe(false);
});

it("makes unmounted cards keyboard reachable and retains focus across visibility changes", async () => {
  render(<Grid />);
  const placeholder = screen.getByRole("group", { name: "Item 150" });
  expect(placeholder.tabIndex).toBe(0);
  act(() => placeholder.focus());
  const card = screen.getByRole("button", { name: "Card 150" });
  expect(document.activeElement).toBe(card);
  act(() => VisibilityObserver.instances[0].notify());
  expect(screen.getByRole("button", { name: "Card 150" })).toBe(card);
  act(() => screen.getByRole("button", { name: "Outside grid" }).focus());
  await waitFor(() => expect(screen.queryByRole("button", { name: "Card 150" })).toBeNull());
});

it("does not discard a portaled menu while focus moves within it", async () => {
  render(<Grid />);
  act(() => screen.getByRole("group", { name: "Item 150" }).focus());
  fireEvent.click(screen.getByRole("button", { name: "Card 150" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "First action" }));
  act(() => {
    VisibilityObserver.instances[0].notify();
    screen.getByRole("button", { name: "Second action" }).focus();
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(liveCards.has(150)).toBe(true);
  act(() => screen.getByRole("button", { name: "Outside grid" }).focus());
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
});

it("enters the last control when keyboard focus comes from after the card", () => {
  render(<Grid />);
  act(() => screen.getByRole("button", { name: "Outside grid" }).focus());
  act(() => screen.getByRole("group", { name: "Item 199" }).focus());
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Options 199" }));
});

it("falls back to rendering cards when visibility observation is unavailable", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  render(<Grid />);
  expect(liveCards.size).toBe(200);
  expect(VisibilityObserver.instances).toHaveLength(0);
});

it("retains mounted cards until their exit animation completes", async () => {
  let finishExit: (() => void) | undefined;
  function ExitingCard() {
    const [, safeToRemove] = usePresence();
    finishExit = safeToRemove ?? undefined;
    return <button>Leaving card</button>;
  }
  const { rerender } = render(
    <AnimatePresence mode="popLayout">
      <GridTileViewport key="card" label="Item 0" pinned={false}>
        <ExitingCard />
      </GridTileViewport>
    </AnimatePresence>,
  );
  rerender(<AnimatePresence mode="popLayout">{null}</AnimatePresence>);
  act(() => {
    window.scrollY = 10000;
    VisibilityObserver.instances[0].notify();
  });
  expect(screen.getByRole("button", { name: "Leaving card" })).toBeTruthy();
  act(() => finishExit?.());
  await waitFor(() => expect(screen.queryByRole("group", { name: "Item 0" })).toBeNull());
});

it("does not mount an off-screen card merely to remove it", async () => {
  const mount = vi.fn();
  function UnseenCard() {
    mount();
    return <button>Unseen card</button>;
  }
  const { rerender } = render(
    <AnimatePresence mode="popLayout">
      <GridTileViewport key="card" label="Item 199" pinned={false}>
        <UnseenCard />
      </GridTileViewport>
    </AnimatePresence>,
  );
  rerender(<AnimatePresence mode="popLayout">{null}</AnimatePresence>);
  await waitFor(() => expect(screen.queryByRole("group", { name: "Item 199" })).toBeNull());
  expect(mount).not.toHaveBeenCalled();
});
