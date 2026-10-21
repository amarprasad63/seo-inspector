import { describe, expect, it } from 'vitest';
import { buildExportDocument, exportFilename } from '../src/utils/export';
import { entityMatches, findingMatches } from '../src/utils/filter';
import { analyzePage } from '../src/validation/engine';
import { pageAccess, safeStringify } from '../src/shared/json';
import { scriptSignature } from '../src/content/signature';
import type { PageExtraction } from '../src/shared/types';

describe('search and export', () => {
  const extraction: PageExtraction = {
    url: 'https://jobs.example.com/editor',
    title: 'Editor role',
    extractedAt: '2026-10-21T08:00:00.000Z',
    scripts: [
      {
        index: 0,
        elementId: 'job',
        raw: '{"@type":',
        originalLength: 8,
        truncated: false,
        parseStatus: 'error',
        parseError: 'Unexpected end of JSON input',
      },
      {
        index: 1,
        elementId: null,
        raw: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Editor role',
          url: 'https://jobs.example.com/editor',
        }),
        originalLength: 10,
        truncated: false,
        parseStatus: 'ok',
        parseError: null,
      },
    ],
  };

  it('filters entities and findings', () => {
    const analysis = analyzePage(extraction);
    expect(analysis.entities.filter((entity) => entityMatches(entity, 'webpage'))).toHaveLength(1);
    expect(analysis.entities.filter((entity) => entityMatches(entity, 'jobposting'))).toHaveLength(0);
    const syntax = analysis.findings.filter((finding) =>
      findingMatches(finding, 'invalid-json', new Set(['error', 'warning', 'info']), new Set(['syntax', 'structure', 'schema-org', 'google-rich-results', 'recommendation'])),
    );
    expect(syntax.some((finding) => finding.ruleId === 'syntax.invalid-json')).toBe(true);
    const hidden = analysis.findings.filter((finding) =>
      findingMatches(finding, '', new Set(['info']), new Set(['syntax'])),
    );
    expect(hidden.every((finding) => finding.severity === 'info' && finding.category === 'syntax')).toBe(true);
  });

  it('exports invalid raw JSON instead of dropping it', () => {
    const analysis = analyzePage(extraction);
    const report = buildExportDocument(extraction, analysis);
    const broken = report.scripts[0];
    expect(broken?.raw).toBe('{"@type":');
    expect(broken?.parsedIncluded).toBe(false);
    expect(broken?.parsed).toBeNull();
    expect(broken?.parseStatus).toBe('error');
    const page = report.scripts[1];
    expect(page?.parsedIncluded).toBe(true);
    expect(page?.parsed).toMatchObject({ name: 'Editor role' });
    expect(report.page.url).toBe(extraction.url);
    expect(report.findings.length).toBe(analysis.findings.length);
    expect(exportFilename(extraction.url, extraction.extractedAt)).toBe('jsonld-jobs.example.com-2026-10-21T08-00-00-000Z.json');
  });

  it('replaces cycles while stringifying', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value.self = value;
    expect(safeStringify(value)).toContain('[Circular]');
  });

  it('explains restricted pages and ignores unchanged script signatures', () => {
    expect(pageAccess('https://example.com/jobs').ok).toBe(true);
    expect(pageAccess('chrome://settings')?.ok).toBe(false);
    expect(pageAccess(undefined).ok).toBe(false);
    const scripts = [{ index: 0, elementId: null, raw: '{"a":1}' }];
    expect(scriptSignature(scripts)).toBe(scriptSignature([{ ...scripts[0]! }]));
    expect(scriptSignature(scripts)).not.toBe(scriptSignature([{ index: 0, elementId: null, raw: '{"a":2}' }]));
  });
});
