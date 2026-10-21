import type { PageSnapshot } from '../shared/types';
import { finding, unavailable } from './finding';
import { metaValues } from './metadata';
import { countPhrase, normalizeText, splitKeywordList, topTerms, wordsOf } from './text';
import type { KeywordReport, KeywordRow, KeywordSnippet, KeywordTargets, RuleOutcome } from './types';

const PHRASE_REPEAT = 8;

export function evaluateKeywords(snapshot: PageSnapshot, targets: KeywordTargets): { report: KeywordReport; outcome: RuleOutcome } {
  const description = metaValues(snapshot, 'name', 'description')[0] ?? '';
  const h1 = snapshot.headings.filter((heading) => heading.level === 1 && !heading.hidden).map((heading) => heading.text).join(' ');
  const headingText = snapshot.headings.filter((heading) => !heading.hidden).map((heading) => heading.text).join(' ');
  const altText = snapshot.images.map((image) => image.alt ?? '').join(' ');
  const anchorText = snapshot.anchors.filter((anchor) => anchor.className === 'internal').map((anchor) => anchor.text).join(' ');
  const analyzedWords = snapshot.content.wordCount;
  const rows: KeywordRow[] = [];
  const outcome: RuleOutcome = { findings: [], passed: [], unavailable: [] };

  const tracked: { keyword: string; source: KeywordRow['source'] }[] = [];
  if (targets.primary.trim()) tracked.push({ keyword: targets.primary.trim(), source: 'primary' });
  else {
    outcome.unavailable.push(
      unavailable({
        ruleId: 'keywords.target',
        name: 'Target keyword',
        category: 'keywords',
        reason: 'No primary keyword was entered. Automatic terms are still listed. They are not search-demand data.',
      }),
    );
  }
  for (const keyword of splitKeywordList(targets.secondary)) tracked.push({ keyword, source: 'secondary' });
  if (targets.brand.trim()) tracked.push({ keyword: targets.brand.trim(), source: 'brand' });
  for (const term of topTerms(snapshot.content.includedText)) tracked.push({ keyword: term.term, source: 'automatic' });

  for (const item of tracked) {
    const row = buildRow(snapshot, item.keyword, item.source, description, h1, headingText, altText, anchorText, analyzedWords);
    rows.push(row);
    if (item.source === 'automatic') continue;
    if (item.source === 'primary') {
      if (row.title === 0) {
        outcome.findings.push(
          finding({
            ruleId: 'keywords.primary-title',
            name: 'Target keyword in title',
            category: 'keywords',
            severity: 'info',
            kind: 'best-practice',
            message: 'The primary keyword does not appear in the title.',
            why: 'The title should describe the page. Exact keyword match is not a ranking requirement.',
            evidence: snapshot.title || '(no title)',
            remediation: 'Mention the topic in the title when it honestly describes the page.',
            highlightId: null,
            selectorHint: 'title',
          }),
        );
      }
      if (row.h1 === 0 && snapshot.headings.some((heading) => heading.level === 1)) {
        outcome.findings.push(
          finding({
            ruleId: 'keywords.primary-h1',
            name: 'Target keyword in H1',
            category: 'keywords',
            severity: 'info',
            kind: 'best-practice',
            message: 'The primary keyword does not appear in an H1.',
            why: 'The H1 should state the page topic. It does not need to repeat the title word for word.',
            evidence: h1 || '(no H1 text)',
            remediation: 'Align the H1 with the page topic in natural language.',
            highlightId: snapshot.headings.find((heading) => heading.level === 1)?.highlightId ?? null,
            selectorHint: 'h1',
          }),
        );
      }
      if (row.content === 0 && analyzedWords > 0) {
        outcome.findings.push(
          finding({
            ruleId: 'keywords.primary-content',
            name: 'Target keyword in content',
            category: 'keywords',
            severity: 'info',
            kind: 'best-practice',
            message: 'The primary keyword does not appear in the analyzed text.',
            why: 'The analyzed text is a conservative extract, not a perfect main-content detector.',
            evidence: `Analyzed words: ${analyzedWords}. Source: ${snapshot.content.source}.`,
            remediation: 'Use the topic in the body where it helps the reader. Do not add it only to raise a count.',
            highlightId: null,
            selectorHint: null,
          }),
        );
      }
      if (row.occurrences >= PHRASE_REPEAT || (analyzedWords >= 200 && row.frequency >= 0.05 && wordsOf(item.keyword).length === 1)) {
        outcome.findings.push(
          finding({
            ruleId: 'keywords.repetition',
            name: 'Repeated exact phrase',
            category: 'keywords',
            severity: 'info',
            kind: 'optional',
            message: `"${item.keyword}" appears ${row.occurrences} times in the analyzed text. This is not a density target and it is not keyword stuffing by itself.`,
            why: 'Unnatural repetition is a writing problem. A percentage of words is not a Google ranking factor this tool can score.',
            evidence: `Occurrences ${row.occurrences}; analyzed words ${analyzedWords}.`,
            remediation: 'Read the page aloud. Vary the wording if the repetition does not help the reader.',
            highlightId: null,
            selectorHint: null,
          }),
        );
      }
    }
  }

  const h1Text = normalizeText(h1);
  const titleText = normalizeText(snapshot.title);
  if (h1Text && titleText && !h1Text.includes(titleText) && !titleText.includes(h1Text) && wordsOf(snapshot.title).length > 2) {
    const shared = wordsOf(snapshot.title).filter((word) => word.length > 3 && h1Text.includes(word));
    if (shared.length === 0) {
      outcome.findings.push(
        finding({
          ruleId: 'keywords.title-h1-alignment',
          name: 'Title and H1 alignment',
          category: 'keywords',
          severity: 'info',
          kind: 'optional',
          message: 'The title and H1 do not share a distinctive word.',
          why: 'They can differ on purpose. A large gap can mean the page topic is unclear.',
          evidence: `Title: ${snapshot.title}. H1: ${h1}`,
          remediation: 'Make sure both tell a visitor what the page is about.',
          highlightId: snapshot.headings.find((heading) => heading.level === 1)?.highlightId ?? null,
          selectorHint: 'h1',
        }),
      );
    }
  }

  return {
    report: {
      analyzedWords,
      textSource:
        snapshot.content.source === 'main'
          ? 'Text inside main was analyzed. Navigation and footer inside main were left out.'
          : 'No main element was found. Body text outside navigation, footer, and aside was analyzed.',
      truncated: snapshot.content.truncated,
      includedText: snapshot.content.includedText,
      rows,
      notes: [
        'Frequency is occurrences divided by analyzed words. It is not a ranking factor and it is not a target to hit.',
        'Phrases match after lowercasing and after punctuation is treated as a space. A match must start and end on a word boundary.',
        'Hidden text, scripts, styles, form controls, and SVG were not included.',
      ],
    },
    outcome,
  };
}

function buildRow(
  snapshot: PageSnapshot,
  keyword: string,
  source: KeywordRow['source'],
  description: string,
  h1: string,
  headingText: string,
  altText: string,
  anchorText: string,
  analyzedWords: number,
): KeywordRow {
  const content = countPhrase(snapshot.content.includedText, keyword);
  const snippets: KeywordSnippet[] = [];
  const needle = normalizeText(keyword);
  if (needle && content > 0) {
    const text = snapshot.content.includedText;
    const lower = text.toLowerCase();
    const at = lower.indexOf(needle);
    if (at >= 0) {
      const start = Math.max(0, at - 40);
      snippets.push({
        where: 'content',
        text: text.slice(start, at + needle.length + 40),
        highlightId: null,
      });
    }
  }
  return {
    keyword,
    source,
    occurrences: content,
    frequency: analyzedWords > 0 ? content / analyzedWords : 0,
    title: countPhrase(snapshot.title, keyword),
    description: countPhrase(description, keyword),
    h1: countPhrase(h1, keyword),
    headings: countPhrase(headingText, keyword),
    content,
    alt: countPhrase(altText, keyword),
    anchors: countPhrase(anchorText, keyword),
    url: countPhrase(snapshot.url, keyword),
    snippets,
  };
}
