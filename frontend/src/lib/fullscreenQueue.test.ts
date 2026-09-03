// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
	FULLSCREEN_DESKTOP_QUEUE_KEY,
	getFullscreenDesktopQueueOpen,
	setFullscreenDesktopQueueOpen,
} from "./fullscreenQueue";

function createStorage(): Storage {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key: string) => values.get(key) ?? null,
		key: (index: number) => [...values.keys()][index] ?? null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => values.set(key, String(value)),
	};
}

describe("fullscreenQueue preference persistence", () => {
	let storage: Storage;

	beforeEach(() => {
		storage = createStorage();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: storage,
		});
	});

	it("1. defaults to OPEN (true) when there is no saved preference", () => {
		expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBeNull();
		expect(getFullscreenDesktopQueueOpen()).toBe(true);
	});

	it("2. returns true when saved preference is OPEN ('true')", () => {
		window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "true");
		expect(getFullscreenDesktopQueueOpen()).toBe(true);
	});

	it("3. returns false when saved preference is CLOSED ('false')", () => {
		window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "false");
		expect(getFullscreenDesktopQueueOpen()).toBe(false);
	});

	it("4. persists 'false' when changing OPEN -> CLOSED", () => {
		// First-ever state: open by default
		expect(getFullscreenDesktopQueueOpen()).toBe(true);

		// User closes queue
		setFullscreenDesktopQueueOpen(false);

		expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe("false");
		expect(getFullscreenDesktopQueueOpen()).toBe(false);
	});

	it("5. persists 'true' when changing CLOSED -> OPEN", () => {
		// Start closed
		window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "false");
		expect(getFullscreenDesktopQueueOpen()).toBe(false);

		// User opens queue
		setFullscreenDesktopQueueOpen(true);

		expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe("true");
		expect(getFullscreenDesktopQueueOpen()).toBe(true);
	});

	it("6. survives simulated page reloads and new player sessions", () => {
		// Session 1: User enters fullscreen (default OPEN), closes it, exits
		expect(getFullscreenDesktopQueueOpen()).toBe(true);
		setFullscreenDesktopQueueOpen(false);

		// Simulate session end / reload (localStorage retains values)
		const savedValue = window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY);
		expect(savedValue).toBe("false");

		// Session 2: User opens app later and enters fullscreen again
		expect(getFullscreenDesktopQueueOpen()).toBe(false);

		// User decides to open the queue again
		setFullscreenDesktopQueueOpen(true);

		// Simulate another reload
		expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe("true");
		expect(getFullscreenDesktopQueueOpen()).toBe(true);
	});

	it("7. falls back safely to OPEN (true) if corrupt/unknown value is stored", () => {
		window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "not_a_boolean");
		expect(getFullscreenDesktopQueueOpen()).toBe(false); // only explicit "true" or null returns true
	});
});
