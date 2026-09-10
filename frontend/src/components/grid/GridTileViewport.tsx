import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useIsPresent } from "motion/react";

const OVERSCAN_PX = 600;
const visibilityListeners = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | undefined;

function observeTile(element: Element, onVisibilityChange: (visible: boolean) => void) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visibilityListeners.get(entry.target)?.(entry.isIntersecting);
      }
    },
    { rootMargin: `${OVERSCAN_PX}px 0px` },
  );
  visibilityListeners.set(element, onVisibilityChange);
  observer.observe(element);

  return () => {
    observer?.unobserve(element);
    visibilityListeners.delete(element);
    if (visibilityListeners.size === 0) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}

interface GridTileViewportProps {
  label: string;
  pinned: boolean;
  children: ReactNode;
}

// Keep the flex slot stable; only the expensive card subtree is windowed.
// ponytail: O(n) lightweight slots preserve drag layout; use row windowing for very large catalogs.
export const GridTileViewport = forwardRef<HTMLDivElement, GridTileViewportProps>(
  function GridTileViewport({ label, pinned, children }, forwardedRef) {
    const slotRef = useRef<HTMLDivElement | null>(null);
    const focusPlaceholderRef = useRef<"first" | "last" | null>(null);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
    const [focused, setFocused] = useState(false);
    const isPresent = useIsPresent();
    const lastMountedRef = useRef(false);
    const mounted = isPresent ? visible || pinned || focused : lastMountedRef.current;

    useLayoutEffect(() => {
      // Let mounted cards finish their existing exit animation, even if scrolled away.
      lastMountedRef.current = mounted;
    }, [mounted]);

    const setRef = useCallback((element: HTMLDivElement | null) => {
      slotRef.current = element;
      if (typeof forwardedRef === "function") forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    }, [forwardedRef]);

    useLayoutEffect(() => {
      const slot = slotRef.current;
      let unobserve: (() => void) | undefined;
      if (slot && typeof IntersectionObserver !== "undefined") {
        // Prime the first viewport before paint, without mounting the entire library.
        const rect = slot.getBoundingClientRect();
        setVisible(rect.bottom >= -OVERSCAN_PX && rect.top <= window.innerHeight + OVERSCAN_PX);
        unobserve = observeTile(slot, setVisible);
      }
      return () => {
        unobserve?.();
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      };
    }, []);

    useLayoutEffect(() => {
      if (!mounted || !focusPlaceholderRef.current) return;
      const controls = slotRef.current?.querySelectorAll<HTMLElement>(
        '[tabindex="0"], button:not([disabled]), a[href]',
      );
      const target = focusPlaceholderRef.current === "last"
        ? controls?.item(controls.length - 1)
        : controls?.item(0);
      focusPlaceholderRef.current = null;
      target?.focus();
    }, [mounted]);

    return (
      <div
        ref={setRef}
        className="relative w-40 h-54 shrink-0"
        data-grid-slot=""
        data-card-mounted={mounted}
        role="group"
        aria-label={label}
        tabIndex={mounted ? undefined : 0}
        onFocusCapture={(event) => {
          if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
          if (event.target === event.currentTarget) {
            const fromLaterItem = event.relatedTarget instanceof Node &&
              Boolean(event.currentTarget.compareDocumentPosition(event.relatedTarget) & Node.DOCUMENT_POSITION_FOLLOWING);
            focusPlaceholderRef.current = fromLaterItem ? "last" : "first";
          }
          setFocused(true);
        }}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          // Portaled menus still bubble React focus events through this slot.
          if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
          blurTimerRef.current = setTimeout(() => setFocused(false), 0);
        }}
      >
        {mounted ? children : (
          <div aria-hidden="true" className="aspect-square rounded-(--card-border-radius) bg-(--bg-2)" />
        )}
      </div>
    );
  },
);
