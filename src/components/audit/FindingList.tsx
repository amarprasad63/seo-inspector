import { CopyButton } from '../CopyButton';
import type { AuditFinding, AuditSeverity } from '../../seo/types';

export function FindingList({
  findings,
  onHighlight,
}: {
  findings: readonly AuditFinding[];
  onHighlight: (highlightId: string) => void;
}) {
  if (findings.length === 0) return <p className="empty-copy">No findings in this view.</p>;
  return (
    <ul className="finding-list">
      {findings.map((item) => (
        <li key={item.id} className={`finding finding-${item.severity}`}>
          <div className="finding-top">
            <span className={`pill pill-${item.severity}`}>{item.severity}</span>
            <span className="pill">{item.kind}</span>
            <strong>{item.name}</strong>
            <span className="rule-id">{item.ruleId}</span>
          </div>
          <p>{item.message}</p>
          <p>{item.why}</p>
          <p>
            <span className="metric-label">Evidence. </span>
            {item.evidence}
          </p>
          <p>
            <span className="metric-label">What to do. </span>
            {item.remediation}
          </p>
          <div className="tree-toolbar">
            <CopyButton text={item.evidence} label="Copy evidence" />
            {item.highlightId ? (
              <button type="button" className="ghost-button" onClick={() => onHighlight(item.highlightId!)}>
                Highlight
              </button>
            ) : null}
            {item.docsUrl ? (
              <a href={item.docsUrl} target="_blank" rel="noreferrer">
                Reference
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function filterSeverity(findings: readonly AuditFinding[], severity: AuditSeverity | 'all'): AuditFinding[] {
  if (severity === 'all') return [...findings];
  return findings.filter((item) => item.severity === severity);
}
