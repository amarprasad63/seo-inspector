import { classifyResource, domainOf, filenameOf, formatFromUrl } from './classifier';
import type { PerformanceResourceTimingLike } from './collector-buffer';
import { normalizeSizeField, pickEffectiveSize, resolveAbsoluteUrl } from './metrics';
import type { AssetCollection, AssetType, DomAssetHints, RawAssetEntry } from './types';

const RESOURCE_BUFFER_SIZE = 600;

export interface CollectAssetsOptions {
  maxAssets?: number;
  performanceEntries?: readonly PerformanceResourceTimingLike[];
  observedEntries?: readonly PerformanceResourceTimingLike[];
}

interface DomCandidate {
  url: string;
  type: AssetType;
  hints: DomAssetHints;
}

export function ensureResourceTimingBuffer(perf: Performance = performance): void {
  try {
    if (typeof perf.setResourceTimingBufferSize === 'function') {
      perf.setResourceTimingBufferSize(RESOURCE_BUFFER_SIZE);
    }
  } catch {
    // Some environments disallow buffer configuration.
  }
}

export function createResourceTimingObserver(
  onEntry: (entry: PerformanceResourceTimingLike) => void,
  perf: Performance = performance,
): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') onEntry(entry as PerformanceResourceTiming);
      }
    });
    observer.observe({ type: 'resource', buffered: true });
    return observer;
  } catch {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) onEntry(entry as PerformanceResourceTiming);
      });
      observer.observe({ entryTypes: ['resource'] });
      return observer;
    } catch {
      void perf;
      return null;
    }
  }
}

export function collectAssets(
  doc: Document,
  options: CollectAssetsOptions = {},
  perf: Performance = performance,
): AssetCollection {
  ensureResourceTimingBuffer(perf);
  const pageUrl = doc.URL || 'about:blank';
  let pageOrigin = '';
  try {
    pageOrigin = new URL(pageUrl).origin;
  } catch {
    pageOrigin = '';
  }

  const maxAssets = options.maxAssets ?? 500;
  const notes: string[] = [
    'Sizes and timings come from the Performance Resource Timing API when available.',
    'Cross-origin resources often hide transfer and body sizes unless Timing-Allow-Origin is present.',
    'A zero transfer size is not treated as a zero-byte download when size data is unavailable.',
    'DOM discovery does not mean a resource was successfully downloaded.',
    'Thresholds are configurable heuristics, not universal performance standards.',
  ];

  const byUrl = new Map<string, RawAssetEntry>();
  const timingEntries = mergeTimingEntries(
    options.performanceEntries ?? getResourceEntries(perf),
    options.observedEntries ?? [],
  );

  for (const entry of timingEntries) {
    const absolute = resolveAbsoluteUrl(entry.name, pageUrl);
    if (!absolute) continue;
    const record = fromTiming(entry, pageUrl, pageOrigin);
    const existing = byUrl.get(absolute);
    if (!existing || (!existing.requested && record.requested)) {
      byUrl.set(absolute, record);
    } else if (existing.requested && record.requested) {
      byUrl.set(absolute, preferRicherTiming(existing, record));
    }
  }

  const domCandidates = collectDomCandidates(doc, pageUrl);
  for (const candidate of domCandidates) {
    const existing = byUrl.get(candidate.url);
    if (existing) {
      byUrl.set(candidate.url, {
        ...existing,
        type: existing.type === 'other' ? candidate.type : existing.type,
        discoveredInDom: true,
        hints: mergeHints(existing.hints, candidate.hints),
      });
      continue;
    }
    const { domain, sameOrigin } = domainOf(candidate.url, pageOrigin);
    byUrl.set(candidate.url, {
      id: `dom:${byUrl.size}`,
      url: candidate.url,
      type: candidate.type,
      initiatorType: null,
      transferSize: null,
      encodedBodySize: null,
      decodedBodySize: null,
      duration: null,
      startTime: null,
      responseStatus: null,
      domain,
      format: formatFromUrl(candidate.url),
      sameOrigin,
      discoveredInDom: true,
      requested: false,
      sizeMetricUsed: 'none',
      effectiveSize: null,
      sizeUnavailable: true,
      filename: filenameOf(candidate.url),
      hints: candidate.hints,
    });
  }

  const all = [...byUrl.values()].sort((left, right) => {
    const leftSize = left.effectiveSize ?? -1;
    const rightSize = right.effectiveSize ?? -1;
    return rightSize - leftSize;
  });
  const omitted = Math.max(0, all.length - maxAssets);
  const entries = all.slice(0, maxAssets).map((entry, index) => ({ ...entry, id: `asset:${index}` }));

  if (omitted > 0) {
    notes.push(`${omitted} additional resources were discovered but not inventoried.`);
  }

  return {
    pageUrl,
    pageOrigin,
    collectedAt: new Date().toISOString(),
    entries,
    omitted,
    notes,
  };
}

