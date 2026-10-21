import { useMemo, useState } from 'react';
import { LIMITS } from '../shared/limits';
import { findingMatches } from '../utils/filter';
import { GOOGLE_RICH_RESULTS_TEST_URL, GOOGLE_RULES_LAST_VERIFIED } from '../validation/google-rich-results';
import { CATEGORY_LABEL, type Finding, type FindingCategory, type Severity } from '../validation/types';

const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];
const CATEGORIES: readonly FindingCategory[] = [
  'syntax',
  'structure',
  'schema-org',
  'google-rich-results',
  'recommendation',
];

interface ValidationPanelProps {
  findings: readonly Finding[];
  query: string;
  severities: ReadonlySet<Severity>;
  categories: ReadonlySet<FindingCategory>;
  onToggleSeverity: (severity: Severity) => void;
  onToggleCategory: (category: FindingCategory) => void;
  onShowAll: () => void;
}

export function ValidationPanel({
  findings,
  query,
  severities,
  categories,
  onToggleSeverity,
  onToggleCategory,
  onShowAll,
}: ValidationPanelProps) {
  const filtered = useMemo(
    () => findings.filter((finding) => findingMatches(finding, query.trim().toLowerCase(), severities, categories)),
    [findings, query, severities, categories],
  );
  const [visibleCount, setVisibleCount] = useState<number>(LIMITS.listPageSize);
  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="validation">
      <div className="disclaimer">
        <p>
          These are local diagnostics, not an official Google validation result. A page is not Google-eligible just
          because no warnings were found. Google rich-result rules were last verified {GOOGLE_RULES_LAST_VERIFIED}.
        </p>
        <a href={GOOGLE_RICH_RESULTS_TEST_URL} target="_blank" rel="noreferrer">
          Open Google Rich Results Test
        </a>
      </div>
      <div className="filters" aria-label="Finding filters">
        <button type="button" className="chip" onClick={onShowAll}>
          All
        </button>
        {SEVERITIES.map((severity) => (
          <button
            key={severity}
            type="button"
            className={severities.has(severity) ? `chip chip-${severity} chip-on` : `chip chip-${severity}`}
            aria-pressed={severities.has(severity)}
            onClick={() => onToggleSeverity(severity)}
          >
            {severity}
          </button>
        ))}
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={categories.has(category) ? 'chip chip-on' : 'chip'}
            aria-pressed={categories.has(category)}
            onClick={() => onToggleCategory(category)}
          >
            {CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>
      {findings.length === 0 ? <p className="empty-copy">No findings for this page.</p> : null}
      {findings.length > 0 && filtered.length === 0 ? <p className="empty-copy">No findings match these filters.</p> : null}
      <ul className="finding-list">
        {visible.map((finding) => (
          <li key={finding.id} className={`finding finding-${finding.severity}`}>
            <div className="finding-top">
              <span className={`pill pill-${finding.severity}`}>{finding.severity}</span>
              <span className="pill">{CATEGORY_LABEL[finding.category]}</span>
              <code className="rule-id">{finding.ruleId}</code>
            </div>
            <p>{finding.message}</p>
            <dl className="finding-meta">
              <div>
                <dt>Path</dt>
                <dd title={finding.path}>{finding.path}</dd>
              </div>
              <div>
                <dt>Script</dt>
                <dd>{finding.scriptIndex}</dd>
              </div>
              {finding.property ? (
                <div>
                  <dt>Property</dt>
                  <dd>{finding.property}</dd>
                </div>
              ) : null}
              {finding.entityType ? (
                <div>
                  <dt>Type</dt>
                  <dd>{finding.entityType}</dd>
                </div>
              ) : null}
            </dl>
            {finding.docsUrl ? (
              <a href={finding.docsUrl} target="_blank" rel="noreferrer">
                Documentation
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {visibleCount < filtered.length ? (
        <button type="button" className="text-button" onClick={() => setVisibleCount((count) => count + LIMITS.listPageSize)}>
          Show more findings ({filtered.length - visibleCount} remaining)
        </button>
      ) : null}
    </div>
  );
}
