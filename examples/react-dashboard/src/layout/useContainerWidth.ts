import { useEffect, useState, type RefObject } from "react";

export function useContainerWidth(
  ref: RefObject<HTMLElement>,
  fallbackWidth?: number,
): number {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return fallbackWidth ?? 0;
    return ref.current?.clientWidth ?? fallbackWidth ?? window.innerWidth ?? 0;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = (): void => {
      const next = element.clientWidth;
      if (next > 0) {
        setWidth(next);
      }
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}