function getResourceEntries(perf: Performance): PerformanceResourceTimingLike[] {
  try {
    return perf.getEntriesByType('resource') as PerformanceResourceTiming[];
  } catch {
    return [];
  }
}

function mergeTimingEntries(
  primary: readonly PerformanceResourceTimingLike[],
  secondary: readonly PerformanceResourceTimingLike[],
): PerformanceResourceTimingLike[] {
  const map = new Map<string, PerformanceResourceTimingLike>();
  for (const entry of [...primary, ...secondary]) {
    const key = `${entry.name}\u0000${entry.startTime}\u0000${entry.duration}\u0000${entry.initiatorType}`;
    if (!map.has(key)) map.set(key, entry);
  }
  return [...map.values()];
}

function fromTiming(entry: PerformanceResourceTimingLike, pageUrl: string, pageOrigin: string): RawAssetEntry {
  const absolute = resolveAbsoluteUrl(entry.name, pageUrl) ?? entry.name;
  const { domain, sameOrigin } = domainOf(absolute, pageOrigin);
  const encodedBodySize = normalizeSizeField(entry.encodedBodySize, {
    sameOrigin,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
  });
  const decodedBodySize = normalizeSizeField(entry.decodedBodySize, {
    sameOrigin,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
  });
  const transferSize = normalizeTransferSize(entry, sameOrigin, encodedBodySize, decodedBodySize);
  const sizes = pickEffectiveSize({ transferSize, encodedBodySize });
  const responseStatus = readResponseStatus(entry);

  return {
    id: `perf:${absolute}`,
    url: absolute,
    type: classifyResource({ url: absolute, initiatorType: entry.initiatorType }),
    initiatorType: entry.initiatorType || null,
    transferSize,
    encodedBodySize,
    decodedBodySize,
    duration: Number.isFinite(entry.duration) ? Math.round(entry.duration) : null,
    startTime: Number.isFinite(entry.startTime) ? Math.round(entry.startTime) : null,
    responseStatus,
    domain,
    format: formatFromUrl(absolute),
    sameOrigin,
    discoveredInDom: false,
    requested: true,
    sizeMetricUsed: sizes.sizeMetricUsed,
    effectiveSize: sizes.effectiveSize,
    sizeUnavailable: sizes.sizeUnavailable,
    filename: filenameOf(absolute),
    hints: null,
  };
}

function normalizeTransferSize(
  entry: PerformanceResourceTimingLike,
  sameOrigin: boolean,
  encodedBodySize: number | null,
  decodedBodySize: number | null,
): number | null {
  const value = entry.transferSize;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (value > 0) return Math.round(value);
  // Cached same-origin responses can legitimately report transferSize 0.
  if (sameOrigin && (encodedBodySize != null || decodedBodySize != null || entry.decodedBodySize === 0)) {
    return 0;
  }
  if (sameOrigin && entry.encodedBodySize === 0 && entry.decodedBodySize === 0) return 0;
  return null;
}

