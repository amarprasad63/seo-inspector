import { DEFAULT_ASSET_THRESHOLDS } from './thresholds';
import type {
  AnalyzedAsset,
  AssetCategorySummary,
  AssetCollection,
  AssetReport,
  AssetSeverity,
  AssetSummary,
  AssetThresholds,
  AssetType,
  AssetWarning,
  RawAssetEntry,
} from './types';
import { ASSET_TYPE_ORDER } from './types';
import { formatBytes } from './metrics';

const INEFFICIENT_IMAGE_FORMATS = new Set(['JPG', 'JPEG', 'PNG', 'BMP', 'TIFF', 'TIF']);

export function analyzeAssets(
  collection: AssetCollection,
  thresholds: AssetThresholds = DEFAULT_ASSET_THRESHOLDS,
): AssetReport {
  const assets = collection.entries.map((entry) => analyzeEntry(entry, thresholds));
  const recommendations = buildPageRecommendations(assets, thresholds);
  return {
    pageUrl: collection.pageUrl,
    pageOrigin: collection.pageOrigin,
    collectedAt: collection.collectedAt,
    assets,
    summary: summarize(assets),
    recommendations,
    notes: collection.notes,
    thresholds,
    omitted: collection.omitted,
  };
}

function analyzeEntry(entry: RawAssetEntry, thresholds: AssetThresholds): AnalyzedAsset {
  const warnings: AssetWarning[] = [];
  const thirdParty = !entry.sameOrigin && Boolean(entry.domain) && entry.domain !== '(invalid)';

  if (!entry.requested && entry.discoveredInDom) {
    warnings.push({
      id: 'dom-only',
      severity: 'info',
      message: 'Found in the DOM, but no matching Performance Resource Timing entry was observed. It may still be loading, blocked, unused, or outside the timing buffer.',
    });
  }

  if (entry.sizeUnavailable && entry.requested) {
    warnings.push({
      id: 'size-unavailable',
      severity: 'info',
      message: 'Size is unavailable. Cross-origin responses often omit byte sizes unless Timing-Allow-Origin is set.',
    });
  }

  pushSizeWarnings(entry, thresholds, warnings);
  pushDurationWarnings(entry, thresholds, warnings);

  if (entry.type === 'image') pushImageWarnings(entry, thresholds, warnings, thirdParty);
  if (entry.type === 'javascript') pushScriptWarnings(entry, warnings, thirdParty);
  if (entry.type === 'css') pushCssWarnings(entry, warnings);
  if (entry.type === 'font') pushFontWarnings(warnings, thirdParty);

  if (thirdParty && entry.effectiveSize != null && entry.effectiveSize >= thresholds.javascript.warning) {
    warnings.push({
      id: 'large-third-party',
      severity: entry.effectiveSize >= thresholds.javascript.critical ? 'critical' : 'warning',
      message: `Large third-party resource (${formatBytes(entry.effectiveSize)} via ${entry.sizeMetricUsed === 'transfer' ? 'transfer size' : 'encoded body size'}).`,
    });
  }

  return {
    ...entry,
    thirdParty,
    warnings,
    severity: severityFrom(warnings, entry.sizeUnavailable && entry.requested),
  };
}

function pushSizeWarnings(entry: RawAssetEntry, thresholds: AssetThresholds, warnings: AssetWarning[]): void {
  const size = entry.effectiveSize;
  if (size == null) return;
  const pair =
    entry.type === 'image'
      ? thresholds.image
      : entry.type === 'javascript'
        ? thresholds.javascript
        : entry.type === 'css'
          ? thresholds.css
          : entry.type === 'font'
            ? thresholds.font
            : entry.type === 'video'
              ? thresholds.video
              : null;
  if (!pair) return;
  const metric = entry.sizeMetricUsed === 'transfer' ? 'transfer size' : 'encoded body size';
  if (size > pair.critical) {
    warnings.push({
      id: 'size-critical',
      severity: 'critical',
      message: `Critical size: ${formatBytes(size)} (${metric}). Threshold ${formatBytes(pair.critical)}.`,
    });
  } else if (size > pair.warning) {
    warnings.push({
      id: 'size-warning',
      severity: 'warning',
      message: `Large size: ${formatBytes(size)} (${metric}). Threshold ${formatBytes(pair.warning)}.`,
    });
  }
}

