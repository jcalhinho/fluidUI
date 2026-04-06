import { useEffect, useRef, useState } from "react";
import type { BigNumberPayload } from "../dashboard/types";
import { computeBigNumberFontSize } from "./bigNumberSizing";

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
  const lastGoodFontSizeRef = useRef<number>(72);

  // Fit the value size to the available space.
  useEffect(() => {
    const container = containerRef.current;
    const valueEl = valueRef.current;
    if (!container || !valueEl) return;

    const fit = (): void => {
      const availableWidth = container.clientWidth - 32; // 16px horizontal padding on each side
      const availableHeight = container.clientHeight - 80; // reserve space for label + delta
      const previousInlineFontSize = valueEl.style.fontSize;
      const fitted = computeBigNumberFontSize({
        availableWidth,
        availableHeight,
        previousFontSize: lastGoodFontSizeRef.current,
        measure: (candidateFontSize: number) => {
          valueEl.style.fontSize = `${candidateFontSize}px`;
          return {
            width: valueEl.scrollWidth,
            height: valueEl.scrollHeight,
          };
        },
      });
      valueEl.style.fontSize = previousInlineFontSize;

      if (!Number.isFinite(fitted)) return;

      const normalized = Math.round(fitted * 10) / 10;
      lastGoodFontSizeRef.current = normalized;
      setFontSize((current) =>
        Math.abs(current - normalized) < 0.1 ? current : normalized
      );
    };

    let rafId: number | null = null;
    const scheduleFit = (): void => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        fit();
      });
    };

    scheduleFit();
    const ro = new ResizeObserver(scheduleFit);
    ro.observe(container);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      ro.disconnect();
    };
  }, [payload.delta, payload.label, payload.sublabel, payload.value]);

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
