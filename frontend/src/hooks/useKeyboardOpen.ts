import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { useEffect, useState } from "react";

/** True while a software keyboard is open: native plugin events, or a shrunken visual viewport on touch devices. Never true on desktop. */
export function useKeyboardOpen() {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const handles: Promise<{ remove: () => void }>[] = [];
		if (Capacitor.isNativePlatform()) {
			handles.push(
				Keyboard.addListener("keyboardWillShow", () => setOpen(true)),
			);
			handles.push(
				Keyboard.addListener("keyboardWillHide", () => setOpen(false)),
			);
		}
		const vv = window.visualViewport;
		const coarse = window.matchMedia("(pointer: coarse)");
		const onResize = () => {
			if (vv && coarse.matches) setOpen(window.innerHeight - vv.height > 150);
		};
		vv?.addEventListener("resize", onResize);
		return () => {
			for (const handle of handles) void handle.then((h) => h.remove());
			vv?.removeEventListener("resize", onResize);
		};
	}, []);
	return open;
}
