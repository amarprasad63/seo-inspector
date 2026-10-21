import { CopyButton } from '../CopyButton';
import type { AuditFinding, AuditSeverity, ScoreContribution } from '../../seo/types';

export function FindingList({
  findings,
  onHighlight,
  contributions,
}: {
  findings: readonly AuditFinding[];
  onHighlight: (highlightId: string) => void;
  contributions?: ReadonlyMap<string, ScoreContribution>;
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
          <ScoreNote contribution={contributions?.get(item.ruleId)} />
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

function ScoreNote({ contribution }: { contribution: ScoreContribution | undefined }) {
  if (!contribution) return null;
  const count = `${contribution.instances} on this page`;
  const text = contribution.countedAs
    ? `Same issue as ${contribution.countedAs}, so this rule is not deducted again. ${count}.`
    : contribution.points > 0
      ? `−${contribution.points} on the ${contribution.groupLabel} score. ${count}; this rule deducts once.`
      : `Does not change the ${contribution.groupLabel} score.`;
  return <p className="score-note">{text}</p>;
}

export function filterSeverity(findings: readonly AuditFinding[], severity: AuditSeverity | 'all'): AuditFinding[] {
  if (severity === 'all') return [...findings];
  return findings.filter((item) => item.severity === severity);
}
