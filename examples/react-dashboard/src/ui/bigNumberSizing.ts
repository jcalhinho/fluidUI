interface FontMetrics {
  width: number;
  height: number;
}

interface ComputeBigNumberFontSizeInput {
  availableWidth: number;
  availableHeight: number;
  previousFontSize: number;
  measure: (candidateFontSize: number) => FontMetrics;
  minFontSize?: number;
  maxFontSize?: number;
  maxIterations?: number;
}

const DEFAULT_MIN_FONT_SIZE = 24;
const DEFAULT_MAX_FONT_SIZE = 120;
const HEIGHT_USAGE_RATIO = 0.65;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeBigNumberFontSize({
  availableWidth,
  availableHeight,
  previousFontSize,
  measure,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
  maxFontSize = DEFAULT_MAX_FONT_SIZE,
  maxIterations = 10,
}: ComputeBigNumberFontSizeInput): number {
  const boundedPrevious = clamp(previousFontSize, minFontSize, maxFontSize);

  if (!Number.isFinite(availableWidth) || !Number.isFinite(availableHeight)) {
    return boundedPrevious;
  }

  if (availableWidth <= 0 || availableHeight <= 0) {
    return boundedPrevious;
  }

  const upperBound = Math.max(
    minFontSize,
    Math.min(maxFontSize, availableHeight * HEIGHT_USAGE_RATIO)
  );

  if (upperBound <= minFontSize) {
    return clamp(boundedPrevious, minFontSize, upperBound);
  }

  const fits = (candidateFontSize: number): boolean => {
    const metrics = measure(candidateFontSize);
    if (!Number.isFinite(metrics.width) || !Number.isFinite(metrics.height)) {
      return false;
    }
    return (
      metrics.width <= availableWidth &&
      metrics.height <= availableHeight
    );
  };

  if (!fits(minFontSize)) {
    return minFontSize;
  }

  let low = minFontSize;
  let high = upperBound;
  let best = minFontSize;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const candidate = (low + high) / 2;
    if (fits(candidate)) {
      best = candidate;
      low = candidate;
    } else {
      high = candidate;
    }
  }

  return clamp(best, minFontSize, upperBound);
}
