// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDragAndDrop } from "./useDragAndDrop";
import type { GridItem } from "./types";

const errorToast = vi.hoisted(() => vi.fn());
vi.mock("@/routes/__root", () => ({ toast: { error: errorToast } }));
vi.mock("@/hooks/useProjectCoverImage", () => ({ getCachedCoverUrl: () => null }));
afterEach(() => { cleanup(); document.body.innerHTML = ""; vi.restoreAllMocks(); errorToast.mockClear(); });

it.each([true, false])("only removes the dragged item when the breadcrumb move succeeds (%s)", async (succeeds) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const source = { id: "p1", type: "project", project: { public_id: "p1", id: 1 } } as GridItem;
  const move = vi.fn(() => succeeds ? Promise.resolve() : Promise.reject(new Error("offline")));
  const setItems = vi.fn();
  const navigate = vi.fn();
  const { result } = renderHook(() => useDragAndDrop([source], setItems, { onMoveProjectToFolder: move, onNavigateAfterDrop: navigate }));
  const breadcrumb = document.createElement("button");
  breadcrumb.setAttribute("data-breadcrumb-drop", "root");
  breadcrumb.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 40 }) as DOMRect;
  document.body.appendChild(breadcrumb);
  const card = document.createElement("div");
  card.getBoundingClientRect = () => ({ left: 20, top: 10, width: 30, height: 30 }) as DOMRect;
  act(() => result.current.registerRef("p1")(card));
  act(() => result.current.handleDragStart("p1"));
  act(() => result.current.handleDragMove("p1", { x: 40, y: 20 }));
  act(() => { void result.current.handleDrop(false); });
  await act(async () => { await result.current.handleDrop(true); });
  expect(move).toHaveBeenCalledWith("p1", null);
  expect(setItems).toHaveBeenCalledTimes(succeeds ? 1 : 0);
  expect(navigate).toHaveBeenCalledTimes(succeeds ? 1 : 0);
  expect(errorToast).toHaveBeenCalledTimes(succeeds ? 0 : 1);
  expect(result.current.draggingId).toBeNull();
});
