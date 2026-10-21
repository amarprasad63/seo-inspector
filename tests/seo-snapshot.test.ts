/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { collectPage } from '../src/content/collect-page';
import { evaluateKeywords } from '../src/seo/keywords';
import { auditPage } from '../src/seo/engine';
import type { PageExtraction } from '../src/shared/types';

describe('page snapshot', () => {
  it('excludes scripts and hidden text, and keeps JSON-LD extraction beside the snapshot', () => {
    document.title = 'Visible title';
    document.documentElement.lang = 'en';
    document.head.innerHTML = `
      <meta charset="utf-8" />
      <meta name="description" content="A useful description for this fixture page." />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="canonical" href="https://example.com/fixture" />
    `;
    document.body.innerHTML = `
      <nav>Skip this navigation boilerplate</nav>
      <main>
        <h1>Visible title</h1>
        <h3>Skipped level</h3>
        <p>Hidden secret should stay out.</p>
        <p>Internships in India are described in this paragraph for students.</p>
        <img src="https://example.com/map.png" />
        <img src="https://example.com/rule.png" alt="" />
        <a href="https://example.com/about">About</a>
        <a href="https://outside.example/go" rel="ugc">Outside</a>
        <a href="#missing">Missing</a>
        <script type="application/ld+json">{"secretKeyword":"should-not-count"}</script>
      </main>
    `;
    const hidden = document.querySelector('p');
    hidden?.setAttribute('hidden', '');
    const snapshot = collectPage(document);
    expect(snapshot.content.includedText.toLowerCase()).not.toContain('secretkeyword');
    expect(snapshot.content.includedText.toLowerCase()).not.toContain('hidden secret');
    expect(snapshot.content.includedText.toLowerCase()).not.toContain('navigation boilerplate');
    expect(snapshot.headings.map((heading) => heading.level)).toEqual([1, 3]);
    expect(snapshot.images[0]?.altPresent).toBe(false);
    expect(snapshot.images[1]?.alt).toBe('');
    expect(snapshot.anchors.some((anchor) => anchor.className === 'external' && anchor.rel.includes('ugc'))).toBe(true);
    const keywords = evaluateKeywords(snapshot, { primary: 'internships', secondary: '', brand: '', remember: false });
    expect(keywords.report.rows.find((row) => row.source === 'primary')?.content).toBeGreaterThan(0);
    const extraction: PageExtraction = {
      url: snapshot.url,
      title: snapshot.title,
      extractedAt: '2026-10-21T08:00:00.000Z',
      scripts: [],
      snapshot,
    };
    const audit = auditPage(extraction, null);
    expect(audit.findings.some((item) => item.ruleId === 'headings.skip')).toBe(true);
    expect(audit.findings.some((item) => item.ruleId === 'images.missing-alt')).toBe(true);
    expect(audit.findings.some((item) => item.ruleId === 'links.missing-fragment')).toBe(true);
    expect(audit.summary.score).not.toBeNull();
  });

  it('caps a very large image list instead of throwing', () => {
    document.body.innerHTML = Array.from({ length: 30 }, (_, index) => `<img src="/${index}.png" alt="Item ${index}">`).join('');
    const snapshot = collectPage(document, { maxImages: 5 });
    expect(snapshot.images).toHaveLength(5);
    expect(snapshot.caps.imagesOmitted).toBe(25);
  });
});
