// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooLostSettingsSection } from "./TooLostSettingsSection";

const mocks = vi.hoisted(() => ({
	getStatus: vi.fn(),
	getConfiguration: vi.fn(),
	saveConfiguration: vi.fn(),
	success: vi.fn(),
}));

vi.mock("@/api/distribution", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/api/distribution")>()),
	getTooLostStatus: mocks.getStatus,
	getTooLostConfiguration: mocks.getConfiguration,
	saveTooLostConfiguration: mocks.saveConfiguration,
}));

vi.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { is_admin: true } }),
}));

vi.mock("@/routes/__root", () => ({
	toast: { success: mocks.success, error: vi.fn() },
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("TooLostSettingsSection", () => {
	it("edits instance OAuth settings without exposing the saved secret", async () => {
		mocks.getStatus.mockResolvedValue({
			configured: true,
			connected: false,
			environment: "sandbox",
		});
		mocks.getConfiguration.mockResolvedValue({
			client_id: "client-123",
			client_secret_configured: true,
			public_base_url: "https://vault.example.com",
			environment: "sandbox",
			callback_url:
				"https://vault.example.com/api/integrations/toolost/callback",
			configured: true,
			encryption_managed: true,
		});
		mocks.saveConfiguration.mockResolvedValue({
			client_id: "client-123",
			client_secret_configured: true,
			public_base_url: "https://vault.example.com",
			environment: "sandbox",
			configured: true,
		});

		render(
			<QueryClientProvider
				client={
					new QueryClient({
						defaultOptions: {
							queries: { retry: false },
							mutations: { retry: false },
						},
					})
				}
			>
				<TooLostSettingsSection />
			</QueryClientProvider>,
		);

		expect(await screen.findByDisplayValue("client-123")).toBeTruthy();
		expect(
			screen.getByPlaceholderText("Leave blank to keep the saved secret"),
		).toHaveProperty("value", "");
		expect(
			screen.getByText(
				"https://vault.example.com/api/integrations/toolost/callback",
			),
		).toBeTruthy();

		fireEvent.change(
			screen.getByPlaceholderText("Leave blank to keep the saved secret"),
			{ target: { value: "replacement-secret" } },
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Save Too Lost settings" }),
		);

		await waitFor(() =>
			expect(mocks.saveConfiguration.mock.calls[0]?.[0]).toEqual({
				client_id: "client-123",
				client_secret: "replacement-secret",
				public_base_url: "https://vault.example.com",
				environment: "sandbox",
			}),
		);
	});
});