function pushDurationWarnings(entry: RawAssetEntry, thresholds: AssetThresholds, warnings: AssetWarning[]): void {
  if (entry.duration == null) return;
  if (entry.duration > thresholds.slowDurationMs.critical) {
    warnings.push({
      id: 'slow-critical',
      severity: 'critical',
      message: `Very slow load: ${Math.round(entry.duration)} ms.`,
    });
  } else if (entry.duration > thresholds.slowDurationMs.warning) {
    warnings.push({
      id: 'slow-warning',
      severity: 'warning',
      message: `Slow load: ${Math.round(entry.duration)} ms.`,
    });
  }
}

function pushImageWarnings(
  entry: RawAssetEntry,
  thresholds: AssetThresholds,
  warnings: AssetWarning[],
  thirdParty: boolean,
): void {
  const hints = entry.hints;
  if (!hints) return;

  if (
    hints.naturalWidth != null &&
    hints.naturalHeight != null &&
    hints.renderedWidth != null &&
    hints.renderedHeight != null &&
    hints.renderedWidth > 0 &&
    hints.renderedHeight > 0
  ) {
    const widthRatio = hints.naturalWidth / hints.renderedWidth;
    const heightRatio = hints.naturalHeight / hints.renderedHeight;
    if (widthRatio >= thresholds.oversizedDimensionRatio || heightRatio >= thresholds.oversizedDimensionRatio) {
      warnings.push({
        id: 'oversized-dimensions',
        severity: 'warning',
        message: `Intrinsic size ${hints.naturalWidth}×${hints.naturalHeight} is much larger than rendered ${hints.renderedWidth}×${hints.renderedHeight}.`,
      });
    }
  }

  if (!hints.hasWidthAttr || !hints.hasHeightAttr) {
    warnings.push({
      id: 'missing-dimensions',
      severity: 'info',
      message: 'Missing explicit width or height attributes. Reserved space can reduce layout shift.',
    });
  }

  if (hints.aboveFold === false && (!hints.loading || hints.loading === 'auto')) {
    warnings.push({
      id: 'missing-lazy',
      severity: 'info',
      message: 'Below-the-fold image without loading="lazy". Consider lazy loading where appropriate.',
    });
  }

  if (hints.aboveFold === true && hints.loading === 'lazy') {
    warnings.push({
      id: 'lazy-above-fold',
      severity: 'info',
      message: 'Above-the-fold image uses loading="lazy". Lazy loading is usually better for below-the-fold images.',
    });
  }

  if (entry.format && INEFFICIENT_IMAGE_FORMATS.has(entry.format)) {
    warnings.push({
      id: 'format-suggestion',
      severity: 'info',
      message: `${entry.format} may compress less efficiently than modern formats such as WebP or AVIF. Treat this as a suggestion, not a definitive finding.`,
    });
  }

  if (thirdParty) {
    warnings.push({
      id: 'third-party-image',
      severity: 'info',
      message: 'Image is served from a third-party domain.',
    });
  }
}

function pushScriptWarnings(entry: RawAssetEntry, warnings: AssetWarning[], thirdParty: boolean): void {
  if (entry.hints?.blockingHint) {
    warnings.push({
      id: 'render-blocking-script',
      severity: 'warning',
      message: 'Potentially render-blocking script (in head without async, defer, or type=module).',
    });
  }
  if (thirdParty) {
    warnings.push({
      id: 'third-party-script',
      severity: 'info',
      message: 'Third-party JavaScript resource.',
    });
  }
}

function pushCssWarnings(entry: RawAssetEntry, warnings: AssetWarning[]): void {
  if (!entry.hints?.blockingHint) return;
  warnings.push({
    id: 'render-blocking-css',
    severity: 'warning',
    message: 'Potentially render-blocking stylesheet (enabled, not print-only).',
  });
}

function pushFontWarnings(warnings: AssetWarning[], thirdParty: boolean): void {
  if (!thirdParty) return;
  warnings.push({
    id: 'third-party-font',
    severity: 'info',
    message: 'Font loaded from a third-party domain.',
  });
}