function readResponseStatus(entry: PerformanceResourceTimingLike): number | null {
  if (typeof entry.responseStatus === 'number' && Number.isFinite(entry.responseStatus)) {
    return entry.responseStatus;
  }
  return null;
}

function preferRicherTiming(left: RawAssetEntry, right: RawAssetEntry): RawAssetEntry {
  const leftScore =
    (left.transferSize != null ? 4 : 0) + (left.encodedBodySize != null ? 2 : 0) + (left.duration != null ? 1 : 0);
  const rightScore =
    (right.transferSize != null ? 4 : 0) + (right.encodedBodySize != null ? 2 : 0) + (right.duration != null ? 1 : 0);
  return rightScore > leftScore ? right : left;
}

function collectDomCandidates(doc: Document, pageUrl: string): DomCandidate[] {
  const found = new Map<string, DomCandidate>();

  const add = (rawUrl: string, type: AssetType, hints: DomAssetHints) => {
    const absolute = resolveAbsoluteUrl(rawUrl, pageUrl);
    if (!absolute) return;
    const existing = found.get(absolute);
    if (existing) {
      found.set(absolute, { ...existing, hints: mergeHints(existing.hints, hints) ?? hints });
      return;
    }
    found.set(absolute, { url: absolute, type, hints });
  };

  for (const image of doc.querySelectorAll('img')) {
    const el = image as HTMLImageElement;
    add(el.currentSrc || el.getAttribute('src') || '', 'image', imageHints(el));
    collectSrcset(el.getAttribute('srcset'), (url) => add(url, 'image', imageHints(el)));
  }

  for (const source of doc.querySelectorAll('picture source, audio source, video source')) {
    const parent = source.parentElement;
    const type: AssetType =
      parent?.tagName === 'VIDEO' || parent?.tagName === 'AUDIO'
        ? 'video'
        : source.getAttribute('type')?.startsWith('image/')
          ? 'image'
          : 'image';
    add(source.getAttribute('src') || '', type, emptyHints());
    collectSrcset(source.getAttribute('srcset'), (url) => add(url, type, emptyHints()));
  }

  for (const video of doc.querySelectorAll('video')) {
    const el = video as HTMLVideoElement;
    add(el.currentSrc || el.getAttribute('src') || '', 'video', emptyHints());
    add(el.getAttribute('poster') || '', 'image', emptyHints());
  }

  for (const audio of doc.querySelectorAll('audio')) {
    const el = audio as HTMLAudioElement;
    add(el.currentSrc || el.getAttribute('src') || '', 'video', emptyHints());
  }

  for (const script of doc.querySelectorAll('script[src]')) {
    const el = script as HTMLScriptElement;
    add(el.getAttribute('src') || '', 'javascript', scriptHints(el));
  }

  for (const link of doc.querySelectorAll('link[href]')) {
    const el = link as HTMLLinkElement;
    const rel = (el.getAttribute('rel') || '').toLowerCase();
    const asAttr = (el.getAttribute('as') || '').toLowerCase();
    const href = el.getAttribute('href') || '';
    if (rel.includes('stylesheet')) {
      add(href, 'css', styleHints(el));
      continue;
    }
    if (rel.includes('preload') || rel.includes('modulepreload') || rel.includes('prefetch')) {
      const hinted =
        asAttr === 'style' || asAttr === 'stylesheet'
          ? 'css'
          : asAttr === 'script'
            ? 'javascript'
            : asAttr === 'font'
              ? 'font'
              : asAttr === 'image'
                ? 'image'
                : asAttr === 'video' || asAttr === 'audio'
                  ? 'video'
                  : classifyResource({ url: resolveAbsoluteUrl(href, pageUrl) ?? href, initiatorType: 'link' });
      add(href, hinted, emptyHints({ crossOrigin: el.crossOrigin || el.getAttribute('crossorigin') }));
      continue;
    }
    if (rel.includes('icon') || rel.includes('apple-touch-icon') || rel.includes('image_src')) {
      add(href, 'image', emptyHints());
    }
  }

  return [...found.values()];
}

