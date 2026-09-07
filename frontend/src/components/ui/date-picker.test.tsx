// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

afterEach(cleanup);

describe("DatePicker", () => {
	it("uses the Vault calendar and emits an ISO date", async () => {
		const onValueChange = vi.fn();
		render(<DatePicker value="" onValueChange={onValueChange} />);

		fireEvent.click(screen.getByRole("button", { name: "dd/mm/yyyy" }));
		fireEvent.click(await screen.findByRole("button", { name: "Today" }));

		expect(onValueChange).toHaveBeenCalledWith(
			expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
		);
		expect(document.querySelector('input[type="date"]')).toBeNull();
	});
});