function buildPageRecommendations(assets: AnalyzedAsset[], thresholds: AssetThresholds): AssetWarning[] {
  const recommendations: AssetWarning[] = [];
  if (assets.length >= thresholds.excessiveCount.critical) {
    recommendations.push({
      id: 'excessive-count-critical',
      severity: 'critical',
      message: `Very high resource count (${assets.length}). Consider reducing requests, combining bundles, or delaying non-critical assets.`,
    });
  } else if (assets.length >= thresholds.excessiveCount.warning) {
    recommendations.push({
      id: 'excessive-count-warning',
      severity: 'warning',
      message: `High resource count (${assets.length}). Many requests can slow first render on constrained networks.`,
    });
  }

  const fonts = assets.filter((asset) => asset.type === 'font' && asset.requested);
  const fontFormats = new Map<string, number>();
  for (const font of fonts) {
    const key = `${font.filename.replace(/\.[^.]+$/, '')}:${font.domain}`;
    fontFormats.set(key, (fontFormats.get(key) ?? 0) + 1);
  }
  for (const [key, count] of fontFormats) {
    if (count >= 2) {
      recommendations.push({
        id: `redundant-fonts:${key}`,
        severity: 'info',
        message: `Multiple font files appear related (${key}, ${count} variants). Confirm that older formats are still required.`,
      });
    }
  }

  const unknown = assets.filter((asset) => asset.requested && asset.sizeUnavailable).length;
  if (unknown > 0) {
    recommendations.push({
      id: 'cross-origin-sizes',
      severity: 'info',
      message: `${unknown} requested resource(s) have unavailable sizes. Cross-origin Timing-Allow-Origin limits what the browser exposes.`,
    });
  }

  return recommendations;
}

function severityFrom(warnings: AssetWarning[], sizeUnknown: boolean): AssetSeverity {
  if (warnings.some((item) => item.severity === 'critical')) return 'critical';
  if (warnings.some((item) => item.severity === 'warning')) return 'warning';
  if (sizeUnknown) return 'unknown';
  return 'ok';
}

function summarize(assets: AnalyzedAsset[]): AssetSummary {
  const categories = ASSET_TYPE_ORDER.map((type) => categorySummary(assets, type));
  let totalTransferBytes = 0;
  let transferKnownCount = 0;
  let totalEncodedBytes = 0;
  let encodedKnownCount = 0;
  let totalDecodedBytes = 0;
  let decodedKnownCount = 0;
  let flagged = 0;
  let critical = 0;
  let warning = 0;
  let unknownSize = 0;
  let thirdParty = 0;

  for (const asset of assets) {
    if (asset.transferSize != null) {
      totalTransferBytes += asset.transferSize;
      transferKnownCount += 1;
    }
    if (asset.encodedBodySize != null) {
      totalEncodedBytes += asset.encodedBodySize;
      encodedKnownCount += 1;
    }
    if (asset.decodedBodySize != null) {
      totalDecodedBytes += asset.decodedBodySize;
      decodedKnownCount += 1;
    }
    if (asset.severity === 'critical' || asset.severity === 'warning') flagged += 1;
    if (asset.severity === 'critical') critical += 1;
    if (asset.severity === 'warning') warning += 1;
    if (asset.severity === 'unknown' || asset.sizeUnavailable) unknownSize += 1;
    if (asset.thirdParty) thirdParty += 1;
  }

  return {
    total: assets.length,
    totalTransferBytes,
    transferKnownCount,
    totalEncodedBytes,
    encodedKnownCount,
    totalDecodedBytes,
    decodedKnownCount,
    flagged,
    critical,
    warning,
    unknownSize,
    thirdParty,
    categories,
  };
}

function categorySummary(assets: AnalyzedAsset[], type: AssetType): AssetCategorySummary {
  const subset = assets.filter((asset) => asset.type === type);
  let transferBytes = 0;
  let transferKnownCount = 0;
  let encodedBytes = 0;
  let encodedKnownCount = 0;
  let flagged = 0;
  for (const asset of subset) {
    if (asset.transferSize != null) {
      transferBytes += asset.transferSize;
      transferKnownCount += 1;
    }
    if (asset.encodedBodySize != null) {
      encodedBytes += asset.encodedBodySize;
      encodedKnownCount += 1;
    }
    if (asset.severity === 'critical' || asset.severity === 'warning') flagged += 1;
  }
  return { type, count: subset.length, transferBytes, transferKnownCount, encodedBytes, encodedKnownCount, flagged };
}
