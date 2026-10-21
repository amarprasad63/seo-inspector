import { Download, FileText, Moon, PanelRightOpen, RefreshCw, Sun } from 'lucide-react';
import type { ColorTheme } from '../seo/preferences';

interface HeaderProps {
  mode: 'popup' | 'sidepanel';
  iconUrl: string;
  title: string;
  url: string;
  refreshing: boolean;
  canExport: boolean;
  notice: string;
  theme: ColorTheme;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onExportText: () => void;
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
  theme,
  onToggleTheme,
  onRefresh,
  onExport,
  onExportText,
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
          <h1>SEO Inspector</h1>
          <p>On-page SEO and JSON-LD. Local only.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Use light background' : 'Use dark background'}
            aria-label={theme === 'dark' ? 'Use light background' : 'Use dark background'}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
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
          <button
            type="button"
            className="icon-button"
            onClick={onExportText}
            disabled={!canExport}
            title="Export text report"
            aria-label="Export text report"
          >
            <FileText size={16} aria-hidden="true" />
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
