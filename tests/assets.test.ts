/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { analyzeAssets } from '../src/assets/analyzer';
import { classifyResource, extensionOf, formatFromUrl } from '../src/assets/classifier';
import { collectAssets } from '../src/assets/collector';
import type { PerformanceResourceTimingLike } from '../src/assets/collector-buffer';
import { buildAssetsCsv } from '../src/assets/exporter';
import { normalizeSizeField, pickEffectiveSize } from '../src/assets/metrics';
import type { AssetCollection, RawAssetEntry } from '../src/assets/types';

function timing(partial: Partial<PerformanceResourceTimingLike> & Pick<PerformanceResourceTimingLike, 'name'>): PerformanceResourceTimingLike {
  return {
    startTime: 10,
    duration: 120,
    initiatorType: 'script',
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    ...partial,
  };
}

function raw(partial: Partial<RawAssetEntry> & Pick<RawAssetEntry, 'url' | 'type'>): RawAssetEntry {
  return {
    id: partial.id ?? partial.url,
    initiatorType: null,
    transferSize: null,
    encodedBodySize: null,
    decodedBodySize: null,
    duration: null,
    startTime: null,
    responseStatus: null,
    domain: 'example.com',
    format: null,
    sameOrigin: true,
    discoveredInDom: false,
    requested: true,
    sizeMetricUsed: 'none',
    effectiveSize: null,
    sizeUnavailable: true,
    filename: partial.url.split('/').pop() ?? partial.url,
    hints: null,
    ...partial,
  };
}

describe('asset classifier and metrics', () => {
  it('classifies common extensions and initiators', () => {
    expect(classifyResource({ url: 'https://cdn.example/app.js', initiatorType: 'script' })).toBe('javascript');
    expect(classifyResource({ url: 'https://cdn.example/app.css', initiatorType: 'link' })).toBe('css');
    expect(classifyResource({ url: 'https://cdn.example/font.woff2', initiatorType: 'css' })).toBe('font');
    expect(classifyResource({ url: 'https://cdn.example/hero.webp', initiatorType: 'img' })).toBe('image');
    expect(classifyResource({ url: 'https://cdn.example/api', initiatorType: 'fetch' })).toBe('xhr');
    expect(extensionOf('https://cdn.example/a/b/photo.jpeg?x=1')).toBe('jpeg');
    expect(formatFromUrl('https://cdn.example/a/b/photo.jpeg')).toBe('JPEG');
  });

  it('does not treat unavailable zero sizes as real zero-byte downloads', () => {
    expect(normalizeSizeField(0, { sameOrigin: false })).toBeNull();
    expect(normalizeSizeField(0, { sameOrigin: true, encodedBodySize: 0, decodedBodySize: 0 })).toBe(0);
    expect(normalizeSizeField(2048, { sameOrigin: false })).toBe(2048);
    expect(pickEffectiveSize({ transferSize: null, encodedBodySize: 1500 })).toEqual({
      effectiveSize: 1500,
      sizeMetricUsed: 'encoded',
      sizeUnavailable: false,
    });
    expect(pickEffectiveSize({ transferSize: null, encodedBodySize: null }).sizeUnavailable).toBe(true);
  });
});

describe('asset collector', () => {
  it('deduplicates DOM and performance entries and marks request state', () => {
    document.title = 'Assets';
    document.head.innerHTML = `
      <link rel="stylesheet" href="https://example.com/styles.css">
      <script src="https://example.com/app.js"></script>
      <script src="https://third.example/tracker.js" async></script>
    `;
    document.body.innerHTML = `
      <img src="https://example.com/hero.jpg" width="800" height="600" loading="lazy">
      <img src="https://example.com/only-dom.png">
    `;

    const collection = collectAssets(document, {
      performanceEntries: [
        timing({
          name: 'https://example.com/app.js',
          initiatorType: 'script',
          transferSize: 120_000,
          encodedBodySize: 120_000,
          decodedBodySize: 360_000,
          duration: 400,
        }),
        timing({
          name: 'https://example.com/styles.css',
          initiatorType: 'link',
          transferSize: 12_000,
          encodedBodySize: 12_000,
          decodedBodySize: 40_000,
          duration: 80,
        }),
        timing({
          name: 'https://third.example/tracker.js',
          initiatorType: 'script',
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
          duration: 50,
        }),
        timing({
          name: 'https://example.com/hero.jpg',
          initiatorType: 'img',
          transferSize: 250_000,
          encodedBodySize: 250_000,
          decodedBodySize: 250_000,
          duration: 300,
        }),
      ],
    });

    const byUrl = new Map(collection.entries.map((entry) => [entry.url, entry]));
    expect(byUrl.get('https://example.com/app.js')?.requested).toBe(true);
    expect(byUrl.get('https://example.com/app.js')?.discoveredInDom).toBe(true);
    expect(byUrl.get('https://example.com/app.js')?.type).toBe('javascript');
    expect(byUrl.get('https://example.com/only-dom.png')?.requested).toBe(false);
    expect(byUrl.get('https://example.com/only-dom.png')?.discoveredInDom).toBe(true);
    expect(byUrl.get('https://third.example/tracker.js')?.transferSize).toBeNull();
    expect(byUrl.get('https://example.com/hero.jpg')?.effectiveSize).toBe(250_000);
    expect(collection.entries.filter((entry) => entry.url.includes('app.js'))).toHaveLength(1);
  });
});

