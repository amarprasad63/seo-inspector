import { useState } from 'react';
import { LIMITS } from '../shared/limits';
import { safeStringify } from '../shared/json';
import type { ParsedScript } from '../shared/types';
import { scriptMatches } from '../utils/filter';
import { CopyButton } from './CopyButton';

interface RawJsonViewerProps {
  scripts: readonly ParsedScript[];
  query: string;
}

export function RawJsonViewer({ scripts, query }: RawJsonViewerProps) {
  const normalized = query.trim().toLowerCase();
  const visible = scripts.filter((script) => scriptMatches(script, normalized));

  if (scripts.length === 0) {
    return (
      <p className="empty-copy">
        No <code>script[type="application/ld+json"]</code> elements were found in the main frame.
      </p>
    );
  }

  if (visible.length === 0) {
    return <p className="empty-copy">No scripts match this search.</p>;
  }

  return (
    <div className="raw-list">
      {visible.map((script, index) => (
        <RawScript key={`${script.index}-${script.elementId ?? 'script'}`} script={script} defaultOpen={index === 0} />
      ))}
    </div>
  );
}

function RawScript({ script, defaultOpen }: { script: ParsedScript; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showOriginal, setShowOriginal] = useState(script.parseStatus !== 'ok');
  const [renderAll, setRenderAll] = useState(false);
  const canRenderFormatted = script.parseStatus === 'ok' && script.raw.length <= LIMITS.rawRenderMaxChars;
  const formatted = open && canRenderFormatted && !showOriginal ? safeStringify(script.data) : '';
  const body = showOriginal || script.parseStatus !== 'ok' ? script.raw : formatted;
  const tooLarge = script.raw.length > LIMITS.rawRenderMaxChars;
  const preview = !tooLarge && body.length > LIMITS.rawPreviewChars && !renderAll ? body.slice(0, LIMITS.rawPreviewChars) : body;

  return (
    <article className="raw-card">
      <header className="raw-header">
        <button type="button" className="raw-title" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span>Script {script.index}</span>
          <span className="entity-meta">{script.elementId ? `id="${script.elementId}"` : 'no id'}</span>
          <span className={`pill pill-${script.parseStatus === 'ok' ? 'info' : 'error'}`}>
            {script.parseStatus}
            {script.truncated ? ' · truncated' : ''}
          </span>
        </button>
        <div className="raw-actions">
          {script.parseStatus === 'ok' ? (
            <button type="button" className="ghost-button" onClick={() => setShowOriginal((value) => !value)}>
              {showOriginal ? 'Show formatted' : 'Show original'}
            </button>
          ) : null}
          <CopyButton text={script.raw} label="Copy raw" />
          <CopyButton
            label="Copy parsed"
            disabled={script.parseStatus !== 'ok'}
            getText={() => safeStringify(script.data)}
          />
        </div>
      </header>
      {open ? (
        <div className="raw-body">
          {script.parseError ? <p className="parse-error">{script.parseError}</p> : null}
          {script.truncated ? (
            <p className="parse-error">
              Original length {script.originalLength.toLocaleString('en-US')} characters. Export keeps the retained
              prefix and the truncation flag. The omitted tail was not stored.
            </p>
          ) : null}
          {tooLarge ? (
            <p className="tree-note">
              This script is too large to render in the panel ({body.length.toLocaleString('en-US')} characters). Copy
              raw or export the report to read the full retained text.
            </p>
          ) : (
            <>
              <pre className="raw-pre">{preview}</pre>
              {body.length > LIMITS.rawPreviewChars && !renderAll ? (
                <button type="button" className="text-button" onClick={() => setRenderAll(true)}>
                  Show the remaining {(body.length - LIMITS.rawPreviewChars).toLocaleString('en-US')} characters in this
                  view
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
