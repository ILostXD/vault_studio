// Firefox ignores SVG url() filters inside backdrop-filter, so the refraction never renders there.
export const noSvgBackdrop =
	typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);

/** backdrop-filter for a glass button: SVG refraction where supported, plain blur in Firefox. */
export const glassBackdrop = (filterId: string) =>
	noSvgBackdrop ? "blur(6px) saturate(1.4)" : `url(#${filterId})`;

if (noSvgBackdrop && typeof document !== "undefined") {
	document.documentElement.dataset.noSvgBackdrop = "";
}
