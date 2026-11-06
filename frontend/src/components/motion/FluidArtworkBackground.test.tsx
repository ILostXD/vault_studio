// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FluidArtworkBackground from "./FluidArtworkBackground";

vi.mock("motion/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("motion/react")>();
	return {
		...actual,
		useReducedMotion: () => false,
		AnimatePresence: ({ children }: any) => <>{children}</>,
	};
});

describe("FluidArtworkBackground", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders with coverUrl and reflects isPlaying state", () => {
		const { container, rerender } = render(
			<FluidArtworkBackground
				coverUrl="https://example.com/cover.jpg"
				isPlaying={true}
			/>,
		);

		const bg = screen.getByTestId("fluid-artwork-bg");
		expect(bg).toBeDefined();
		expect(bg.getAttribute("data-cover-url")).toBe("https://example.com/cover.jpg");
		expect(bg.getAttribute("data-is-playing")).toBe("true");

		const images = container.querySelectorAll("img");
		expect(images.length).toBeGreaterThanOrEqual(3); // base + 2 rotating quadrants
		expect(images[0].getAttribute("src")).toBe("https://example.com/cover.jpg");

		// When paused
		rerender(
			<FluidArtworkBackground
				coverUrl="https://example.com/cover.jpg"
				isPlaying={false}
			/>,
		);
		expect(bg.getAttribute("data-is-playing")).toBe("false");
	});

	it("renders fallback gradient gracefully when no coverUrl is provided", () => {
		const { container } = render(
			<FluidArtworkBackground coverUrl={null} isPlaying={true} />,
		);

		const bg = screen.getByTestId("fluid-artwork-bg");
		expect(bg).toBeDefined();
		expect(bg.getAttribute("data-cover-url")).toBeNull();

		// No <img> tags rendered in fallback mode
		const images = container.querySelectorAll("img");
		expect(images).toHaveLength(0);
	});

	it("supports custom data-testid", () => {
		render(
			<FluidArtworkBackground
				coverUrl="https://example.com/cover.jpg"
				data-testid="custom-bg"
			/>,
		);

		expect(screen.getByTestId("custom-bg")).toBeDefined();
	});
});
