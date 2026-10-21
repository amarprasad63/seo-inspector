interface SummaryMetricsProps {
  scripts: number;
  entities: number;
  errors: number;
  warnings: number;
  onShowScripts: () => void;
  onShowEntities: () => void;
  onShowErrors: () => void;
  onShowWarnings: () => void;
}

export function SummaryMetrics({
  scripts,
  entities,
  errors,
  warnings,
  onShowScripts,
  onShowEntities,
  onShowErrors,
  onShowWarnings,
}: SummaryMetricsProps) {
  return (
    <section className="metrics" aria-label="Summary">
      <button type="button" className="metric" onClick={onShowScripts}>
        <span className="metric-value">{scripts}</span>
        <span className="metric-label">Scripts</span>
      </button>
      <button type="button" className="metric" onClick={onShowEntities}>
        <span className="metric-value">{entities}</span>
        <span className="metric-label">Entities</span>
      </button>
      <button type="button" className="metric metric-error" onClick={onShowErrors}>
        <span className="metric-value">{errors}</span>
        <span className="metric-label">Errors</span>
      </button>
      <button type="button" className="metric metric-warning" onClick={onShowWarnings}>
        <span className="metric-value">{warnings}</span>
        <span className="metric-label">Warnings</span>
      </button>
    </section>
  );
}
