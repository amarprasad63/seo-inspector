import { describe, expect, it } from 'vitest';
import { evaluateAnchors } from '../src/seo/anchors';
import { auditPage } from '../src/seo/engine';
import { evaluateHeadings } from '../src/seo/headings';
import { evaluateImages } from '../src/seo/images';
import { evaluateIndexability } from '../src/seo/indexability';
import { evaluateKeywords } from '../src/seo/keywords';
import { evaluateMetadata } from '../src/seo/metadata';
import { scoreAudit } from '../src/seo/score';
import { evaluateSocial } from '../src/seo/social';
import { evaluateTechnical } from '../src/seo/technical';
import { countPhrase } from '../src/seo/text';
import { buildExportDocument, buildTextReport } from '../src/utils/export';
import { analyzePage } from '../src/validation/engine';
import type { PageExtraction } from '../src/shared/types';
import { snapshot } from './seo-fixture';

const targets = { primary: 'internships', secondary: 'engineering roles', brand: '', remember: false };

function extraction(page = snapshot()): PageExtraction {
  return {
    url: page.url,
    title: page.title,
    extractedAt: '2026-10-21T08:00:00.000Z',
    scripts: [],
    snapshot: page,
  };
}

describe('metadata', () => {
  it('flags a missing title, empty title, and missing description', () => {
    const missing = evaluateMetadata(snapshot({ title: '', titleCount: 0 }), targets);
    expect(missing.findings.some((item) => item.ruleId === 'metadata.title-missing')).toBe(true);
    const empty = evaluateMetadata(snapshot({ title: '   ', titleCount: 1 }), targets);
    expect(empty.findings.some((item) => item.ruleId === 'metadata.title-missing')).toBe(true);
    const noDescription = evaluateMetadata(snapshot({ metas: [{ kind: 'name', key: 'viewport', content: 'width=device-width', index: 0 }] }), targets);
    expect(noDescription.findings.some((item) => item.ruleId === 'metadata.description-missing')).toBe(true);
  });

  it('flags duplicate descriptions and does not claim cross-site duplicates', () => {
    const result = evaluateMetadata(
      snapshot({
        metas: [
          { kind: 'name', key: 'description', content: 'First summary', index: 0 },
          { kind: 'name', key: 'description', content: 'Second summary', index: 1 },
          { kind: 'name', key: 'viewport', content: 'width=device-width', index: 2 },
        ],
      }),
      targets,
    );
    expect(result.findings.some((item) => item.ruleId === 'metadata.description-duplicate')).toBe(true);
    expect(result.unavailable.some((item) => item.ruleId === 'metadata.cross-page-duplicates')).toBe(true);
  });
});

describe('keywords', () => {
  it('matches phrases without case or punctuation, and ignores an empty target', () => {
    expect(countPhrase('Best Internships, in India!', 'internships in')).toBe(1);
    expect(countPhrase('internship', 'internships')).toBe(0);
    const empty = evaluateKeywords(snapshot(), { primary: ' ', secondary: '', brand: '', remember: false });
    expect(empty.outcome.unavailable.some((item) => item.ruleId === 'keywords.target')).toBe(true);
    const report = evaluateKeywords(snapshot(), targets);
    const primary = report.report.rows.find((row) => row.source === 'primary');
    expect(primary?.title).toBeGreaterThan(0);
    expect(primary?.content).toBeGreaterThan(0);
  });

  it('flags an exact phrase that is repeated and does not set a density target', () => {
    const text = Array.from({ length: 12 }, () => 'internships').join(' ');
    const result = evaluateKeywords(
      snapshot({
        title: 'Guide',
        content: { includedText: text, wordCount: 12, truncated: false, originalLength: text.length, source: 'main', paragraphs: [] },
        headings: [],
      }),
      targets,
    );
    const repetition = result.outcome.findings.find((item) => item.ruleId === 'keywords.repetition');
    expect(repetition?.message).toMatch(/not a density target/i);
  });
});

describe('social metadata', () => {
  it('flags missing core fields, duplicates, relative URLs, and falls back for a preview', () => {
    const page = snapshot({
      metas: [
        { kind: 'property', key: 'og:title', content: 'Share title', index: 0 },
        { kind: 'property', key: 'og:title', content: 'Other title', index: 1 },
        { kind: 'property', key: 'og:image', content: '/cover.jpg', index: 2 },
        { kind: 'name', key: 'description', content: 'Find internships across India for students and fresh graduates.', index: 3 },
        { kind: 'name', key: 'viewport', content: 'width=device-width', index: 4 },
      ],
    });
    const social = evaluateSocial(page);
    expect(social.outcome.findings.some((item) => item.ruleId === 'social.missing-og:description')).toBe(true);
    expect(social.outcome.findings.some((item) => item.ruleId === 'social.conflict-og:title')).toBe(true);
    expect(social.outcome.findings.some((item) => item.ruleId === 'social.relative-og:image')).toBe(true);
    expect(social.outcome.findings.some((item) => item.ruleId === 'social.twitter-missing')).toBe(true);
    expect(social.preview.title).toBe('Share title');
    expect(social.preview.source).toMatch(/Open Graph/);
  });
});

