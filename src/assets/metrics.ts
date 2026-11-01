import type { SizeMetricUsed } from './types';

/**
 * Performance Resource Timing may report 0 for cross-origin resources without
 * Timing-Allow-Origin, and for some cached responses. A literal 0 is only trusted
 * when the response body sizes are also exposed as 0 with a same-origin/TAO signal.
 */
export function normalizeSizeField(
  value: number | undefined,
  options: { sameOrigin: boolean; encodedBodySize?: number; decodedBodySize?: number },
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (value > 0) return Math.round(value);
  if (!options.sameOrigin) return null;
  const encoded = options.encodedBodySize;
  const decoded = options.decodedBodySize;
  const encodedKnown = typeof encoded === 'number' && Number.isFinite(encoded);
  const decodedKnown = typeof decoded === 'number' && Number.isFinite(decoded);
  if (encodedKnown || decodedKnown) return 0;
  return null;
}

export function pickEffectiveSize(input: {
  transferSize: number | null;
  encodedBodySize: number | null;
}): { effectiveSize: number | null; sizeMetricUsed: SizeMetricUsed; sizeUnavailable: boolean } {
  if (input.transferSize != null) {
    return { effectiveSize: input.transferSize, sizeMetricUsed: 'transfer', sizeUnavailable: false };
  }
  if (input.encodedBodySize != null) {
    return { effectiveSize: input.encodedBodySize, sizeMetricUsed: 'encoded', sizeUnavailable: false };
  }
  return { effectiveSize: null, sizeMetricUsed: 'none', sizeUnavailable: true };
}

export function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const digits = amount >= 100 || unit === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[unit]}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return 'Unavailable';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function resolveAbsoluteUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) {
    return null;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}
