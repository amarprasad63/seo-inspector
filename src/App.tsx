import { useEffect, useMemo, useState } from 'react';
import { AuditView } from './components/audit/AuditView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { StatusCard } from './components/StatusCard';
import { useAnalysis } from './hooks/useAnalysis';
import { useInspection } from './hooks/useInspection';
import { auditPage } from './seo/engine';
import { loadKeywordTargets, saveKeywordTargets } from './seo/preferences';
import { EMPTY_TARGETS, type KeywordTargets } from './seo/types';
import { isHighlightRequest, PROTOCOL_VERSION, SOURCE } from './shared/protocol';
import { buildExportDocument, buildTextReport, downloadJson, downloadText, exportFilename } from './utils/export';

export function App({ mode }: { mode: 'popup' | 'sidepanel' }) {
  const inspection = useInspection();
  const { analysis, analyzing, failure } = useAnalysis(inspection.phase === 'ready' ? inspection.extraction : null);
  const [targets, setTargets] = useState<KeywordTargets>(EMPTY_TARGETS);
  const [targetsReady, setTargetsReady] = useState(false);
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadKeywordTargets().then((stored) => {
      setTargets(stored);
      setTargetsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!targetsReady) return;
    void saveKeywordTargets(targets);
  }, [targets, targetsReady]);

  const audit = useMemo(() => {
    if (!inspection.extraction || !analysis) return null;
    return auditPage(inspection.extraction, analysis, { targets, disabledRuleIds: disabled });
  }, [inspection.extraction, analysis, targets, disabled]);

  const title = inspection.extraction?.title || inspection.tabTitle;
  const url = inspection.extraction?.url || inspection.tabUrl;
  const iconUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('icons/icon32.png') : 'icons/icon32.png';
  const sidePanelSupported = typeof chrome !== 'undefined' && Boolean(chrome.sidePanel?.open);

  function exportReport() {
    if (!inspection.extraction || !analysis) return;
    const report = buildExportDocument(inspection.extraction, analysis, audit);
    downloadJson(exportFilename(inspection.extraction.url, inspection.extraction.extractedAt), report);
  }

  function exportText() {
    if (!inspection.extraction || !audit) return;
    const stamp = inspection.extraction.extractedAt.replace(/[:.]/g, '-');
    downloadText(`seo-report-${stamp}.txt`, buildTextReport(inspection.extraction, audit));
  }

  async function highlight(highlightId: string) {
    if (inspection.tabId == null) return;
    const message = { source: SOURCE, version: PROTOCOL_VERSION, type: 'highlight' as const, highlightId };
    if (!isHighlightRequest(message)) return;
    try {
      const response: unknown = await chrome.tabs.sendMessage(inspection.tabId, message);
      const failed = typeof response === 'object' && response !== null && (response as { ok?: boolean }).ok === false;
      if (failed) {
        setNotice(String((response as { error?: string }).error ?? 'The element could not be highlighted.'));
      }
    } catch {
      setNotice('Highlight is available after the page content script loads. Refresh and try again.');
    }
  }

  return (
    <ErrorBoundary>
      <div className={`app mode-${mode}`}>
        <Header
          mode={mode}
          iconUrl={iconUrl}
          title={title}
          url={url}
          refreshing={inspection.phase === 'loading' || analyzing}
          canExport={Boolean(inspection.extraction && analysis && audit)}
          notice={notice}
          sidePanelSupported={sidePanelSupported}
          onRefresh={inspection.refresh}
          onExport={exportReport}
          onExportText={exportText}
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
          <StatusCard title="Analyzing this page" detail="Large JSON-LD is parsed in a worker. On-page checks use the collected snapshot." />
        ) : null}
        {inspection.phase === 'ready' && analysis && audit && inspection.extraction ? (
          <>
            {mode === 'popup' ? (
              <p className="banner">The popup shows one section at a time. Open the side panel for the full audit.</p>
            ) : null}
            {analysis.scripts.some((script) => script.truncated) ? (
              <p className="banner">
                A JSON-LD script exceeded the retention limit. The report keeps the retained prefix, the original length, and a
                truncation flag.
              </p>
            ) : null}
            <AuditView
              mode={mode}
              extraction={inspection.extraction}
              analysis={analysis}
              audit={audit}
              targets={targets}
              disabled={disabled}
              onTargets={setTargets}
              onToggleRule={(ruleId) =>
                setDisabled((current) => {
                  const next = new Set(current);
                  if (next.has(ruleId)) next.delete(ruleId);
                  else next.add(ruleId);
                  return next;
                })
              }
              onHighlight={(highlightId) => {
                void highlight(highlightId);
              }}
            />
          </>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
