import type { AssetThresholds } from './types';

/** Initial heuristics only — not universal performance standards. */
export const DEFAULT_ASSET_THRESHOLDS: AssetThresholds = {
  image: { warning: 200 * 1024, critical: 500 * 1024 },
  javascript: { warning: 100 * 1024, critical: 300 * 1024 },
  css: { warning: 50 * 1024, critical: 150 * 1024 },
  font: { warning: 100 * 1024, critical: 200 * 1024 },
  video: { warning: 2 * 1024 * 1024, critical: 5 * 1024 * 1024 },
  slowDurationMs: { warning: 1000, critical: 3000 },
  excessiveCount: { warning: 100, critical: 200 },
  oversizedDimensionRatio: 2,
};

export function thresholdsForType(
  thresholds: AssetThresholds,
  type: keyof Pick<AssetThresholds, 'image' | 'javascript' | 'css' | 'font' | 'video'>,
): { warning: number; critical: number } {
  return thresholds[type];
}
