import { describe, expect, it } from 'vitest';
import { parseScript } from '../src/parser/jsonld-parser';
import { analyzeScripts } from '../src/validation/engine';
import type { Finding } from '../src/validation/types';

function analyze(raws: string[]) {
  return analyzeScripts(raws.map((raw, index) => parseScript({ index, elementId: index === 1 ? 'second' : null, raw })));
}

function ids(findings: Finding[], severity?: Finding['severity']): string[] {
  return findings.filter((finding) => (severity ? finding.severity === severity : true)).map((finding) => finding.ruleId);
}

const validJob = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'News editor',
  description: 'Edit the evening bulletin.',
  datePosted: '2026-10-01',
  validThrough: '2026-12-01',
  employmentType: 'FULL_TIME',
  identifier: 'job-42',
  directApply: true,
  hiringOrganization: { '@type': 'Organization', name: 'Acme News', url: 'https://example.com', logo: 'https://example.com/logo.png' },
  jobLocation: {
    '@type': 'Place',
    address: { '@type': 'PostalAddress', addressLocality: 'Delhi', addressCountry: 'IN' },
  },
};

describe('syntax rules', () => {
  it('flags malformed JSON, empty scripts, and primitive roots', () => {
    const result = analyze(['{"title": ', '', 'null', '[]']);
    expect(ids(result.findings, 'error')).toEqual(
      expect.arrayContaining(['syntax.invalid-json', 'syntax.empty', 'syntax.primitive-root']),
    );
    expect(ids(result.findings)).toContain('structure.empty-root');
    expect(result.scripts[0]?.raw).toBe('{"title": ');
    expect(result.scripts[1]?.raw).toBe('');
  });
});

describe('structure rules', () => {
  it('warns on a missing context and accepts schema.org contexts', () => {
    const missing = analyze([JSON.stringify({ '@type': 'WebPage', name: 'Home', url: 'https://example.com' })]);
    expect(ids(missing.findings)).toContain('structure.missing-context');
    const present = analyze([JSON.stringify({ '@context': { '@vocab': 'https://schema.org/' }, '@type': 'WebPage', name: 'Home', url: 'https://example.com/' })]);
    expect(ids(present.findings)).not.toContain('structure.missing-context');
  });

  it('flags a malformed @graph and an unfamiliar context without calling it invalid JSON', () => {
    const result = analyze([
      JSON.stringify({ '@context': 'https://example.com/vocab', '@type': 'Thing', name: 'X', '@graph': 'nope' }),
    ]);
    expect(ids(result.findings, 'error')).toContain('structure.malformed-graph');
    expect(ids(result.findings)).toContain('structure.unfamiliar-context');
    expect(ids(result.findings)).not.toContain('syntax.invalid-json');
  });

  it('detects conflicting duplicate @id values across scripts', () => {
    const result = analyze([
      JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', '@id': 'https://example.com/#org', name: 'Acme' }),
      JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', '@id': 'https://example.com/#org', name: 'Acme' }),
    ]);
    expect(ids(result.findings)).toContain('structure.conflicting-id');
  });
});

describe('schema.org subset', () => {
  it('warns when a known property has the wrong shape', () => {
    const result = analyze([
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: { unexpected: true },
        description: 'A role',
        datePosted: '2026-10-01',
        hiringOrganization: { '@type': 'Organization', name: 'Acme' },
        jobLocation: { '@type': 'Place', name: 'Delhi' },
      }),
    ]);
    expect(result.findings.some((finding) => finding.ruleId === 'schema.value-shape' && finding.property === 'title')).toBe(true);
  });

  it('does not treat an unknown property or unknown type as an error', () => {
    const result = analyze([
      JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme', internalScore: 3 }),
    ]);
    const unknown = result.findings.find((finding) => finding.ruleId === 'schema.unknown-properties');
    expect(unknown?.severity).toBe('info');
    const custom = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'MadeUpType', name: 'Z' })]);
    expect(custom.findings.find((finding) => finding.ruleId === 'schema.unknown-type')?.severity).toBe('info');
    expect(ids(custom.findings, 'error')).not.toContain('schema.unknown-type');
  });

  it('inherits Thing.name onto Organization', () => {
    const result = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 12 })]);
    expect(result.findings.some((finding) => finding.ruleId === 'schema.value-shape' && finding.property === 'name')).toBe(true);
  });
});

