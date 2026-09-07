// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotionArtworkFlowBackground } from "./MotionArtworkStage";

describe("MotionArtworkFlowBackground", () => {
	it("limits the cover flow to the requested layers without decoding video", () => {
		const { container } = render(
			<MotionArtworkFlowBackground coverUrl="/cover.jpg" maxLayers={2} />,
		);

		expect(container.querySelector("video")).toBeNull();
		expect(container.querySelectorAll("img")).toHaveLength(2);
	});
});
