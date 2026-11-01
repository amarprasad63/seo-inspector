import type { AnalyzedAsset, AssetReport } from './types';

export function buildAssetsCsv(report: AssetReport): string {
  const header = [
    'URL',
    'Type',
    'Transfer size',
    'Encoded size',
    'Decoded size',
    'Duration ms',
    'Start time ms',
    'Domain',
    'Severity',
    'Size metric',
    'Requested',
    'Discovered in DOM',
    'Warnings',
  ];
  const rows = report.assets.map((asset) => rowFor(asset));
  return [header, ...rows].map((columns) => columns.map(escapeCsv).join(',')).join('\n');
}

export function assetsExportFilename(pageUrl: string, collectedAt: string): string {
  let host = 'page';
  try {
    const hostname = new URL(pageUrl).hostname.replace(/[^a-z0-9.-]+/gi, '_');
    if (hostname) host = hostname;
  } catch {
    host = 'page';
  }
  const stamp = collectedAt.replace(/[:.]/g, '-');
  return `assets-${host}-${stamp}.csv`;
}

function rowFor(asset: AnalyzedAsset): string[] {
  return [
    asset.url,
    asset.type,
    nullableNumber(asset.transferSize),
    nullableNumber(asset.encodedBodySize),
    nullableNumber(asset.decodedBodySize),
    nullableNumber(asset.duration),
    nullableNumber(asset.startTime),
    asset.domain,
    asset.severity,
    asset.sizeMetricUsed,
    asset.requested ? 'yes' : 'no',
    asset.discoveredInDom ? 'yes' : 'no',
    asset.warnings.map((item) => item.message).join(' | '),
  ];
}

function nullableNumber(value: number | null): string {
  return value == null ? '' : String(value);
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
