// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WaveformComments from "./WaveformComments";

vi.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: null }),
}));

vi.mock("@/api/feedback", () => ({
	createWaveformComment: vi.fn(),
	deleteWaveformComment: vi.fn(),
	listWaveformComments: vi.fn().mockResolvedValue([]),
	updateWaveformComment: vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn(),
		},
	});
});

describe("WaveformComments mobile scrolling", () => {
	it("uses the same touch-friendly scroll behavior as the queue", () => {
		render(
			<WaveformComments
				versionId={42}
				duration={120}
				currentTime={10}
				onSeek={vi.fn()}
				placement="fullscreen"
				isOpen={true}
				onOpenChange={vi.fn()}
				showButton={false}
			/>,
		);

		const scrollClasses = screen.getByTestId(
			"comments-scroll-container",
		).classList;
		for (const className of [
			"overflow-y-auto",
			"overscroll-contain",
			"touch-pan-y",
		]) {
			expect(scrollClasses).toContain(className);
		}
	});

	it("renders inside the fullscreen panel without a modal backdrop", () => {
		const panelTarget = document.createElement("div");
		document.body.append(panelTarget);

		render(
			<WaveformComments
				versionId={42}
				duration={120}
				currentTime={10}
				onSeek={vi.fn()}
				placement="fullscreen"
				isOpen={true}
				onOpenChange={vi.fn()}
				showButton={false}
				embedded
				panelTarget={panelTarget}
			/>,
		);

		expect(panelTarget.querySelector('[role="dialog"]')).toBeTruthy();
		expect(panelTarget.querySelector(".fixed.inset-0")).toBeNull();
		panelTarget.remove();
	});

	it("constrains embedded miniplayer comments to the popover", () => {
		const panelTarget = document.createElement("div");
		document.body.append(panelTarget);
		const view = render(
			<WaveformComments
				versionId={42}
				duration={120}
				currentTime={10}
				onSeek={vi.fn()}
				placement="miniPlayer"
				isOpen
				embedded
				fillEmbedded
				panelTarget={panelTarget}
			/>,
		);
		expect(panelTarget.firstElementChild?.className).toContain("min-h-0");
		const scroll = screen.getByTestId("comments-scroll-container");
		expect(scroll.className).toContain("flex-1");
		expect(scroll.className).toContain("min-h-0");
		expect(scroll.className).toContain("overflow-y-auto");
		view.unmount();
		panelTarget.remove();
	});
});
