// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	FULLSCREEN_DESKTOP_QUEUE_KEY,
	getFullscreenDesktopQueueOpen,
} from "@/lib/fullscreenQueue";
import NowPlayingView, { shouldDismissNowPlaying } from "./NowPlayingView";
import { NOW_PLAYING_ARTWORK_MODE_KEY, type ProjectMotionAsset } from "@/lib/motionArtwork";

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

const mockCloseNowPlaying = vi.fn();
const mockPlay = vi.fn();
const mockClearQueue = vi.fn();
const mockRemoveFromQueue = vi.fn();
let motionAssets: ProjectMotionAsset[] = [];
let realPresence = false;
let playing = true;

const sampleTrack = {
	id: "trk_123",
	title: "Cosmic Odyssey",
	artist: "Astro Beats",
	versionId: 42,
	coverUrl: "https://example.com/cover.jpg",
	projectId: "proj_abc",
};

const sampleQueue = [
	{
		id: "trk_456",
		title: "Nebula Dreams",
		artist: "Astro Beats",
		versionId: 43,
	},
];


vi.mock("@/contexts/PlaybackProgressContext", () => ({ usePlaybackProgress: () => 30 }));

vi.mock("@/contexts/AudioPlayerContext", () => ({
	useAudioPlayer: () => ({
		currentTrack: sampleTrack,
		isPlaying: playing,
		duration: 180,
		pause: vi.fn(),
		resume: vi.fn(),
		previousTrack: vi.fn(),
		nextTrack: vi.fn(),
		seekTo: vi.fn(),
		loopMode: "off",
		toggleLoop: vi.fn(),
		isShuffled: false,
		toggleShuffle: vi.fn(),
		closeNowPlaying: mockCloseNowPlaying,
		queue: sampleQueue,
		currentProjectTracks: [sampleTrack],
		play: mockPlay,
		removeFromQueue: mockRemoveFromQueue,
		clearQueue: mockClearQueue,
	}),
}));

vi.mock("@/contexts/PreferencesContext", () => ({
	usePreferences: () => ({
		preferences: { comments_enabled: true },
		accentColor: "#a020f0",
	}),
}));

