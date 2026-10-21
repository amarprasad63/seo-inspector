import { safeStringify } from '../shared/json';
import type { PageExtraction } from '../shared/types';
import type { Analysis } from '../validation/engine';

export const GENERATOR_NAME = 'JSON-LD Schema Inspector';
export const GENERATOR_VERSION = '1.0.0';

export interface ExportScript {
  index: number;
  elementId: string | null;
  raw: string;
  originalLength: number;
  truncated: boolean;
  contentParseStatus: string;
  contentParseError: string | null;
  parseStatus: string;
  parseError: string | null;
  parsedIncluded: boolean;
  parsed: unknown | null;
}

export interface ExportDocument {
  generator: string;
  generatorVersion: string;
  note: string;
  page: { url: string; title: string };
  extractedAt: string;
  scripts: ExportScript[];
  entities: Analysis['entities'];
  findings: Analysis['findings'];
}

export function buildExportDocument(extraction: PageExtraction, analysis: Analysis): ExportDocument {
  const analyzedByIndex = new Map(analysis.scripts.map((script) => [script.index, script]));
  return {
    generator: GENERATOR_NAME,
    generatorVersion: GENERATOR_VERSION,
    note: 'Local diagnostics only. This file is not an official Google Rich Results Test result. Invalid raw JSON is preserved. Truncated scripts include only the retained prefix, originalLength, and truncated: true.',
    page: { url: extraction.url, title: extraction.title },
    extractedAt: extraction.extractedAt,
    scripts: extraction.scripts.map((script) => {
      const analyzed = analyzedByIndex.get(script.index);
      const parsedIncluded = analyzed?.parseStatus === 'ok';
      return {
        index: script.index,
        elementId: script.elementId,
        raw: script.raw,
        originalLength: script.originalLength,
        truncated: script.truncated,
        contentParseStatus: script.parseStatus,
        contentParseError: script.parseError,
        parseStatus: analyzed?.parseStatus ?? 'error',
        parseError: analyzed?.parseError ?? script.parseError,
        parsedIncluded,
        parsed: parsedIncluded && analyzed ? analyzed.data : null,
      };
    }),
    entities: analysis.entities,
    findings: analysis.findings,
  };
}

export function exportFilename(pageUrl: string, extractedAt: string): string {
  let host = 'page';
  try {
    const hostname = new URL(pageUrl).hostname.replace(/[^a-z0-9.-]+/gi, '_');
    if (hostname) host = hostname;
  } catch {
    host = 'page';
  }
  const stamp = extractedAt.replace(/[:.]/g, '-');
  return `jsonld-${host}-${stamp}.json`;
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([safeStringify(value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