describe('google rich-result diagnostics', () => {
  it('accepts a complete JobPosting without errors', () => {
    const result = analyze([JSON.stringify(validJob)]);
    expect(ids(result.findings, 'error').filter((id) => id.startsWith('google.'))).toEqual([]);
    expect(result.entities.some((entity) => entity.types.includes('JobPosting'))).toBe(true);
    expect(result.entities.some((entity) => entity.types.includes('Organization'))).toBe(true);
  });

  it('requires JobPosting title and location, including the telecommute alternative', () => {
    const missing = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'JobPosting', description: 'Work' })]);
    expect(ids(missing.findings, 'error')).toEqual(
      expect.arrayContaining(['google.jobposting.title', 'google.jobposting.jobLocation', 'google.jobposting.datePosted']),
    );
    const remote = analyze([
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Editor',
        description: 'Remote editing',
        datePosted: '2026-10-01',
        hiringOrganization: { '@type': 'Organization', name: 'Acme' },
        jobLocationType: 'TELECOMMUTE',
      }),
    ]);
    expect(ids(remote.findings, 'error')).toContain('google.jobposting.applicantLocationRequirements');
    expect(ids(remote.findings, 'error')).not.toContain('google.jobposting.jobLocation');
  });

  it('does not apply JobPosting rules to WebPage or Product rules to a bare Offer', () => {
    const page = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Jobs', url: 'https://example.com/jobs' })]);
    expect(page.findings.some((finding) => finding.ruleId.startsWith('google.jobposting'))).toBe(false);
    expect(page.findings.some((finding) => finding.ruleId.startsWith('google.article'))).toBe(false);
    const offer = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'Offer', price: '10', priceCurrency: 'INR' })]);
    expect(offer.findings.some((finding) => finding.ruleId.startsWith('google.product'))).toBe(false);
  });

  it('checks product, breadcrumb, article, recipe, video, event, and local business rules', () => {
    const product = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', description: 'A pen' })]);
    expect(ids(product.findings, 'error')).toEqual(expect.arrayContaining(['google.product.name', 'google.product.signal']));

    const crumbs = analyze([
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' }],
      }),
    ]);
    expect(ids(crumbs.findings, 'error').filter((id) => id.startsWith('google.breadcrumb'))).toEqual([]);

    const article = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: 'Story' })]);
    expect(ids(article.findings)).toContain('google.article.image');
    expect(ids(article.findings)).toContain('google.article.top-stories');

    const recipe = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'Chai' })]);
    expect(ids(recipe.findings, 'error')).toContain('google.recipe.image');

    const video = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'VideoObject', name: 'Reel' })]);
    expect(ids(video.findings, 'error')).toEqual(expect.arrayContaining(['google.video.thumbnailUrl', 'google.video.uploadDate']));

    const event = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: 'Fair' })]);
    expect(ids(event.findings, 'error')).toEqual(expect.arrayContaining(['google.event.startDate', 'google.event.location']));

    const clinic = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'Dentist', name: 'Smile' })]);
    expect(ids(clinic.findings, 'error')).toContain('google.localbusiness.address');

    const org = analyze([JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme', url: 'https://example.com' })]);
    expect(org.findings.find((finding) => finding.ruleId === 'google.organization.logo')?.severity).toBe('info');
    expect(ids(org.findings, 'error').some((id) => id.startsWith('google.localbusiness'))).toBe(false);
  });

  it('adds an informational note for relative rich-result URLs', () => {
    const result = analyze([
      JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme', url: 'https://example.com', logo: '/logo.png' }),
    ]);
    expect(ids(result.findings)).toContain('recommendation.relative-url');
    expect(result.findings.find((finding) => finding.ruleId === 'recommendation.relative-url')?.severity).toBe('info');
  });
});
