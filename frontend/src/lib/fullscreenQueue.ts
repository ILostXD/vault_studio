export const FULLSCREEN_DESKTOP_QUEUE_KEY = "vault.fullscreenDesktopQueueOpen";

export function getFullscreenDesktopQueueOpen(): boolean {
	if (typeof window === "undefined") return true;
	try {
		const saved = window.localStorage.getItem(FULLSCREEN_DESKTOP_QUEUE_KEY);
		if (saved === null) return true;
		return saved === "true";
	} catch (error) {
		console.error("Failed to read fullscreen queue preference:", error);
		return true;
	}
}

export function setFullscreenDesktopQueueOpen(open: boolean): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(FULLSCREEN_DESKTOP_QUEUE_KEY, String(open));
	} catch (error) {
		console.error("Failed to save fullscreen queue preference:", error);
	}
}