vi.mock("@/hooks/useProjectMotionAssets", () => ({
	useProjectMotionAssets: () => ({ data: motionAssets }),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock("motion/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("motion/react")>();
	return {
		...actual,
		AnimatePresence: ({ children, ...props }: any) => realPresence
			? <actual.AnimatePresence {...props}>{children}</actual.AnimatePresence>
			: <>{children}</>,
	};
});

vi.mock("@/components/motion/MotionArtworkStage", () => ({
	default: ({ active }: any) => <div data-testid="motion-artwork-stage" data-active={String(Boolean(active))} />,
	MotionArtworkFlowBackground: ({ coverUrl, maxLayers }: any) => (
		<div
			data-testid="motion-artwork-bg"
			data-cover-url={coverUrl}
			data-max-layers={maxLayers}
		/>
	),
}));

vi.mock("@/components/motion/FluidArtworkBackground", () => ({
	default: ({ coverUrl, isPlaying, "data-testid": testId = "fluid-artwork-bg" }: any) => (
		<div
			data-testid={testId}
			data-cover-url={coverUrl}
			data-is-playing={isPlaying}
		/>
	),
}));

vi.mock("@/components/QueuePanel", () => ({
	default: ({ isOpen, onClose, embedded }: any) =>
		isOpen ? (
			<div data-testid="mobile-queue-panel" data-embedded={embedded}>
				<button
					type="button"
					onClick={onClose}
					data-testid="close-mobile-queue-btn"
				>
					Close Mobile Queue
				</button>
			</div>
		) : null,
}));

vi.mock("@/components/NotesPanel", () => ({
	default: ({ selectedTrack, onClose, embedded }: any) => (
		<div data-testid="notes-panel" data-embedded={embedded}>
			<span>Notes for {selectedTrack?.title}</span>
			<button type="button" onClick={onClose} data-testid="close-notes-btn">
				Close Notes
			</button>
		</div>
	),
}));

vi.mock("@/components/WaveformComments", () => ({
	default: ({
		placement,
		versionId,
		isOpen,
		onOpenChange,
		fillEmbedded,
		panelTarget,
	}: any) => (
		<div
			data-testid="waveform-comments"
			data-placement={placement}
			data-version={versionId}
			data-fill-embedded={String(fillEmbedded)}
			data-target-connected={String(Boolean(panelTarget?.isConnected))}
		>
			<button
				type="button"
				onClick={() => onOpenChange?.(!isOpen)}
				data-testid="toggle-waveform-comments-btn"
			>
				Comments ({isOpen ? "open" : "closed"})
			</button>
		</div>
	),
	getCommentPosition: (timestamp: number, duration: number) =>
		duration <= 0
			? 0
			: Math.max(0, Math.min(100, (timestamp / duration) * 100)),
}));

describe("NowPlayingView Fullscreen QoL", () => {
	it.each(["desktop", "mobile"] as const)("scopes black surfaces and the preferred accent to %s fullscreen", (variant) => {
		const root = document.documentElement;
		const previous = root.className;
		root.className = "dark";
		const view = render(<NowPlayingView projectId="proj_abc" projectName="Album" variant={variant} />);
		expect(root.className).toBe("dark");
		const dialog = screen.getByRole("dialog");
		expect(dialog.classList.contains("black")).toBe(true);
		expect(dialog.style.getPropertyValue("--accent-color")).toBe("#a020f0");
		expect(dialog.style.colorScheme).toBe("dark");
		expect(dialog.querySelector('[class*="shadow-[0_0_8px"]')).toBeNull();
		view.unmount();
		expect(root.className).toBe("dark");
		root.className = previous;
	});
	let storage: Storage;

	beforeEach(() => {
		vi.clearAllMocks();
		motionAssets = [];
		playing = true;
		realPresence = false;
		storage = createStorage();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: storage,
		});
	});

	afterEach(() => {
		cleanup();
	});

	it.each(["mobile", "desktop"] as const)("shrinks only the %s artwork on pause and restores it on resume", (variant) => {
		const view = () => <NowPlayingView projectId="proj_abc" projectName="Album" variant={variant} />;
		const { rerender } = render(view());
		const artwork = screen.getByTestId("playback-artwork");
		const transport = screen.getByRole("button", { name: "Next track" }).parentElement;
		expect(artwork.classList.contains("playback-artwork")).toBe(true);
		expect(artwork.getAttribute("data-playing")).toBe("true");
		playing = false;
		rerender(view());
		expect(screen.getByTestId("playback-artwork")).toBe(artwork);
		expect(artwork.getAttribute("data-playing")).toBe("false");
		expect(screen.getByTestId("motion-artwork-stage").getAttribute("data-active")).toBe("false");
		expect(screen.getByRole("button", { name: "Next track" }).parentElement).toBe(transport);
		expect(screen.getByRole("slider", { name: "Playback position" })).toBeTruthy();
		playing = true;
		rerender(view());
		expect(artwork.getAttribute("data-playing")).toBe("true");
	});

	it.each(["mobile", "desktop"] as const)("mounts the next %s panel without waiting for the previous panel to exit", async (variant) => {
		realPresence = true;
		window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "false");
		render(<NowPlayingView projectId="proj_abc" projectName="Astro Album" variant={variant} />);
		fireEvent.click(screen.getByRole("button", { name: variant === "mobile" ? "Notes" : "Show notes" }));
		const transport = screen.getByRole("button", { name: "Pause" });
		expect(transport).toBeTruthy();
		await screen.findByTestId("notes-panel");
		fireEvent.click(screen.getByRole("button", { name: variant === "mobile" ? "Open queue" : "Show queue" }));
		const panelId = variant === "mobile" ? "mobile-active-panel" : "fullscreen-side-panel";
		expect(screen.getAllByTestId(panelId)).toHaveLength(variant === "mobile" ? 1 : 2);
		expect(screen.getByRole("button", { name: "Pause" })).toBe(transport);
		await waitFor(() => expect(screen.getAllByTestId(panelId)).toHaveLength(1));
	});

	it("keeps the mobile comments target connected during rapid panel changes", async () => {
		realPresence = true;
		render(<NowPlayingView projectId="proj_abc" projectName="Album" variant="mobile" />);
		const comments = screen.getByRole("button", { name: "Comments" });
		fireEvent.click(comments);
		fireEvent.click(screen.getByRole("button", { name: "Open queue" }));
		fireEvent.click(comments);
		expect(screen.getAllByTestId("mobile-active-panel")).toHaveLength(1);
		expect(screen.getByTestId("waveform-comments").getAttribute("data-target-connected")).toBe("true");
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(screen.getByTestId("waveform-comments").getAttribute("data-target-connected")).toBe("true");
		expect(screen.getByTestId("mobile-active-panel").style.opacity).not.toBe("0");
		expect(screen.getByRole("dialog").style.contain).toBe("");
		expect(document.querySelector(".mobile-fullscreen-layout")?.className).toContain("pb-[calc(env(safe-area-inset-bottom)+2rem)]");
	});

	it.each(["Open queue", "Notes", "Comments"])(
		"uses the flowing background for %s over portrait artwork and restores the video on close",
		async (button) => {
			motionAssets = [{ kind: "apple_portrait", preview_url: "/portrait.mp4" } as ProjectMotionAsset];
			window.localStorage.setItem(NOW_PLAYING_ARTWORK_MODE_KEY, "apple_portrait");
			render(<NowPlayingView projectId="proj_abc" projectName="Astro Album" variant="mobile" />);
			expect(screen.queryByTestId("fluid-artwork-bg")).toBeNull();
			const transports = screen.getByTestId("mobile-transport-controls");
			const waveform = screen.getByTestId("mobile-playback-waveform");
			const toggle = screen.getByRole("button", { name: button });
			fireEvent.click(toggle);
			if (button === "Notes") await screen.findByTestId("notes-panel");
			expect(screen.getByTestId("fluid-artwork-bg")).toBeDefined();
			expect(screen.getByTestId("mobile-transport-controls")).toBe(transports);
			expect(screen.getByTestId("mobile-playback-waveform")).toBe(waveform);
			fireEvent.click(toggle);
			expect(screen.queryByTestId("fluid-artwork-bg")).toBeNull();
		},
	);

	describe("Queue preference persistence", () => {
		it("1. defaults queue to OPEN when no preference is saved", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			// In desktop fullscreen, queue panel should be open by default
			expect(screen.getByText("Playing next")).toBeDefined();
			expect(screen.getByText("Queue")).toBeDefined();
			expect(screen.getByText("Nebula Dreams")).toBeDefined();
		});

		it("2. opens queue when saved preference is OPEN ('true')", () => {
			window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "true");

			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			expect(screen.getByText("Playing next")).toBeDefined();
			expect(screen.getByText("Queue")).toBeDefined();
		});

		it("3. keeps queue CLOSED when saved preference is CLOSED ('false')", () => {
			window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "false");

			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			expect(screen.queryByText("Playing next")).toBeNull();
		});

		it("4. changing OPEN -> CLOSED persists preference", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			const hideQueueBtn = screen.getByRole("button", { name: "Hide queue" });
			fireEvent.click(hideQueueBtn);

			expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe(
				"false",
			);
			expect(getFullscreenDesktopQueueOpen()).toBe(false);
			expect(screen.queryByText("Playing next")).toBeNull();
		});

		it("5. changing CLOSED -> OPEN persists preference", () => {
			window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, "false");

			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			const showQueueBtn = screen.getByRole("button", { name: "Show queue" });
			fireEvent.click(showQueueBtn);

			expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe(
				"true",
			);
			expect(getFullscreenDesktopQueueOpen()).toBe(true);
			expect(screen.getByText("Playing next")).toBeDefined();
		});

		it("6. survives simulated reload / new player session", () => {
			// Session 1: User toggles queue closed
			const { unmount } = render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			fireEvent.click(screen.getByRole("button", { name: "Hide queue" }));
			expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe(
				"false",
			);
			unmount();

			// Session 2: User opens fullscreen in a new session / track
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			// Queue should still be closed!
			expect(screen.queryByText("Playing next")).toBeNull();
		});
	});

	describe("Comments & Notes in Fullscreen", () => {
		it("7. provides Notes button and displays NotesPanel on desktop", async () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			const notesBtn = screen.getByRole("button", { name: "Show notes" });
			expect(notesBtn).toBeDefined();

			fireEvent.click(notesBtn);

			// Notes panel should be visible with track info
			expect(await screen.findByTestId("notes-panel")).toBeDefined();
			expect(screen.getByText("Notes for Cosmic Odyssey")).toBeDefined();

			// Closing notes via close button
			fireEvent.click(screen.getByTestId("close-notes-btn"));
			expect(screen.queryByTestId("notes-panel")).toBeNull();
		});

		it("8. provides Comments button and mounts WaveformComments with fullscreen placement", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			// Comments button exists
			const commentsBtn = screen.getByRole("button", { name: "Comments" });
			expect(commentsBtn).toBeDefined();

			// Waveform comments mounted
			const waveformComments = screen.getByTestId("waveform-comments");
			expect(waveformComments.getAttribute("data-placement")).toBe(
				"fullscreen",
			);
			expect(waveformComments.getAttribute("data-version")).toBe("42");
			expect(waveformComments.getAttribute("data-fill-embedded")).toBe("false");
		});

		it("9. closes the active panel before collapsing fullscreen", async () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			// Open notes
			fireEvent.click(screen.getByRole("button", { name: "Show notes" }));
			expect(await screen.findByTestId("notes-panel")).toBeDefined();

			// Escape closes notes first
			fireEvent.keyDown(window, { key: "Escape" });
			expect(screen.queryByTestId("notes-panel")).toBeNull();

			// Integrated panels are mutually exclusive, so Notes replaced Queue.
			expect(screen.queryByText("Playing next")).toBeNull();

			// Next Escape collapses fullscreen.
			fireEvent.keyDown(window, { key: "Escape" });
			expect(mockCloseNowPlaying).toHaveBeenCalledTimes(1);
		});

		it("10. supports Comments and Notes on mobile variant", async () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="mobile"
				/>,
			);

			// Mobile bottom bar buttons
			const commentsBtn = screen.getByRole("button", { name: "Comments" });
			const notesBtn = screen.getByRole("button", { name: "Notes" });
			const queueBtn = screen.getByRole("button", { name: "Open queue" });
			const waveform = screen.getByTestId("mobile-playback-waveform");
			const transports = screen.getByTestId("mobile-transport-controls");
			const panelControls = screen.getByTestId("mobile-panel-controls");

			expect(commentsBtn).toBeDefined();
			expect(notesBtn).toBeDefined();
			expect(queueBtn).toBeDefined();
			expect(
				screen.getByRole("button", { name: "Toggle shuffle" }),
			).toBeDefined();
			expect(
				screen.getByRole("button", { name: "Change repeat mode" }),
			).toBeDefined();

			// Tapping Notes on mobile opens NotesPanel
			fireEvent.click(notesBtn);
			expect(await screen.findByTestId("notes-panel")).toBeDefined();
			expect(screen.getByText("Notes for Cosmic Odyssey")).toBeDefined();
			expect(screen.getByTestId("mobile-active-panel")).toBeDefined();
			expect(
				screen.getByTestId("mobile-artwork-region").firstElementChild,
			).toBe(screen.getByTestId("mobile-active-panel"));
			expect(screen.getByTestId("mobile-artwork-card").className).toContain(
				"size-14",
			);
			expect(
				screen
					.getByTestId("mobile-header-artwork-slot")
					.contains(screen.getByTestId("mobile-artwork-card")),
			).toBe(true);
			const headerDetails = screen.getByTestId("mobile-header-track-details");
			expect(screen.queryByTestId("mobile-track-details")).toBeNull();
			expect(headerDetails.textContent).toContain("Cosmic Odyssey");
			expect(headerDetails.textContent).toContain("Astro Beats");
			expect(screen.getByTestId("mobile-playback-waveform")).toBe(waveform);
			expect(screen.getByTestId("mobile-transport-controls")).toBe(transports);
			expect(screen.getByTestId("mobile-panel-controls")).toBe(panelControls);
			expect(screen.getByTestId("fluid-artwork-bg")).toBeDefined();

			fireEvent.click(commentsBtn);
			expect(screen.queryByTestId("notes-panel")).toBeNull();
			expect(screen.getByTestId("mobile-header-track-details")).toBe(
				headerDetails,
			);
			expect(screen.getByTestId("mobile-playback-waveform")).toBe(waveform);
			expect(screen.getByTestId("mobile-transport-controls")).toBe(transports);

			fireEvent.click(queueBtn);
			expect(screen.getByTestId("mobile-queue-panel")).toBeDefined();
			expect(screen.getByTestId("mobile-panel-controls")).toBe(panelControls);
		});

		it("11. uses one integrated right rail for queue, notes, and comments", async () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			expect(screen.getAllByTestId("fullscreen-side-panel")).toHaveLength(1);

			fireEvent.click(screen.getByRole("button", { name: "Show notes" }));
			expect(screen.queryByText("Playing next")).toBeNull();
			expect(
				(await screen.findByTestId("notes-panel")).getAttribute("data-embedded"),
			).toBe("true");
			expect(screen.getAllByTestId("fullscreen-side-panel")).toHaveLength(1);

			fireEvent.click(screen.getByRole("button", { name: "Comments" }));
			expect(screen.queryByTestId("notes-panel")).toBeNull();
			expect(screen.getAllByTestId("fullscreen-side-panel")).toHaveLength(1);
		});

		it("12. desktop queue provides reorder handles and track action options", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			const reorderHandles = document.querySelectorAll(
				'[aria-label^="Reorder"]',
			);
			expect(reorderHandles.length).toBe(sampleQueue.length);

			const optionButtons = document.querySelectorAll(
				'[aria-label^="Options for"]',
			);
			expect(optionButtons.length).toBe(sampleQueue.length);
		});

		it("13. uses a collapse control instead of a close icon", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			fireEvent.click(
				screen.getByRole("button", { name: "Collapse Now Playing" }),
			);
			expect(mockCloseNowPlaying).toHaveBeenCalledTimes(1);
		});

		it("14. dismisses a mobile pull only after distance or velocity threshold", () => {
			expect(shouldDismissNowPlaying(121, 0)).toBe(true);
			expect(shouldDismissNowPlaying(49, 651)).toBe(true);
			expect(shouldDismissNowPlaying(47, 900)).toBe(false);
			expect(shouldDismissNowPlaying(80, 200)).toBe(false);
		});

		it("15. keeps the underlying light theme unchanged throughout fullscreen", () => {
			document.documentElement.classList.add("light");
			document.documentElement.style.colorScheme = "light";

			const { unmount } = render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			expect(document.documentElement.classList.contains("light")).toBe(true);
			expect(document.documentElement.classList.contains("black")).toBe(false);
			expect(document.documentElement.style.colorScheme).toBe("light");
			expect(screen.getByRole("dialog").classList.contains("black")).toBe(true);

			unmount();

			expect(document.documentElement.classList.contains("light")).toBe(true);
			expect(document.documentElement.classList.contains("black")).toBe(false);
			expect(document.documentElement.style.colorScheme).toBe("light");
		});
	});
});
