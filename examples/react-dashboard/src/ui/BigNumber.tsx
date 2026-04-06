import { useEffect, useRef, useState } from "react";
import type { BigNumberPayload } from "../dashboard/types";

interface BigNumberProps {
  payload: BigNumberPayload;
}

/**
 * Big number component that renders a key value in a very large font,
 * with adaptive label and sublabel sizing via ResizeObserver.
 * The value font size is computed to avoid overflow.
 */
export function BigNumber({ payload }: BigNumberProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<number>(72);

  // Fit the value size to the available space.
  useEffect(() => {
    const container = containerRef.current;
    const valueEl = valueRef.current;
    if (!container || !valueEl) return;

    const fit = (): void => {
      const available = container.clientWidth - 32; // 16px horizontal padding on each side
      const available_h = container.clientHeight - 80; // reserve space for label + delta

      // Binary search between 24px and 120px
      let lo = 24;
      let hi = Math.min(120, available_h * 0.65);
      let best = lo;

      for (let iter = 0; iter < 10; iter++) {
        const mid = (lo + hi) / 2;
        valueEl.style.fontSize = `${mid}px`;
        if (valueEl.scrollWidth <= available) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      setFontSize(best);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [payload.value]);

  const toneClass =
    payload.tone === "positive"
      ? "tone-positive"
      : payload.tone === "negative"
      ? "tone-negative"
      : "tone-neutral";

  return (
    <div ref={containerRef} className="bignumber-root">
      {payload.label && (
        <p className="bignumber-label">{payload.label}</p>
      )}
      <div
        ref={valueRef}
        className={`bignumber-value ${toneClass}`}
        style={{ fontSize }}
        aria-label={`${payload.title}: ${payload.value}`}
      >
        {payload.value}
      </div>
      {payload.delta && (
        <span className={`bignumber-delta ${toneClass}`}>{payload.delta}</span>
      )}
      {payload.sublabel && (
        <p className="bignumber-sublabel">{payload.sublabel}</p>
      )}
    </div>
  );
}
