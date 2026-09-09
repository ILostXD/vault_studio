import { useLayoutEffect } from "react";

const locks = new Set<symbol>();
let previousOverflow = "";

export function useBodyScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const token = Symbol();
    if (locks.size === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    locks.add(token);
    return () => {
      locks.delete(token);
      if (locks.size === 0) document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}
