export type AssetType = 'image' | 'javascript' | 'css' | 'font' | 'video' | 'xhr' | 'other';

export type AssetSeverity = 'critical' | 'warning' | 'ok' | 'unknown';

export type SizeMetricUsed = 'transfer' | 'encoded' | 'none';

export interface AssetThresholds {
  image: { warning: number; critical: number };
  javascript: { warning: number; critical: number };
  css: { warning: number; critical: number };
  font: { warning: number; critical: number };
  video: { warning: number; critical: number };
  slowDurationMs: { warning: number; critical: number };
  excessiveCount: { warning: number; critical: number };
  oversizedDimensionRatio: number;
}

export interface DomAssetHints {
  naturalWidth: number | null;
  naturalHeight: number | null;
  renderedWidth: number | null;
  renderedHeight: number | null;
  loading: string | null;
  hasWidthAttr: boolean;
  hasHeightAttr: boolean;
  aboveFold: boolean | null;
  async: boolean | null;
  defer: boolean | null;
  blockingHint: boolean | null;
  crossOrigin: string | null;
  media: string | null;
}

export interface RawAssetEntry {
  id: string;
  url: string;
  type: AssetType;
  initiatorType: string | null;
  transferSize: number | null;
  encodedBodySize: number | null;
  decodedBodySize: number | null;
  duration: number | null;
  startTime: number | null;
  responseStatus: number | null;
  domain: string;
  format: string | null;
  sameOrigin: boolean;
  discoveredInDom: boolean;
  requested: boolean;
  sizeMetricUsed: SizeMetricUsed;
  effectiveSize: number | null;
  sizeUnavailable: boolean;
  filename: string;
  hints: DomAssetHints | null;
}

export interface AssetCollection {
  pageUrl: string;
  pageOrigin: string;
  collectedAt: string;
  entries: RawAssetEntry[];
  omitted: number;
  notes: string[];
}

export interface AssetWarning {
  id: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface AnalyzedAsset extends RawAssetEntry {
  severity: AssetSeverity;
  warnings: AssetWarning[];
  thirdParty: boolean;
}

export interface AssetCategorySummary {
  type: AssetType;
  count: number;
  transferBytes: number;
  transferKnownCount: number;
  encodedBytes: number;
  encodedKnownCount: number;
  flagged: number;
}

export interface AssetSummary {
  total: number;
  totalTransferBytes: number;
  transferKnownCount: number;
  totalEncodedBytes: number;
  encodedKnownCount: number;
  totalDecodedBytes: number;
  decodedKnownCount: number;
  flagged: number;
  critical: number;
  warning: number;
  unknownSize: number;
  thirdParty: number;
  categories: AssetCategorySummary[];
}

export interface AssetReport {
  pageUrl: string;
  pageOrigin: string;
  collectedAt: string;
  assets: AnalyzedAsset[];
  summary: AssetSummary;
  recommendations: AssetWarning[];
  notes: string[];
  thresholds: AssetThresholds;
  omitted: number;
}

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  image: 'Images',
  javascript: 'JavaScript',
  css: 'CSS',
  font: 'Fonts',
  video: 'Videos',
  xhr: 'XHR / Fetch',
  other: 'Other',
};

export const ASSET_TYPE_ORDER: readonly AssetType[] = [
  'image',
  'javascript',
  'css',
  'font',
  'video',
  'xhr',
  'other',
];