describe('asset analyzer and csv', () => {
  it('flags large assets with the configured metric and exports escaped CSV', () => {
    const collection: AssetCollection = {
      pageUrl: 'https://example.com/page',
      pageOrigin: 'https://example.com',
      collectedAt: '2026-11-01T10:00:00.000Z',
      omitted: 0,
      notes: [],
      entries: [
        raw({
          url: 'https://example.com/big.js',
          type: 'javascript',
          transferSize: 320_000,
          encodedBodySize: 320_000,
          effectiveSize: 320_000,
          sizeMetricUsed: 'transfer',
          sizeUnavailable: false,
          duration: 1500,
          sameOrigin: true,
          domain: 'example.com',
          filename: 'big.js',
        }),
        raw({
          url: 'https://cdn.example/photo.jpg',
          type: 'image',
          transferSize: null,
          encodedBodySize: null,
          effectiveSize: null,
          sizeUnavailable: true,
          sameOrigin: false,
          domain: 'cdn.example',
          filename: 'photo.jpg',
          format: 'JPG',
          discoveredInDom: true,
          requested: true,
          hints: {
            naturalWidth: 2000,
            naturalHeight: 2000,
            renderedWidth: 200,
            renderedHeight: 200,
            loading: null,
            hasWidthAttr: false,
            hasHeightAttr: false,
            aboveFold: false,
            async: null,
            defer: null,
            blockingHint: null,
            crossOrigin: null,
            media: null,
          },
        }),
      ],
    };

    const report = analyzeAssets(collection);
    const script = report.assets.find((asset) => asset.filename === 'big.js');
    const image = report.assets.find((asset) => asset.filename === 'photo.jpg');
    expect(script?.severity).toBe('critical');
    expect(script?.warnings.some((item) => item.id === 'size-critical')).toBe(true);
    expect(script?.warnings.some((item) => item.id === 'slow-warning')).toBe(true);
    expect(image?.severity).toBe('warning');
    expect(image?.warnings.some((item) => item.id === 'oversized-dimensions')).toBe(true);
    expect(image?.warnings.some((item) => item.id === 'format-suggestion')).toBe(true);
    expect(report.summary.flagged).toBeGreaterThan(0);
    expect(report.summary.thirdParty).toBe(1);

    const csv = buildAssetsCsv(report);
    expect(csv.split('\n')[0]).toContain('Transfer size');
    expect(csv).toContain('big.js');
    expect(csv).toContain('Critical size');
    expect(csv).toContain('https://cdn.example/photo.jpg');
  });

  it('does not claim unused JS/CSS and avoids lazy advice for above-the-fold images', () => {
    const collection: AssetCollection = {
      pageUrl: 'https://example.com/page',
      pageOrigin: 'https://example.com',
      collectedAt: '2026-11-01T10:00:00.000Z',
      omitted: 0,
      notes: [],
      entries: [
        raw({
          url: 'https://example.com/hero.jpg',
          type: 'image',
          transferSize: 10_000,
          encodedBodySize: 10_000,
          effectiveSize: 10_000,
          sizeMetricUsed: 'transfer',
          sizeUnavailable: false,
          filename: 'hero.jpg',
          format: 'JPG',
          hints: {
            naturalWidth: 400,
            naturalHeight: 300,
            renderedWidth: 400,
            renderedHeight: 300,
            loading: 'lazy',
            hasWidthAttr: true,
            hasHeightAttr: true,
            aboveFold: true,
            async: null,
            defer: null,
            blockingHint: null,
            crossOrigin: null,
            media: null,
          },
        }),
      ],
    };
    const report = analyzeAssets(collection);
    const hero = report.assets[0];
    expect(hero?.warnings.some((item) => item.id === 'missing-lazy')).toBe(false);
    expect(hero?.warnings.some((item) => item.id === 'lazy-above-fold')).toBe(true);
    expect(hero?.warnings.every((item) => !/unused/i.test(item.message))).toBe(true);
  });
});
