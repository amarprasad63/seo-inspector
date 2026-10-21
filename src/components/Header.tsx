import { Download, PanelRightOpen, RefreshCw } from 'lucide-react';

interface HeaderProps {
  mode: 'popup' | 'sidepanel';
  iconUrl: string;
  title: string;
  url: string;
  refreshing: boolean;
  canExport: boolean;
  notice: string;
  onRefresh: () => void;
  onExport: () => void;
  onOpenSidePanel: () => void;
  sidePanelSupported: boolean;
}

export function Header({
  mode,
  iconUrl,
  title,
  url,
  refreshing,
  canExport,
  notice,
  onRefresh,
  onExport,
  onOpenSidePanel,
  sidePanelSupported,
}: HeaderProps) {
  const displayTitle = title || 'No page title';
  const displayUrl = url || 'No page URL';

  return (
    <header className="header">
      <div className="brand-row">
        <img className="brand-icon" src={iconUrl} alt="" width={28} height={28} />
        <div className="brand-copy">
          <h1>JSON-LD Schema Inspector</h1>
          <p>Local diagnostics</p>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-button" onClick={onRefresh} title="Refresh" aria-label="Refresh">
            <RefreshCw size={16} className={refreshing ? 'spin' : undefined} aria-hidden="true" />
          </button>
          {mode === 'popup' ? (
            <button
              type="button"
              className="icon-button"
              onClick={onOpenSidePanel}
              disabled={!sidePanelSupported}
              title={sidePanelSupported ? 'Open side panel' : 'Side panel is not available in this browser'}
              aria-label="Open side panel"
            >
              <PanelRightOpen size={16} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-button"
            onClick={onExport}
            disabled={!canExport}
            title="Export JSON report"
            aria-label="Export JSON report"
          >
            <Download size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="page-meta">
        <div className="truncate page-title" title={displayTitle}>
          {displayTitle}
        </div>
        <div className="truncate page-url" title={displayUrl}>
          {displayUrl}
        </div>
      </div>
      {notice ? <p className="header-notice">{notice}</p> : null}
    </header>
  );
}
