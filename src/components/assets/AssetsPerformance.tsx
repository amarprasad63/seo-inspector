import { Fragment, useMemo, useState } from 'react';
import { analyzeAssets } from '../../assets/analyzer';
import { assetsExportFilename, buildAssetsCsv, downloadCsv } from '../../assets/exporter';
import { formatBytes, formatDuration } from '../../assets/metrics';
import {
  ASSET_TYPE_LABEL,
  ASSET_TYPE_ORDER,
  type AnalyzedAsset,
  type AssetCollection,
  type AssetSeverity,
  type AssetType,
} from '../../assets/types';
import { CopyButton } from '../CopyButton';
import { SearchInput } from '../SearchInput';

const PAGE_SIZE = 40;

type SortKey = 'size' | 'duration' | 'name';
type SeverityFilter = AssetSeverity | 'all' | 'flagged';

export function AssetsPerformance({ collection }: { collection: AssetCollection }) {
  const report = useMemo(() => analyzeAssets(collection), [collection]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('size');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = report.assets.filter((asset) => {
      if (typeFilter !== 'all' && asset.type !== typeFilter) return false;
      if (severityFilter === 'flagged' && asset.severity !== 'critical' && asset.severity !== 'warning') return false;
      if (severityFilter !== 'all' && severityFilter !== 'flagged' && asset.severity !== severityFilter) return false;
      if (!needle) return true;
      return (
        asset.url.toLowerCase().includes(needle) ||
        asset.filename.toLowerCase().includes(needle) ||
        asset.domain.toLowerCase().includes(needle)
      );
    });
    rows.sort((left, right) => compareAssets(left, right, sortKey, sortDir));
    return rows;
  }, [report.assets, query, typeFilter, severityFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const summary = report.summary;

  return (
    <section className="assets-panel">
      <p className="disclaimer">
        Resource sizes and timings come from the browser Performance API. Thresholds are initial heuristics, not universal
        performance standards. Cross-origin sizes are often unavailable. DOM discovery alone does not mean a file was
        downloaded.
      </p>

      <div className="metrics metrics-wrap">
        <Metric label="Assets" value={String(summary.total)} />
        <Metric
          label="Transferred"
          value={summary.transferKnownCount > 0 ? formatBytes(summary.totalTransferBytes) : 'Unavailable'}
        />
        <Metric
          label="Encoded body"
          value={summary.encodedKnownCount > 0 ? formatBytes(summary.totalEncodedBytes) : 'Unavailable'}
        />
        <Metric
          label="Decoded body"
          value={summary.decodedKnownCount > 0 ? formatBytes(summary.totalDecodedBytes) : 'Unavailable'}
        />
        <Metric label="Flagged" value={String(summary.flagged)} tone={summary.flagged > 0 ? 'warning' : undefined} />
        <Metric label="Third-party" value={String(summary.thirdParty)} />
        <Metric label="Unknown size" value={String(summary.unknownSize)} />
        <Metric label="Critical" value={String(summary.critical)} tone={summary.critical > 0 ? 'error' : undefined} />
      </div>

      {summary.transferKnownCount < summary.total || summary.encodedKnownCount < summary.total ? (
        <p className="score-note">
          Size totals include only resources with exposed byte data ({summary.transferKnownCount}/{summary.total} transfer,{' '}
          {summary.encodedKnownCount}/{summary.total} encoded). Unavailable is not the same as 0 B.
        </p>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Count</th>
              <th>Transfer</th>
              <th>Encoded</th>
              <th>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {report.summary.categories
              .filter((category) => category.count > 0)
              .map((category) => (
                <tr key={category.type}>
                  <td>{ASSET_TYPE_LABEL[category.type]}</td>
                  <td>{category.count}</td>
                  <td>
                    {category.transferKnownCount > 0 ? formatBytes(category.transferBytes) : 'Unavailable'}
                    {category.transferKnownCount > 0 && category.transferKnownCount < category.count
                      ? ` (${category.transferKnownCount}/${category.count})`
                      : ''}
                  </td>
                  <td>
                    {category.encodedKnownCount > 0 ? formatBytes(category.encodedBytes) : 'Unavailable'}
                    {category.encodedKnownCount > 0 && category.encodedKnownCount < category.count
                      ? ` (${category.encodedKnownCount}/${category.count})`
                      : ''}
                  </td>
                  <td>{category.flagged}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {report.recommendations.length > 0 ? (
        <details open>
          <summary>Performance notes ({report.recommendations.length})</summary>
          <ul className="plain-list">
            {report.recommendations.map((item) => (
              <li key={item.id}>
                <span className={`pill pill-${item.severity === 'info' ? 'info' : item.severity}`}>{item.severity}</span>{' '}
                {item.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="assets-toolbar">
        <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(0); }} placeholder="Search asset URL or filename" />
        <label>
          Type
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as AssetType | 'all');
              setPage(0);
            }}
          >
            <option value="all">All types</option>
            {ASSET_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {ASSET_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            value={severityFilter}
            onChange={(event) => {
              setSeverityFilter(event.target.value as SeverityFilter);
              setPage(0);
            }}
          >
            <option value="all">All</option>
            <option value="flagged">Warning + Critical</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="unknown">Unknown size</option>
            <option value="ok">No issue</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={`${sortKey}:${sortDir}`}
            onChange={(event) => {
              const [nextKey, nextDir] = event.target.value.split(':') as [SortKey, 'asc' | 'desc'];
              setSortKey(nextKey);
              setSortDir(nextDir);
            }}
          >
            <option value="size:desc">Size (largest)</option>
            <option value="size:asc">Size (smallest)</option>
            <option value="duration:desc">Duration (slowest)</option>
            <option value="duration:asc">Duration (fastest)</option>
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
          </select>
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={() => downloadCsv(assetsExportFilename(report.pageUrl, report.collectedAt), buildAssetsCsv(report))}
        >
          Export CSV
        </button>
      </div>

      {report.omitted > 0 ? <p className="score-note">{report.omitted} additional resources were not inventoried.</p> : null}

      <div className="table-wrap">
        <table className="data-table assets-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Size</th>
              <th>Duration</th>
              <th>Domain</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((asset) => {
              const open = expandedId === asset.id;
              return (
                <Fragment key={asset.id}>
                  <tr className={severityClass(asset.severity)}>
                    <td>
                      <button
                        type="button"
                        className="text-button asset-name"
                        title={asset.url}
                        onClick={() => setExpandedId(open ? null : asset.id)}
                      >
                        {asset.filename}
                      </button>
                    </td>
                    <td>{ASSET_TYPE_LABEL[asset.type]}</td>
                    <td>
                      {asset.effectiveSize == null ? 'Unavailable' : formatBytes(asset.effectiveSize)}
                      {asset.sizeMetricUsed !== 'none' ? (
                        <span className="rule-id"> ({asset.sizeMetricUsed})</span>
                      ) : null}
                    </td>
                    <td>{formatDuration(asset.duration)}</td>
                    <td className="truncate" title={asset.domain}>
                      {asset.domain}
                    </td>
                    <td>
                      <span className={`pill pill-${severityPill(asset.severity)}`}>{asset.severity}</span>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="asset-detail-row">
                      <td colSpan={6}>
                        <AssetDetail asset={asset} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? <p className="empty-copy">No assets matched these filters.</p> : null}

      {filtered.length > PAGE_SIZE ? (
        <div className="assets-pagination">
          <button type="button" className="ghost-button" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>
            Previous
          </button>
          <span>
            Page {safePage + 1} / {pageCount} ({filtered.length} shown)
          </span>
          <button
            type="button"
            className="ghost-button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <details>
        <summary>API limitations and notes</summary>
        <ul className="plain-list">
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          <li>
            Defaults: images {formatBytes(report.thresholds.image.warning)} / {formatBytes(report.thresholds.image.critical)},
            JS {formatBytes(report.thresholds.javascript.warning)} / {formatBytes(report.thresholds.javascript.critical)}, CSS{' '}
            {formatBytes(report.thresholds.css.warning)} / {formatBytes(report.thresholds.css.critical)}, fonts{' '}
            {formatBytes(report.thresholds.font.warning)} / {formatBytes(report.thresholds.font.critical)}, videos{' '}
            {formatBytes(report.thresholds.video.warning)} / {formatBytes(report.thresholds.video.critical)}.
          </li>
        </ul>
      </details>
    </section>
  );
}

function AssetDetail({ asset }: { asset: AnalyzedAsset }) {
  return (
    <div className="asset-detail">
      <p className="page-url truncate" title={asset.url}>
        {asset.url}
      </p>
      <div className="tree-toolbar">
        <CopyButton text={asset.url} label="Copy URL" />
        <a className="ghost-button" href={asset.url} target="_blank" rel="noreferrer noopener">
          Open in new tab
        </a>
      </div>
      <dl className="finding-meta">
        <div>
          <dt>Transfer</dt>
          <dd>{asset.transferSize == null ? 'Unavailable' : formatBytes(asset.transferSize)}</dd>
        </div>
        <div>
          <dt>Encoded</dt>
          <dd>{asset.encodedBodySize == null ? 'Unavailable' : formatBytes(asset.encodedBodySize)}</dd>
        </div>
        <div>
          <dt>Decoded</dt>
          <dd>{asset.decodedBodySize == null ? 'Unavailable' : formatBytes(asset.decodedBodySize)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(asset.duration)}</dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{asset.startTime == null ? 'Unavailable' : `${asset.startTime} ms`}</dd>
        </div>
        <div>
          <dt>HTTP status</dt>
          <dd>{asset.responseStatus == null ? 'Unavailable' : String(asset.responseStatus)}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{asset.format ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Initiator</dt>
          <dd>{asset.initiatorType ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Requested</dt>
          <dd>{asset.requested ? 'Yes (Performance API)' : 'No timing entry'}</dd>
        </div>
        <div>
          <dt>In DOM</dt>
          <dd>{asset.discoveredInDom ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Origin</dt>
          <dd>{asset.sameOrigin ? 'Same origin' : 'Third-party'}</dd>
        </div>
        {asset.hints?.naturalWidth != null || asset.hints?.renderedWidth != null ? (
          <div>
            <dt>Image size</dt>
            <dd>
              natural {asset.hints.naturalWidth ?? '?'}×{asset.hints.naturalHeight ?? '?'}; rendered{' '}
              {asset.hints.renderedWidth ?? '?'}×{asset.hints.renderedHeight ?? '?'}; loading{' '}
              {asset.hints.loading ?? 'auto'}; attrs{' '}
              {asset.hints.hasWidthAttr && asset.hints.hasHeightAttr ? 'width+height' : 'incomplete'}
            </dd>
          </div>
        ) : null}
      </dl>
      {asset.warnings.length > 0 ? (
        <ul className="plain-list">
          {asset.warnings.map((warning) => (
            <li key={warning.id}>
              <span className={`pill pill-${severityPill(warning.severity)}`}>{warning.severity}</span> {warning.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="score-note">No asset-specific warnings.</p>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'error' | 'warning' }) {
  return (
    <div className={tone ? `metric metric-${tone}` : 'metric'}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function compareAssets(left: AnalyzedAsset, right: AnalyzedAsset, key: SortKey, dir: 'asc' | 'desc'): number {
  const factor = dir === 'asc' ? 1 : -1;
  if (key === 'name') return left.filename.localeCompare(right.filename) * factor;
  if (key === 'duration') {
    const leftValue = left.duration ?? -1;
    const rightValue = right.duration ?? -1;
    return (leftValue - rightValue) * factor;
  }
  const leftValue = left.effectiveSize ?? -1;
  const rightValue = right.effectiveSize ?? -1;
  return (leftValue - rightValue) * factor;
}

function severityClass(severity: AssetSeverity): string {
  if (severity === 'critical') return 'asset-row-critical';
  if (severity === 'warning') return 'asset-row-warning';
  return '';
}

function severityPill(severity: 'critical' | 'warning' | 'info' | 'ok' | 'unknown'): string {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  if (severity === 'ok') return 'info';
  return 'info';
}
