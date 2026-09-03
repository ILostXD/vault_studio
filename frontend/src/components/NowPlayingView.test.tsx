// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NowPlayingView from "./NowPlayingView";
import {
	FULLSCREEN_DESKTOP_QUEUE_KEY,
	getFullscreenDesktopQueueOpen,
} from "@/lib/fullscreenQueue";

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

vi.mock("@/contexts/AudioPlayerContext", () => ({
	useAudioPlayer: () => ({
		currentTrack: sampleTrack,
		isPlaying: true,
		duration: 180,
		previewProgress: 30,
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
	}),
}));

vi.mock("@/hooks/useProjectMotionAssets", () => ({
	useProjectMotionAssets: () => ({ data: [] }),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock("motion/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("motion/react")>();
	return {
		...actual,
		AnimatePresence: ({ children }: any) => <>{children}</>,
	};
});

vi.mock("@/components/motion/MotionArtworkStage", () => ({
	default: () => <div data-testid="motion-artwork-stage" />,
	MotionArtworkFlowBackground: () => <div data-testid="motion-artwork-bg" />,
}));

vi.mock("@/components/QueuePanel", () => ({
	default: ({ isOpen, onClose }: any) => (
		isOpen ? (
			<div data-testid="mobile-queue-panel">
				<button type="button" onClick={onClose} data-testid="close-mobile-queue-btn">
					Close Mobile Queue
				</button>
			</div>
		) : null
	),
}));

vi.mock("@/components/NotesPanel", () => ({
	default: ({ selectedTrack, onClose }: any) => (
		<div data-testid="notes-panel">
			<span>Notes for {selectedTrack?.title}</span>
			<button type="button" onClick={onClose} data-testid="close-notes-btn">
				Close Notes
			</button>
		</div>
	),
}));

vi.mock("@/components/WaveformComments", () => ({
	default: ({ placement, versionId, isOpen, onOpenChange }: any) => (
		<div data-testid="waveform-comments" data-placement={placement} data-version={versionId}>
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
		duration <= 0 ? 0 : Math.max(0, Math.min(100, (timestamp / duration) * 100)),
}));

describe("NowPlayingView Fullscreen QoL", () => {
	let storage: Storage;

	beforeEach(() => {
		vi.clearAllMocks();
		storage = createStorage();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: storage,
		});
	});

	afterEach(() => {
		cleanup();
	});

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

			expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe("false");
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

			expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe("true");
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
			expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe("false");
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
		it("7. provides Notes button and displays NotesPanel on desktop", () => {
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
			expect(screen.getByTestId("notes-panel")).toBeDefined();
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
			expect(waveformComments.getAttribute("data-placement")).toBe("fullscreen");
			expect(waveformComments.getAttribute("data-version")).toBe("42");
		});

		it("9. handles layered Escape key navigation: notes -> queue -> exit", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			// Open notes
			fireEvent.click(screen.getByRole("button", { name: "Show notes" }));
			expect(screen.getByTestId("notes-panel")).toBeDefined();

			// Escape closes notes first
			fireEvent.keyDown(window, { key: "Escape" });
			expect(screen.queryByTestId("notes-panel")).toBeNull();

			// Queue is still open
			expect(screen.getByText("Playing next")).toBeDefined();

			// Next Escape closes queue and persists preference to false
			fireEvent.keyDown(window, { key: "Escape" });
			expect(screen.queryByText("Playing next")).toBeNull();
			expect(window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY)).toBe("false");
			expect(mockCloseNowPlaying).not.toHaveBeenCalled();

			// Next Escape exits fullscreen
			fireEvent.keyDown(window, { key: "Escape" });
			expect(mockCloseNowPlaying).toHaveBeenCalledTimes(1);
		});

		it("10. supports Comments and Notes on mobile variant", () => {
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

			expect(commentsBtn).toBeDefined();
			expect(notesBtn).toBeDefined();
			expect(queueBtn).toBeDefined();

			// Tapping Notes on mobile opens NotesPanel
			fireEvent.click(notesBtn);
			expect(screen.getByTestId("notes-panel")).toBeDefined();
			expect(screen.getByText("Notes for Cosmic Odyssey")).toBeDefined();
		});

		it("11. positions comments and notes on the left and queue on the right in desktop mode", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			const leftContainer = document.querySelector(".absolute.left-0");
			expect(leftContainer).toBeTruthy();
			expect(leftContainer?.querySelector('button[aria-label="Comments"]')).toBeTruthy();
			expect(leftContainer?.querySelector('button[aria-label="Show notes"]')).toBeTruthy();

			const rightContainer = document.querySelector(".absolute.right-0");
			expect(rightContainer).toBeTruthy();
			expect(rightContainer?.querySelector('button[aria-label="Hide queue"]')).toBeTruthy();
		});

		it("12. desktop queue provides reorder handles and track action options", () => {
			render(
				<NowPlayingView
					projectId="proj_abc"
					projectName="Astro Album"
					variant="desktop"
				/>,
			);

			const reorderHandles = document.querySelectorAll('[aria-label^="Reorder"]');
			expect(reorderHandles.length).toBe(sampleQueue.length);

			const optionButtons = document.querySelectorAll('[aria-label^="Options for"]');
			expect(optionButtons.length).toBe(sampleQueue.length);
		});
	});
});
