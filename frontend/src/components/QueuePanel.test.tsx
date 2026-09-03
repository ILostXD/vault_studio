// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QueuePanel from "./QueuePanel";

const mockQueue = [
	{
		id: "trk_1",
		title: "First Track",
		artist: "Test Artist",
		projectId: "p1",
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

		// Reorder handles are present with touch-none
		const reorderHandles = document.querySelectorAll(
			'[aria-label^="Reorder"]',
		);
		expect(reorderHandles.length).toBe(2);
		expect(reorderHandles[0]?.className).toContain("touch-none");
	});
});