describe('headings, images, and links', () => {
  it('detects missing, multiple, empty, skipped, repeated, and hidden headings', () => {
    const missing = evaluateHeadings(snapshot({ headings: [] }));
    expect(missing.outcome.findings.some((item) => item.ruleId === 'headings.missing-h1')).toBe(true);
    const messy = evaluateHeadings(
      snapshot({
        headings: [
          { level: 1, text: 'One', hidden: false, highlightId: 'h:0', selectorHint: 'h1', index: 0 },
          { level: 1, text: 'Two', hidden: false, highlightId: 'h:1', selectorHint: 'h1', index: 1 },
          { level: 3, text: '', hidden: false, highlightId: 'h:2', selectorHint: 'h3', index: 2 },
          { level: 2, text: 'Repeat', hidden: false, highlightId: 'h:3', selectorHint: 'h2', index: 3 },
          { level: 2, text: 'Repeat', hidden: false, highlightId: 'h:4', selectorHint: 'h2', index: 4 },
          { level: 2, text: 'Repeat', hidden: false, highlightId: 'h:5', selectorHint: 'h2', index: 5 },
          { level: 2, text: 'Secret', hidden: true, highlightId: 'h:6', selectorHint: 'h2', index: 6 },
        ],
      }),
    );
    const ids = messy.outcome.findings.map((item) => item.ruleId);
    expect(ids).toContain('headings.multiple-h1');
    expect(ids).toContain('headings.empty');
    expect(ids).toContain('headings.skip');
    expect(ids).toContain('headings.hidden');
    expect(ids).toContain('headings.repeated');
  });

  it('distinguishes missing alt, empty alt, failed images, and missing dimensions', () => {
    const result = evaluateImages(
      snapshot({
        images: [
          image(0, { altPresent: false, alt: null }),
          image(1, { altPresent: true, alt: '' }),
          image(2, { altPresent: true, alt: 'Campus map', failed: true, widthAttr: null, heightAttr: null }),
        ],
      }),
    );
    const ids = result.findings.map((item) => item.ruleId);
    expect(ids).toContain('images.missing-alt');
    expect(ids).toContain('images.empty-alt');
    expect(result.findings.find((item) => item.ruleId === 'images.empty-alt')?.severity).toBe('info');
    expect(ids).toContain('images.failed');
    expect(ids).toContain('images.dimensions');
    expect(result.unavailable.some((item) => item.ruleId === 'images.bytes')).toBe(true);
  });

  it('classifies links and does not call qualifiers or unchecked URLs broken', () => {
    const result = evaluateAnchors(
      snapshot({
        ids: ['known'],
        anchors: [
          anchor(0, 'https://example.com/about', 'About', 'internal'),
          anchor(1, 'https://other.example/out', 'Partner', 'external', 'nofollow sponsored'),
          anchor(2, '#missing', '', 'fragment'),
          anchor(3, '#known', 'Section', 'fragment'),
          anchor(4, '', '', 'empty'),
          anchor(5, 'https://other.example/ugc', 'Story', 'external', 'ugc'),
        ],
      }),
    );
    const ids = result.findings.map((item) => item.ruleId);
    expect(ids).toContain('links.missing-fragment');
    expect(ids).toContain('links.unnamed');
    expect(ids).not.toContain('links.broken');
    expect(result.findings.find((item) => item.ruleId === 'links.rel-qualifiers')?.message).toMatch(/not errors/);
    expect(result.unavailable.some((item) => item.ruleId === 'links.broken')).toBe(true);
  });
});

