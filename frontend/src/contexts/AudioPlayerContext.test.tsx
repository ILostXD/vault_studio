// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioPlayerProvider, useAudioPlayer } from "./AudioPlayerContext";
import { usePlaybackProgress } from "./PlaybackProgressContext";

vi.mock("./AuthContext", () => ({
	useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("./PreferencesContext", () => ({
	usePreferences: () => ({ preferences: {} }),
}));

const streamRequest = vi.fn();
const waveformRequest = vi.fn();
vi.mock("@/api/media", () => ({
	getStreamUrl: (...args: unknown[]) => streamRequest(...args),
	resolveApiMediaUrl: () => undefined,
}));
vi.mock("@/api/server", () => ({ resolveApiUrl: (url: string) => url }));
vi.mock("@/api/tracks", () => ({
	getTrack: (...args: unknown[]) => waveformRequest(...args),
}));
vi.mock("@/api/versions", () => ({
	getVersions: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
	vi.clearAllMocks();
	streamRequest.mockResolvedValue({ url: "/stream.wav" });
	waveformRequest.mockResolvedValue({ waveform: "[1,2,3]" });
	vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function renderPlayer() {
	let player!: ReturnType<typeof useAudioPlayer>;
	function Controls() {
		player = useAudioPlayer();
		return null;
	}
	render(
		<AudioPlayerProvider>
			<Controls />
		</AudioPlayerProvider>,
	);
	return () => player;
}

it("starts audio without waiting for waveform metadata, then fills in the waveform", async () => {
	const waveform = deferred<{ waveform: string }>();
	waveformRequest.mockReturnValue(waveform.promise);
	const player = renderPlayer();
	await act(async () => {
		await player().play({ id: "a", title: "First" });
	});
	expect(player().audioUrl).toBe("/stream.wav");
	expect(player().isPlaying).toBe(true);
	expect(player().currentTrack?.title).toBe("First");
	act(() => player().pause());
	await act(async () => {
		waveform.resolve({ waveform: "[4,5,6]" });
	});
	expect(player().currentTrack?.waveform).toBe("[4,5,6]");
	expect(player().isPlaying).toBe(false);
	expect(streamRequest).toHaveBeenCalledTimes(1);
});

it("ignores an older stream response after a newer track is selected", async () => {
	const first = deferred<{ url: string }>();
	streamRequest
		.mockReturnValueOnce(first.promise)
		.mockResolvedValueOnce({ url: "/second.wav" });
	const player = renderPlayer();
	let firstPlay!: Promise<void>;
	act(() => {
		firstPlay = player().play({ id: "a", title: "First" });
	});
	await act(async () => {
		await player().play({ id: "b", title: "Second" });
	});
	await act(async () => {
		first.resolve({ url: "/first.wav" });
		await firstPlay;
	});
	expect(player().currentTrack?.id).toBe("b");
	expect(player().audioUrl).toBe("/second.wav");
});

it.each(["pause", "stop"] as const)(
	"does not start a pending track after %s",
	async (action) => {
		const pending = deferred<{ url: string }>();
		streamRequest.mockReturnValueOnce(pending.promise);
		const player = renderPlayer();
		let playing!: Promise<void>;
		act(() => {
			playing = player().play({ id: "a", title: "First" });
		});
		act(() => player()[action]());
		await act(async () => {
			pending.resolve({ url: "/first.wav" });
			await playing;
		});
		expect(player().isPlaying).toBe(false);
		expect(player().currentTrack).toBeNull();
		expect(player().audioUrl).toBeNull();
	},
);

it("does not let late waveform metadata replace a newer selection", async () => {
	const firstWaveform = deferred<{ waveform: string }>();
	waveformRequest.mockReturnValueOnce(firstWaveform.promise);
	const player = renderPlayer();
	await act(async () => {
		await player().play({ id: "a", title: "First" });
	});
	await act(async () => {
		await player().play({ id: "b", title: "Second" });
	});
	await act(async () => {
		firstWaveform.resolve({ waveform: "[9,9,9]" });
	});
	expect(player().currentTrack?.id).toBe("b");
	expect(player().currentTrack?.waveform).toBe("[1,2,3]");
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("updates the playback timeline without re-rendering player controls or queue consumers", () => {
	const controlsRendered = vi.fn();
	let player!: ReturnType<typeof useAudioPlayer>;
	function Controls() {
		player = useAudioPlayer();
		controlsRendered();
		return <span>{player.queue.length} queued</span>;
	}
	function Timeline() {
		return <output>{usePlaybackProgress()}</output>;
	}
	render(
		<AudioPlayerProvider>
			<Controls />
			<Timeline />
		</AudioPlayerProvider>,
	);
	const initialRenders = controlsRendered.mock.calls.length;
	for (let frame = 1; frame <= 60; frame++) {
		act(() => player.onProgressUpdate(frame / 30));
	}
	expect(screen.getByRole("status").textContent).toBe("2");
	expect(controlsRendered).toHaveBeenCalledTimes(initialRenders);
	act(() => player.stop());
	expect(screen.getByRole("status").textContent).toBe("0");
});
