// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QueuePanel from "./QueuePanel";

const mockQueue = [
	{
		id: "trk_1",
		title: "First Track",
		artist: "Test Artist",
		projectId: "p1",
		coverUrl: "/cover.jpg",
	},
	{
		id: "trk_2",
		title: "Second Track",
		artist: "Test Artist",
		projectId: "p1",
	},
];

vi.mock("@/contexts/AudioPlayerContext", () => ({
	useAudioPlayer: () => ({
		queue: mockQueue,
		removeFromQueue: vi.fn(),
		clearQueue: vi.fn(),
		reorderQueue: vi.fn(),
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
	useRouterState: () => ({ location: { pathname: "/" } }),
}));

vi.mock("@/hooks/useProjectCoverImage", () => ({
	useProjectCoverImage: () => ({ imageUrl: null }),
}));

describe("QueuePanel touch scrolling & reorder", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders queue tracks with touch-friendly scroll container", () => {
		render(<QueuePanel isOpen={true} onClose={vi.fn()} layer="expanded" />);

		// Container has overscroll-contain and touch-pan-y
		const scrollContainer = document.querySelector(
			".overflow-y-auto.overscroll-contain.touch-pan-y",
		);
		expect(scrollContainer).toBeTruthy();

		// Tracks rendered
		expect(screen.getByText("First Track")).toBeTruthy();
		expect(screen.getByText("Second Track")).toBeTruthy();
		const coverFrame = screen.getByRole("img", { name: "First Track" })
			.parentElement!;
		expect(coverFrame.className).toContain("bg-(--bg-2)");
		expect(coverFrame.className).not.toContain("border");

		// Reorder handles are present with touch-none
		const reorderHandles = document.querySelectorAll('[aria-label^="Reorder"]');
		expect(reorderHandles.length).toBe(2);
		expect(reorderHandles[0]?.className).toContain("touch-none");
	});

	it("renders inside the fullscreen panel without a sheet backdrop", () => {
		const panelTarget = document.createElement("div");
		document.body.append(panelTarget);

		render(
			<QueuePanel
				isOpen={true}
				onClose={vi.fn()}
				embedded
				layer="expanded"
				panelTarget={panelTarget}
			/>,
		);

		expect(panelTarget.textContent).toContain("First Track");
		expect(panelTarget.firstElementChild?.className).toContain("min-h-0");
		expect(panelTarget.querySelector(".overflow-y-auto")?.className).toContain(
			"flex-1",
		);
		expect(document.querySelector(".overlay-backdrop")).toBeNull();
		for (const button of [
			screen.getByRole("button", { name: "Close queue manager" }),
			screen.getByRole("button", { name: "Clear" }),
		]) {
			expect(button.className).toContain("bg-black/20");
			expect(button.className).not.toContain("linear-gradient");
		}
		panelTarget.remove();
	});

	it("allows a button drag handle to lift a queue item", async () => {
		render(<QueuePanel isOpen onClose={vi.fn()} />);
		const handle = screen.getByRole("button", { name: "Reorder First Track" });
		handle.focus();
		fireEvent.keyDown(handle, {
			key: " ",
			code: "Space",
			keyCode: 32,
			which: 32,
		});
		await waitFor(() =>
			expect(document.querySelector(".cursor-grabbing")).not.toBeNull(),
		);
		fireEvent.keyDown(window, { key: "Escape", code: "Escape", keyCode: 27 });
	});
});
