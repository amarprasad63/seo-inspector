import { safeStringify } from '../shared/json';
import type { SeoAudit } from '../seo/types';
import { formatOutline } from '../seo/headings';
import type { PageExtraction } from '../shared/types';
import type { Analysis } from '../validation/engine';

export const GENERATOR_NAME = 'SEO Inspector';
export const GENERATOR_VERSION = '1.1.0';

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
  audit: SeoAudit | null;
}

export function buildExportDocument(extraction: PageExtraction, analysis: Analysis, audit: SeoAudit | null = null): ExportDocument {
  const analyzedByIndex = new Map(analysis.scripts.map((script) => [script.index, script]));
  return {
    generator: GENERATOR_NAME,
    generatorVersion: GENERATOR_VERSION,
    note: 'Local diagnostics only. The audit score is not a Google ranking score. Unavailable checks were not treated as passed. Invalid raw JSON is preserved. Truncated scripts include only the retained prefix, originalLength, and truncated: true. Image bytes, robots.txt, response headers, and link destinations were not fetched.',
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
    audit,
  };
}

export function buildTextReport(extraction: PageExtraction, audit: SeoAudit): string {
  const lines = [
    'SEO Inspector report',
    'Local diagnostic. Not a Google ranking score and not an indexing confirmation.',
    '',
    `URL: ${extraction.url}`,
    `Title: ${extraction.title}`,
    `Extracted: ${extraction.extractedAt}`,
    `Score: ${audit.summary.score ?? 'not available'}${audit.score.coverage.provisional ? ' (provisional)' : ''}`,
    audit.score.coverage.summary,
    audit.score.methodology,
    '',
    `Errors: ${audit.summary.errors}`,
    `Warnings: ${audit.summary.warnings}`,
    `Info: ${audit.summary.info}`,
    `Passed checks: ${audit.summary.passed}`,
    `Indexability: ${audit.summary.indexability}`,
    `Structured data entities: ${audit.summary.entities}`,
    `Internal links: ${audit.summary.internalLinks}`,
    `External links: ${audit.summary.externalLinks}`,
    '',
    'Score deductions',
  ];
  for (const group of audit.score.groups) {
    lines.push('', `${group.label}: ${group.score ?? 'not evaluated'}`);
    if (group.deductions.length === 0 && group.overlapped.length === 0) lines.push('No deductions.');
    for (const deduction of group.deductions) {
      lines.push(`- ${deduction.ruleId}: -${deduction.points} (${deduction.severity}, ${deduction.instances} instance(s), counted once)`);
    }
    for (const overlap of group.overlapped) {
      lines.push(`- ${overlap.ruleId}: not deducted again (same issue as ${overlap.countedAs}, ${overlap.instances} instance(s))`);
    }
  }
  lines.push('', 'Findings');
  if (audit.findings.length === 0) lines.push('None.');
  for (const item of audit.findings) {
    lines.push(`- [${item.severity}] ${item.name}: ${item.message}`);
    lines.push(`  Why: ${item.why}`);
    lines.push(`  Evidence: ${item.evidence}`);
    lines.push(`  Fix: ${item.remediation}`);
  }
  if (audit.findingsOmitted > 0) lines.push(`Omitted instances: ${audit.findingsOmitted}. They remain in the score as the same rule.`);
  lines.push('', 'Could not evaluate');
  if (audit.unavailable.length === 0) lines.push('None.');
  for (const item of audit.unavailable) lines.push(`- ${item.name}: ${item.reason}`);
  lines.push('', 'Heading outline', formatOutline(audit.headingOutline) || 'None collected.');
  lines.push('Keyword notes');
  for (const note of audit.keywords.notes) lines.push(`- ${note}`);
  lines.push(`Analyzed words: ${audit.keywords.analyzedWords}. ${audit.keywords.textSource}`);
  return lines.join('\n');
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

export function downloadText(filename: string, value: string): void {
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
  downloadBlob(filename, blob);
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([safeStringify(value)], { type: 'application/json' });
  downloadBlob(filename, blob);
}

function downloadBlob(filename: string, blob: Blob): void {
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
