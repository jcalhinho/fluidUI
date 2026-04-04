import { useEffect, useState, type RefObject } from "react";

export function useContainerWidth(
  ref: RefObject<HTMLElement>,
  fallbackWidth = 1200,
): number {
  const [width, setWidth] = useState<number>(fallbackWidth);

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
    update();

    return () => observer.disconnect();
  }, [ref]);

  return width;
}
