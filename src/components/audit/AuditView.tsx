import { useMemo, useState } from 'react';
import { CopyButton } from '../CopyButton';
import { RawJsonViewer } from '../RawJsonViewer';
import { SchemaExplorer } from '../SchemaExplorer';
import { SearchInput } from '../SearchInput';
import { ValidationPanel } from '../ValidationPanel';
import { formatOutline } from '../../seo/headings';
import { metaValues } from '../../seo/metadata';
import {
  SECTION_LABEL,
  SECTION_ORDER,
  type AuditSection,
  type AuditSeverity,
  type KeywordTargets,
  type SeoAudit,
} from '../../seo/types';
import type { PageExtraction } from '../../shared/types';
import type { Analysis } from '../../validation/engine';
import type { FindingCategory, Severity } from '../../validation/types';
import { FindingList, filterSeverity } from './FindingList';

const JSONLD_SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];
const JSONLD_CATEGORIES: readonly FindingCategory[] = ['syntax', 'structure', 'schema-org', 'google-rich-results', 'recommendation'];

export function AuditView({
  mode,
  extraction,
  analysis,
  audit,
  targets,
  disabled,
  onTargets,
  onToggleRule,
  onHighlight,
}: {
  mode: 'popup' | 'sidepanel';
  extraction: PageExtraction;
  analysis: Analysis;
  audit: SeoAudit;
  targets: KeywordTargets;
  disabled: ReadonlySet<string>;
  onTargets: (targets: KeywordTargets) => void;
  onToggleRule: (ruleId: string) => void;
  onHighlight: (highlightId: string) => void;
}) {
  const [section, setSection] = useState<AuditSection>('overview');
  const [severity, setSeverity] = useState<AuditSeverity | 'all'>('all');
  const [schemaQuery, setSchemaQuery] = useState('');
  const [schemaTab, setSchemaTab] = useState<'schemas' | 'validation' | 'raw'>('schemas');
  const [showPreviewImage, setShowPreviewImage] = useState(false);
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);
  const snapshot = extraction.snapshot;

  const sectionFindings = useMemo(() => {
    const category = sectionCategory(section);
    let pool = audit.findings;
    if (section === 'recommendations') {
      pool =
        severity === 'all'
          ? audit.findings.filter((item) => item.severity === 'error' || item.kind === 'best-practice' || item.kind === 'optional')
          : audit.findings;
    } else if (section === 'technical') {
      pool = audit.findings.filter((item) => item.category === 'technical' || item.category === 'accessibility');
    } else if (category) {
      pool = audit.findings.filter((item) => item.category === category);
    }
    return filterSeverity(pool, severity);
  }, [audit.findings, section, severity]);

  function openSection(next: AuditSection, nextSeverity: AuditSeverity | 'all' = 'all') {
    setSection(next);
    setSeverity(nextSeverity);
  }

  return (
    <>
      <div className="section-nav">
        {mode === 'popup' ? (
          <label className="section-select">
            Section
            <select value={section} onChange={(event) => openSection(event.target.value as AuditSection)}>
              {SECTION_ORDER.map((item) => (
                <option key={item} value={item}>
                  {SECTION_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="filters" role="tablist" aria-label="Audit sections">
            {SECTION_ORDER.map((item) => (
              <button key={item} type="button" className={section === item ? 'chip chip-on' : 'chip'} onClick={() => openSection(item)}>
                {SECTION_LABEL[item]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="panel">
        {section === 'overview' ? (
          <Overview
            audit={audit}
            disabled={disabled}
            onOpen={openSection}
            onToggleRule={onToggleRule}
            onHighlight={onHighlight}
          />
        ) : null}
        {section === 'metadata' && snapshot ? <MetadataFacts snapshotTitle={snapshot.title} description={metaValues(snapshot, 'name', 'description')} robots={metaValues(snapshot, 'name', 'robots')} lang={snapshot.htmlLang} charset={snapshot.charset} viewport={metaValues(snapshot, 'name', 'viewport')} /> : null}
        {section === 'keywords' ? (
          <Keywords targets={targets} audit={audit} expanded={expandedKeyword} onExpand={setExpandedKeyword} onTargets={onTargets} />
        ) : null}
        {section === 'headings' ? (
          <section>
            <div className="tree-toolbar">
              <CopyButton text={formatOutline(audit.headingOutline)} label="Copy outline" />
            </div>
            <Outline nodes={audit.headingOutline} onHighlight={onHighlight} />
          </section>
        ) : null}
        {section === 'social' ? (
          <SocialPreviewCard audit={audit} showImage={showPreviewImage} onShowImage={() => setShowPreviewImage(true)} />
        ) : null}
        {section === 'links' && snapshot ? <LinkTable anchors={snapshot.anchors} omitted={snapshot.caps.anchorsOmitted} onHighlight={onHighlight} /> : null}
        {section === 'images' && snapshot ? <ImageTable images={snapshot.images} omitted={snapshot.caps.imagesOmitted} onHighlight={onHighlight} /> : null}
        {section === 'content' ? (
          <section>
            <p>{audit.keywords.textSource}</p>
            <p>{audit.keywords.analyzedWords} analyzed words. Content notes are heuristic.</p>
            <details>
              <summary>Text included in the analysis</summary>
              <pre className="raw-pre">{audit.keywords.includedText || 'No text collected.'}</pre>
            </details>
          </section>
        ) : null}
        {section === 'structured' ? (
          <Structured analysis={analysis} mode={mode} query={schemaQuery} tab={schemaTab} onQuery={setSchemaQuery} onTab={setSchemaTab} />
        ) : null}
        {section !== 'overview' && section !== 'structured' ? (
          <>
            <SeverityChips value={severity} onChange={setSeverity} />
            <FindingList findings={sectionFindings} onHighlight={onHighlight} />
            <Unavailable notes={audit.unavailable.filter((item) => section === 'recommendations' || item.category === sectionCategory(section) || (section === 'technical' && item.category === 'accessibility'))} />
          </>
        ) : null}
        {!snapshot && section !== 'structured' && section !== 'overview' ? (
          <p className="empty-copy">This payload has no on-page snapshot, so the check was not marked as passed.</p>
        ) : null}
      </div>
    </>
  );
}

function Overview({
  audit,
  disabled,
  onOpen,
  onToggleRule,
  onHighlight,
}: {
  audit: SeoAudit;
  disabled: ReadonlySet<string>;
  onOpen: (section: AuditSection, severity?: AuditSeverity | 'all') => void;
  onToggleRule: (ruleId: string) => void;
  onHighlight: (highlightId: string) => void;
}) {
  const top = audit.findings.filter((item) => item.severity === 'error' || item.severity === 'warning').slice(0, 5);
  return (
    <section>
      <p className="disclaimer">{audit.score.label} {audit.summary.score == null ? 'Score unavailable because the page snapshot was not collected.' : null}</p>
      <div className="metrics metrics-wrap">
        <Metric label="Score" value={audit.summary.score == null ? '—' : String(audit.summary.score)} onClick={() => onOpen('overview')} />
        <Metric label="Critical" value={String(audit.summary.errors)} tone="error" onClick={() => onOpen('recommendations', 'error')} />
        <Metric label="Warnings" value={String(audit.summary.warnings)} tone="warning" onClick={() => onOpen('recommendations', 'warning')} />
        <Metric label="Passed" value={String(audit.summary.passed)} onClick={() => onOpen('overview')} />
        <Metric label="Info" value={String(audit.summary.info)} onClick={() => onOpen('recommendations', 'info')} />
        <Metric label="Metadata" value={audit.summary.metadataStatus} onClick={() => onOpen('metadata')} />
        <Metric label="Headings" value={audit.summary.headingStatus} onClick={() => onOpen('headings')} />
        <Metric label="Images" value={audit.summary.imageStatus} onClick={() => onOpen('images')} />
        <Metric label="Links" value={`${audit.summary.internalLinks} in / ${audit.summary.externalLinks} out`} onClick={() => onOpen('links')} />
        <Metric label="Entities" value={String(audit.summary.entities)} onClick={() => onOpen('structured')} />
        <Metric label="Indexability" value={audit.summary.indexability} onClick={() => onOpen('indexability')} />
      </div>
      <FindingList findings={top} onHighlight={onHighlight} />
      <details>
        <summary>How the score was calculated</summary>
        <p>{audit.score.methodology}</p>
        <ul className="plain-list">
          {audit.score.deductions.map((item) => (
            <li key={item.ruleId}>
              <label>
                <input type="checkbox" checked={!disabled.has(item.ruleId)} onChange={() => onToggleRule(item.ruleId)} /> {item.ruleId} −{item.points} ({item.instances} instance{item.instances === 1 ? '' : 's'})
              </label>
            </li>
          ))}
          {[...disabled].map((ruleId) => (
            <li key={ruleId}>
              <label>
                <input type="checkbox" checked={false} onChange={() => onToggleRule(ruleId)} /> {ruleId} excluded from the score
              </label>
            </li>
          ))}
        </ul>
        {audit.score.deductions.length === 0 ? <p>No deductions.</p> : null}
        <p>{audit.score.infoIgnored} informational rules do not change the score. {audit.unavailable.length} checks could not be evaluated and were not marked as passed.</p>
      </details>
    </section>
  );
}

function MetadataFacts({
  snapshotTitle,
  description,
  robots,
  lang,
  charset,
  viewport,
}: {
  snapshotTitle: string;
  description: string[];
  robots: string[];
  lang: string;
  charset: string;
  viewport: string[];
}) {
  const rows = [
    ['Title', snapshotTitle, String(snapshotTitle.trim().length)],
    ['Description', description.join(' | '), String((description[0] ?? '').trim().length)],
    ['Robots', robots.join(' | ') || 'Not declared', ''],
    ['Language', lang || 'Not declared', ''],
    ['Encoding', charset || 'Unknown from the document', ''],
    ['Viewport', viewport.join(' | ') || 'Not declared', ''],
  ];
  return (
    <table className="data-table">
      <tbody>
        {rows.map(([label, value, count]) => (
          <tr key={label}>
            <th>{label}</th>
            <td>
              {value || '(empty)'}
              {count ? ` · ${count} characters` : ''}
              <CopyButton text={value} label="Copy" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Keywords({
  targets,
  audit,
  expanded,
  onExpand,
  onTargets,
}: {
  targets: KeywordTargets;
  audit: SeoAudit;
  expanded: string | null;
  onExpand: (value: string | null) => void;
  onTargets: (targets: KeywordTargets) => void;
}) {
  return (
    <section>
      <form
        className="keyword-form"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label>
          Primary keyword
          <input value={targets.primary} onChange={(event) => onTargets({ ...targets, primary: event.target.value })} />
        </label>
        <label>
          Secondary keywords
          <input value={targets.secondary} placeholder="Comma-separated" onChange={(event) => onTargets({ ...targets, secondary: event.target.value })} />
        </label>
        <label>
          Brand
          <input value={targets.brand} onChange={(event) => onTargets({ ...targets, brand: event.target.value })} />
        </label>
        <label className="remember">
          <input type="checkbox" checked={targets.remember} onChange={(event) => onTargets({ ...targets, remember: event.target.checked })} />
          Remember on this device
        </label>
      </form>
      <p>{audit.keywords.textSource} Frequency is occurrences divided by analyzed words. It is not a ranking target.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Count</th>
              <th>Share</th>
              <th>Title</th>
              <th>Description</th>
              <th>H1</th>
              <th>Headings</th>
              <th>Content</th>
              <th>Alt</th>
            </tr>
          </thead>
          <tbody>
            {audit.keywords.rows.map((row) => (
              <tr key={`${row.source}:${row.keyword}`}>
                <td>
                  <button type="button" className="text-button" onClick={() => onExpand(expanded === row.keyword ? null : row.keyword)}>
                    {row.keyword}
                  </button>
                  <span className="rule-id"> {row.source}</span>
                  {expanded === row.keyword ? (
                    <div>
                      {row.snippets.length === 0 ? <p>No content snippet.</p> : row.snippets.map((snippet) => <p key={snippet.text}>{snippet.where}: {snippet.text}</p>)}
                      <p>URL matches: {row.url}. Internal anchor matches: {row.anchors}.</p>
                    </div>
                  ) : null}
                </td>
                <td>{row.occurrences}</td>
                <td>{(row.frequency * 100).toFixed(1)}%</td>
                <td>{row.title}</td>
                <td>{row.description}</td>
                <td>{row.h1}</td>
                <td>{row.headings}</td>
                <td>{row.content}</td>
                <td>{row.alt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Outline({
  nodes,
  onHighlight,
}: {
  nodes: SeoAudit['headingOutline'];
  onHighlight: (highlightId: string) => void;
}) {
  if (nodes.length === 0) return <p className="empty-copy">No headings collected.</p>;
  return (
    <ul className="outline">
      {nodes.map((node) => (
        <li key={node.highlightId}>
          <button type="button" className="text-button" onClick={() => onHighlight(node.highlightId)}>
            H{node.level}: {node.text || '(empty)'}
            {node.hidden ? ' (hidden)' : ''}
          </button>
          <Outline nodes={node.children} onHighlight={onHighlight} />
        </li>
      ))}
    </ul>
  );
}

function SocialPreviewCard({ audit, showImage, onShowImage }: { audit: SeoAudit; showImage: boolean; onShowImage: () => void }) {
  const image = /^https?:\/\//i.test(audit.preview.image) ? audit.preview.image : '';
  return (
    <section>
      <article className="preview-card">
        <p className="rule-id">{audit.preview.source || 'No social metadata'} {audit.preview.card ? `· ${audit.preview.card}` : ''}</p>
        <h2>{audit.preview.title || 'No title'}</h2>
        <p>{audit.preview.description || 'No description'}</p>
        <p className="page-url">{audit.preview.url}</p>
        {image && !showImage ? (
          <button type="button" className="ghost-button" onClick={onShowImage}>
            Show preview image
          </button>
        ) : null}
        {image && showImage ? <img src={image} alt={audit.preview.imageAlt || ''} /> : null}
        {!image && audit.preview.image ? <p>Image URL is not an absolute http(s) URL: {audit.preview.image}</p> : null}
      </article>
      <PropertyList title="Open Graph" values={audit.openGraph} />
      <PropertyList title="Twitter/X" values={audit.twitter} />
    </section>
  );
}

function PropertyList({ title, values }: { title: string; values: Record<string, string[]> }) {
  const entries = Object.entries(values);
  return (
    <section>
      <h3>{title}</h3>
      {entries.length === 0 ? <p>None declared.</p> : null}
      <ul className="plain-list">
        {entries.map(([key, list]) => (
          <li key={key}>
            <strong>{key}: </strong>
            {list.map((value) => value || '(empty)').join(' | ')}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkTable({
  anchors,
  omitted,
  onHighlight,
}: {
  anchors: NonNullable<PageExtraction['snapshot']>['anchors'];
  omitted: number;
  onHighlight: (highlightId: string) => void;
}) {
  const [kind, setKind] = useState('all');
  const rows = anchors.filter((anchor) => kind === 'all' || anchor.className === kind).slice(0, 80);
  return (
    <section>
      <label>
        Link type
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {['all', 'internal', 'external', 'fragment', 'mailto', 'tel', 'other', 'empty', 'malformed'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      {omitted > 0 ? <p>{omitted} anchors were not inventoried.</p> : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Text</th>
              <th>Type</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((anchor) => (
              <tr key={anchor.highlightId}>
                <td>
                  <button type="button" className="text-button" onClick={() => onHighlight(anchor.highlightId)}>
                    {anchor.text || anchor.imageAlt || '(no name)'}
                  </button>
                </td>
                <td>{anchor.className}</td>
                <td>
                  {anchor.href || '(empty)'} <CopyButton text={anchor.href} label="Copy" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImageTable({
  images,
  omitted,
  onHighlight,
}: {
  images: NonNullable<PageExtraction['snapshot']>['images'];
  omitted: number;
  onHighlight: (highlightId: string) => void;
}) {
  const [filter, setFilter] = useState('all');
  const rows = images
    .filter((image) => {
      if (filter === 'missing') return !image.altPresent;
      if (filter === 'empty') return image.altPresent && !image.alt?.trim();
      if (filter === 'failed') return image.failed;
      return true;
    })
    .slice(0, 60);
  return (
    <section>
      <label>
        Images
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All collected</option>
          <option value="missing">Missing alt</option>
          <option value="empty">Empty alt</option>
          <option value="failed">Failed</option>
        </select>
      </label>
      {omitted > 0 ? <p>{omitted} images were not inventoried. Byte size was not measured.</p> : <p>Byte size was not measured.</p>}
      <ul className="plain-list">
        {rows.map((image) => (
          <li key={image.highlightId}>
            <button type="button" className="text-button" onClick={() => onHighlight(image.highlightId)}>
              {image.altPresent ? image.alt || '(decorative empty alt)' : '(no alt attribute)'}
            </button>
            <span className="rule-id"> {image.src || '(no src)'}</span>
            <CopyButton text={image.src} label="Copy URL" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Structured({
  analysis,
  mode,
  query,
  tab,
  onQuery,
  onTab,
}: {
  analysis: Analysis;
  mode: 'popup' | 'sidepanel';
  query: string;
  tab: 'schemas' | 'validation' | 'raw';
  onQuery: (value: string) => void;
  onTab: (tab: 'schemas' | 'validation' | 'raw') => void;
}) {
  const [severities, setSeverities] = useState<ReadonlySet<Severity>>(() => new Set(JSONLD_SEVERITIES));
  const [categories, setCategories] = useState<ReadonlySet<FindingCategory>>(() => new Set(JSONLD_CATEGORIES));
  return (
    <section>
      <p className="disclaimer">Schema.org checks are a local subset. Google rich-result checks are local diagnostics, not eligibility. Last reviewed 2026-10-01.</p>
      <div className="tabs">
        <button type="button" className={tab === 'schemas' ? 'tab active' : 'tab'} onClick={() => onTab('schemas')}>
          Schemas <span className="tab-count">{analysis.entities.length}</span>
        </button>
        <button type="button" className={tab === 'validation' ? 'tab active' : 'tab'} onClick={() => onTab('validation')}>
          Validation <span className="tab-count">{analysis.findings.length}</span>
        </button>
        <button type="button" className={tab === 'raw' ? 'tab active' : 'tab'} onClick={() => onTab('raw')}>
          Raw JSON <span className="tab-count">{analysis.scripts.length}</span>
        </button>
      </div>
      <SearchInput value={query} onChange={onQuery} placeholder="Search structured data" />
      {tab === 'schemas' ? <SchemaExplorer entities={analysis.entities} findings={analysis.findings} query={query} initialExpandDepth={mode === 'sidepanel' ? 2 : 1} /> : null}
      {tab === 'validation' ? (
        <ValidationPanel
          findings={analysis.findings}
          query={query}
          severities={severities}
          categories={categories}
          onToggleSeverity={(severity) => setSeverities((current) => toggle(current, severity))}
          onToggleCategory={(category) => setCategories((current) => toggle(current, category))}
          onShowAll={() => {
            setSeverities(new Set(JSONLD_SEVERITIES));
            setCategories(new Set(JSONLD_CATEGORIES));
          }}
        />
      ) : null}
      {tab === 'raw' ? <RawJsonViewer scripts={analysis.scripts} query={query} /> : null}
    </section>
  );
}

function SeverityChips({ value, onChange }: { value: AuditSeverity | 'all'; onChange: (value: AuditSeverity | 'all') => void }) {
  return (
    <div className="filters">
      {(['all', 'error', 'warning', 'info'] as const).map((item) => (
        <button key={item} type="button" className={value === item ? 'chip chip-on' : 'chip'} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

function Unavailable({ notes }: { notes: SeoAudit['unavailable'] }) {
  if (notes.length === 0) return null;
  return (
    <details>
      <summary>Could not evaluate ({notes.length})</summary>
      <ul className="plain-list">
        {notes.map((note) => (
          <li key={note.ruleId}>
            <strong>{note.name}. </strong>
            {note.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Metric({ label, value, onClick, tone }: { label: string; value: string; onClick: () => void; tone?: 'error' | 'warning' }) {
  return (
    <button type="button" className={tone ? `metric metric-${tone}` : 'metric'} onClick={onClick}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </button>
  );
}

function sectionCategory(section: AuditSection): AuditFindingCategory | null {
  if (section === 'metadata') return 'metadata';
  if (section === 'keywords') return 'keywords';
  if (section === 'headings') return 'headings';
  if (section === 'social') return 'social';
  if (section === 'links') return 'links';
  if (section === 'images') return 'images';
  if (section === 'indexability') return 'indexability';
  if (section === 'technical') return 'technical';
  if (section === 'content') return 'content';
  if (section === 'structured') return 'structured-data';
  return null;
}

type AuditFindingCategory = 'metadata' | 'keywords' | 'headings' | 'social' | 'links' | 'images' | 'indexability' | 'structured-data' | 'technical' | 'content' | 'accessibility' | 'recommendations';

function toggle<T>(current: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