describe('indexability and score', () => {
  it('reports noindex, conflicts, canonical problems, and hreflang without claiming the index state', () => {
    const result = evaluateIndexability(
      snapshot({
        metas: [
          { kind: 'name', key: 'robots', content: 'noindex, nofollow', index: 0 },
          { kind: 'name', key: 'googlebot', content: 'index', index: 1 },
          { kind: 'name', key: 'viewport', content: 'width=device-width', index: 2 },
          { kind: 'name', key: 'description', content: 'Find internships across India for students and fresh graduates.', index: 3 },
        ],
        headLinks: [
          { rel: 'canonical', href: '/internships', hreflang: null, type: null, index: 0 },
          { rel: 'canonical', href: 'https://example.com/other', hreflang: null, type: null, index: 1 },
          { rel: 'alternate', href: 'https://example.com/hi', hreflang: 'hi-IN', type: null, index: 2 },
          { rel: 'alternate', href: 'https://example.com/bad', hreflang: 'not a language', type: null, index: 3 },
        ],
      }),
    );
    const ids = result.findings.map((item) => item.ruleId);
    expect(ids).toContain('indexability.noindex');
    expect(ids).toContain('indexability.nofollow');
    expect(ids).toContain('indexability.robots-conflict');
    expect(ids).toContain('indexability.canonical-multiple');
    expect(ids).toContain('indexability.canonical-relative');
    expect(ids).toContain('indexability.hreflang-invalid');
    expect(result.findings.find((item) => item.ruleId === 'indexability.noindex')?.message).toMatch(/unknown/i);
    expect(result.unavailable.some((item) => item.ruleId === 'indexability.indexed')).toBe(true);
    expect(result.unavailable.some((item) => item.ruleId === 'indexability.hreflang-return')).toBe(true);
    const missingCanonical = evaluateIndexability(snapshot({ headLinks: [] }));
    expect(missingCanonical.findings.some((item) => item.ruleId === 'indexability.canonical-missing')).toBe(true);
  });

  it('flags a missing viewport and an invalid language without claiming WCAG conformance', () => {
    const result = evaluateTechnical(snapshot({ htmlLang: 'english', metas: [{ kind: 'name', key: 'description', content: 'Find internships across India for students and fresh graduates.', index: 0 }] }));
    expect(result.findings.some((item) => item.ruleId === 'technical.viewport')).toBe(true);
    expect(result.findings.some((item) => item.ruleId === 'technical.lang-invalid')).toBe(true);
    expect(result.unavailable.some((item) => item.ruleId === 'technical.wcag')).toBe(true);
  });

  it('deducts once per rule, skips disabled rules, and does not invent a score without a snapshot', () => {
    const page = snapshot({
      images: [image(0, { altPresent: false, alt: null }), image(1, { altPresent: false, alt: null }), image(2, { altPresent: false, alt: null })],
    });
    const audit = auditPage(extraction(page), null);
    const alt = audit.score.deductions.find((item) => item.ruleId === 'images.missing-alt');
    expect(alt?.instances).toBe(3);
    expect(alt?.points).toBe(3);
    const disabled = auditPage(extraction(page), null, { disabledRuleIds: new Set(['images.missing-alt']) });
    expect(disabled.score.deductions.some((item) => item.ruleId === 'images.missing-alt')).toBe(false);
    expect(disabled.score.excludedRuleIds).toContain('images.missing-alt');
    expect(disabled.summary.score).toBeGreaterThan(audit.summary.score ?? 0);
    const bare = auditPage({ url: page.url, title: page.title, extractedAt: '2026-10-21T08:00:00.000Z', scripts: [] }, null);
    expect(bare.summary.score).not.toBeNull();
    expect(bare.unavailable.some((item) => item.ruleId === 'audit.snapshot-missing')).toBe(true);
    expect(bare.summary.metadataStatus).toBe('Not collected');
    const zero = scoreAudit([], new Set());
    expect(zero.score).toBe(100);
  });
});

describe('structured data regression and export', () => {
  it('keeps invalid JSON-LD and nested entities in the audit export', () => {
    const page = snapshot();
    const payload: PageExtraction = {
      ...extraction(page),
      scripts: [
        {
          index: 0,
          elementId: null,
          raw: '{"@type":',
          originalLength: 9,
          truncated: false,
          parseStatus: 'error',
          parseError: 'bad',
        },
        {
          index: 1,
          elementId: 'graph',
          raw: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [{ '@type': 'Organization', name: 'Example' }],
          }),
          originalLength: 20,
          truncated: false,
          parseStatus: 'ok',
          parseError: null,
        },
      ],
    };
    const analysis = analyzePage(payload);
    expect(analysis.entities.some((entity) => entity.types.includes('Organization'))).toBe(true);
    expect(analysis.findings.some((item) => item.ruleId === 'syntax.invalid-json')).toBe(true);
    const audit = auditPage(payload, analysis);
    expect(audit.findings.some((item) => item.ruleId === 'jsonld.syntax.invalid-json')).toBe(true);
    const report = buildExportDocument(payload, analysis, audit);
    expect(report.scripts[0]?.raw).toBe('{"@type":');
    expect(report.audit?.unavailable.some((item) => item.reason.length > 0)).toBe(true);
    const text = buildTextReport(payload, audit);
    expect(text).toMatch(/Not a Google ranking score/);
    expect(text).toMatch(/Could not evaluate/);
    expect(text).not.toMatch(/<script>/);
  });
});

function image(index: number, partial: Partial<PageExtraction['snapshot']> extends never ? never : Record<string, unknown>) {
  return {
    src: `https://example.com/${index}.png`,
    srcset: '',
    alt: 'Campus',
    altPresent: true,
    widthAttr: '100',
    heightAttr: '80',
    loading: null,
    decoding: null,
    fetchPriority: null,
    naturalWidth: 100,
    naturalHeight: 80,
    renderedWidth: 100,
    renderedHeight: 80,
    complete: true,
    failed: false,
    hidden: false,
    inLink: false,
    aboveFold: null,
    highlightId: `img:${index}`,
    selectorHint: 'img',
    index,
    ...partial,
  };
}

function anchor(index: number, href: string, text: string, className: 'internal' | 'external' | 'fragment' | 'empty', rel = '') {
  return {
    href,
    text,
    rel,
    target: null,
    hasImage: false,
    imageAlt: '',
    hidden: false,
    highlightId: `a:${index}`,
    selectorHint: 'a',
    index,
    className,
  };
}