function collectSrcset(value: string | null, add: (url: string) => void): void {
  if (!value) return;
  for (const part of value.split(',')) {
    const url = part.trim().split(/\s+/)[0];
    if (url) add(url);
  }
}

function imageHints(el: HTMLImageElement): DomAssetHints {
  return {
    naturalWidth: finiteOrNull(el.naturalWidth),
    naturalHeight: finiteOrNull(el.naturalHeight),
    renderedWidth: finiteOrNull(el.clientWidth),
    renderedHeight: finiteOrNull(el.clientHeight),
    loading: el.getAttribute('loading'),
    hasWidthAttr: el.getAttribute('width') != null,
    hasHeightAttr: el.getAttribute('height') != null,
    aboveFold: aboveFold(el),
    async: null,
    defer: null,
    blockingHint: null,
    crossOrigin: el.crossOrigin || el.getAttribute('crossorigin'),
    media: null,
  };
}

function scriptHints(el: HTMLScriptElement): DomAssetHints {
  const async = el.hasAttribute('async');
  const defer = el.hasAttribute('defer');
  const type = (el.getAttribute('type') || '').toLowerCase();
  const moduleScript = type === 'module';
  const inHead = Boolean(el.closest('head'));
  const blockingAttr = el.getAttribute('blocking');
  const blockingHint = inHead && !async && !defer && !moduleScript && blockingAttr !== 'none';
  return {
    ...emptyHints(),
    async,
    defer,
    blockingHint,
    crossOrigin: el.crossOrigin || el.getAttribute('crossorigin'),
  };
}

function styleHints(el: HTMLLinkElement): DomAssetHints {
  const media = el.getAttribute('media');
  const disabled = el.hasAttribute('disabled');
  const blockingAttr = el.getAttribute('blocking');
  const printOnly = Boolean(media && media.trim().toLowerCase() === 'print');
  const blockingHint = !disabled && !printOnly && blockingAttr !== 'none';
  return {
    ...emptyHints(),
    blockingHint,
    crossOrigin: el.crossOrigin || el.getAttribute('crossorigin'),
    media,
  };
}

function emptyHints(partial: Partial<DomAssetHints> = {}): DomAssetHints {
  return {
    naturalWidth: null,
    naturalHeight: null,
    renderedWidth: null,
    renderedHeight: null,
    loading: null,
    hasWidthAttr: false,
    hasHeightAttr: false,
    aboveFold: null,
    async: null,
    defer: null,
    blockingHint: null,
    crossOrigin: null,
    media: null,
    ...partial,
  };
}

function mergeHints(left: DomAssetHints | null, right: DomAssetHints | null): DomAssetHints | null {
  if (!left) return right;
  if (!right) return left;
  return {
    naturalWidth: left.naturalWidth ?? right.naturalWidth,
    naturalHeight: left.naturalHeight ?? right.naturalHeight,
    renderedWidth: left.renderedWidth ?? right.renderedWidth,
    renderedHeight: left.renderedHeight ?? right.renderedHeight,
    loading: left.loading ?? right.loading,
    hasWidthAttr: left.hasWidthAttr || right.hasWidthAttr,
    hasHeightAttr: left.hasHeightAttr || right.hasHeightAttr,
    aboveFold: left.aboveFold ?? right.aboveFold,
    async: left.async ?? right.async,
    defer: left.defer ?? right.defer,
    blockingHint: left.blockingHint ?? right.blockingHint,
    crossOrigin: left.crossOrigin ?? right.crossOrigin,
    media: left.media ?? right.media,
  };
}

function aboveFold(element: Element): boolean | null {
  try {
    const rect = element.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return rect.top < (globalThis.innerHeight || 800) && rect.bottom > 0;
  } catch {
    return null;
  }
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : value === 0 ? 0 : null;
}
