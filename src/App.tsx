import { useMemo, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { RawJsonViewer } from './components/RawJsonViewer';
import { SchemaExplorer } from './components/SchemaExplorer';
import { SearchInput } from './components/SearchInput';
import { StatusCard } from './components/StatusCard';
import { SummaryMetrics } from './components/SummaryMetrics';
import { ValidationPanel } from './components/ValidationPanel';
import { useAnalysis } from './hooks/useAnalysis';
import { useInspection } from './hooks/useInspection';
import { buildExportDocument, downloadJson, exportFilename } from './utils/export';
import type { FindingCategory, Severity } from './validation/types';

type InspectorTab = 'schemas' | 'validation' | 'raw';

const ALL_SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];
const ALL_CATEGORIES: readonly FindingCategory[] = [
  'syntax',
  'structure',
  'schema-org',
  'google-rich-results',
  'recommendation',
];

export function App({ mode }: { mode: 'popup' | 'sidepanel' }) {
  const inspection = useInspection();
  const { analysis, analyzing, failure } = useAnalysis(inspection.phase === 'ready' ? inspection.extraction : null);
  const [tab, setTab] = useState<InspectorTab>('schemas');
  const [query, setQuery] = useState('');
  const [severities, setSeverities] = useState<ReadonlySet<Severity>>(() => new Set(ALL_SEVERITIES));
  const [categories, setCategories] = useState<ReadonlySet<FindingCategory>>(() => new Set(ALL_CATEGORIES));
  const [notice, setNotice] = useState('');

  const counts = useMemo(() => {
    const findings = analysis?.findings ?? [];
    return {
      scripts: analysis?.scripts.length ?? inspection.extraction?.scripts.length ?? 0,
      entities: analysis?.entities.length ?? 0,
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
      findings: findings.length,
    };
  }, [analysis, inspection.extraction]);

  const title = inspection.extraction?.title || inspection.tabTitle;
  const url = inspection.extraction?.url || inspection.tabUrl;
  const iconUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('icons/icon32.png') : 'icons/icon32.png';
  const sidePanelSupported = typeof chrome !== 'undefined' && Boolean(chrome.sidePanel?.open);

  function showValidation(severity?: Severity) {
    setTab('validation');
    if (severity) {
      setSeverities(new Set([severity]));
      setCategories(new Set(ALL_CATEGORIES));
    }
  }

  function toggleSeverity(severity: Severity) {
    setSeverities((current) => toggleSet(current, severity));
  }

  function toggleCategory(category: FindingCategory) {
    setCategories((current) => toggleSet(current, category));
  }

  function exportReport() {
    if (!inspection.extraction || !analysis) return;
    const report = buildExportDocument(inspection.extraction, analysis);
    downloadJson(exportFilename(inspection.extraction.url, inspection.extraction.extractedAt), report);
  }

  const placeholder =
    tab === 'schemas'
      ? 'Search entities by type, path, or name'
      : tab === 'validation'
        ? 'Search findings by rule, path, or message'
        : 'Search raw JSON-LD scripts';

  return (
    <ErrorBoundary>
      <div className={`app mode-${mode}`}>
        <Header
          mode={mode}
          iconUrl={iconUrl}
          title={title}
          url={url}
          refreshing={inspection.phase === 'loading' || analyzing}
          canExport={Boolean(inspection.extraction && analysis)}
          notice={notice}
          sidePanelSupported={sidePanelSupported}
          onRefresh={inspection.refresh}
          onExport={exportReport}
          onOpenSidePanel={() => {
            void inspection.openSidePanel().catch((error: unknown) => {
              setNotice(error instanceof Error ? error.message : 'The side panel could not be opened.');
            });
          }}
        />
        {inspection.phase === 'loading' ? <StatusCard title="Reading this page" detail={inspection.detail} /> : null}
        {inspection.phase === 'restricted' ? <StatusCard title="This page can't be inspected" detail={inspection.detail} /> : null}
        {inspection.phase === 'error' ? <StatusCard title="Inspector unavailable" detail={inspection.detail} /> : null}
        {inspection.phase === 'ready' && failure ? <StatusCard title="Analysis failed" detail={failure} /> : null}
        {inspection.phase === 'ready' && !failure && !analysis ? (
          <StatusCard title="Analyzing JSON-LD" detail="Large structured data is parsed in a worker so this panel stays responsive." />
        ) : null}
        {inspection.phase === 'ready' && analysis ? (
          <>
            <SummaryMetrics
              scripts={counts.scripts}
              entities={counts.entities}
              errors={counts.errors}
              warnings={counts.warnings}
              onShowScripts={() => setTab('raw')}
              onShowEntities={() => setTab('schemas')}
              onShowErrors={() => showValidation('error')}
              onShowWarnings={() => showValidation('warning')}
            />
            {analysis.scripts.some((script) => script.truncated) ? (
              <p className="banner">
                A JSON-LD script exceeded the retention limit. The report keeps the retained prefix, the original
                length, and a truncation flag. Nothing beyond that prefix is available to export.
              </p>
            ) : null}
            <div className="tabs" role="tablist" aria-label="Inspector sections">
              <TabButton active={tab === 'schemas'} onClick={() => setTab('schemas')} label="Schemas" count={counts.entities} />
              <TabButton active={tab === 'validation'} onClick={() => setTab('validation')} label="Validation" count={counts.findings} />
              <TabButton active={tab === 'raw'} onClick={() => setTab('raw')} label="Raw JSON" count={counts.scripts} />
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder={placeholder} />
            <main className="panel" role="tabpanel">
              {tab === 'schemas' ? (
                <SchemaExplorer
                  entities={analysis.entities}
                  findings={analysis.findings}
                  query={query}
                  initialExpandDepth={mode === 'sidepanel' ? 2 : 1}
                />
              ) : null}
              {tab === 'validation' ? (
                <ValidationPanel
                  findings={analysis.findings}
                  query={query}
                  severities={severities}
                  categories={categories}
                  onToggleSeverity={toggleSeverity}
                  onToggleCategory={toggleCategory}
                  onShowAll={() => {
                    setSeverities(new Set(ALL_SEVERITIES));
                    setCategories(new Set(ALL_CATEGORIES));
                  }}
                />
              ) : null}
              {tab === 'raw' ? <RawJsonViewer scripts={analysis.scripts} query={query} /> : null}
            </main>
          </>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} className={active ? 'tab active' : 'tab'} onClick={onClick}>
      {label}
      <span className="tab-count">{count}</span>
    </button>
  );
}

function toggleSet<T>(current: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
