// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { checkUsersExist } from "./auth";

describe("checkUsersExist with timeout", () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("returns users_exist when server responds successfully", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ "content-type": "application/json" }),
			json: async () => ({ users_exist: true }),
		});

		const result = await checkUsersExist();
		expect(result).toEqual({ users_exist: true });
	});

	it("throws ApiError with status 0 on timeout or network failure", async () => {
		const abortError = new Error("The operation was aborted due to timeout");
		abortError.name = "TimeoutError";

		global.fetch = vi.fn().mockRejectedValue(abortError);

		await expect(checkUsersExist()).rejects.toThrow(ApiError);
		try {
			await checkUsersExist();
		} catch (error) {
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(0);
			expect((error as ApiError).message).toContain("timed out");
		}
	});
});
