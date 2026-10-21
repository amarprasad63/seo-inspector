import type { PageSnapshot } from '../shared/types';
import { finding, passed } from './finding';
import { hasEdgeWhitespace, looksRepetitive, normalizeText } from './text';
import type { KeywordTargets, RuleOutcome } from './types';

const TITLE_DOCS = 'https://developers.google.com/search/docs/appearance/title-link';
const SNIPPET_DOCS = 'https://developers.google.com/search/docs/appearance/snippet';

/** Display guidance only. Truncation depends on width, not a fixed Google limit. */
export const TITLE_GUIDANCE = { min: 15, max: 60 };
export const DESCRIPTION_GUIDANCE = { min: 50, max: 160 };

export function metaValues(snapshot: PageSnapshot, kind: PageSnapshot['metas'][number]['kind'], key: string): string[] {
  return snapshot.metas.filter((meta) => meta.kind === kind && meta.key === key).map((meta) => meta.content);
}

export function evaluateMetadata(snapshot: PageSnapshot, targets: KeywordTargets): RuleOutcome {
  const findings = [];
  const passedChecks = [];
  const title = snapshot.title;
  const descriptions = metaValues(snapshot, 'name', 'description');
  const description = descriptions[0] ?? '';
  const primary = normalizeText(targets.primary);

  if (snapshot.titleCount === 0 || !title.trim()) {
    findings.push(
      finding({
        ruleId: 'metadata.title-missing',
        name: 'Missing title',
        category: 'metadata',
        severity: 'error',
        kind: 'technical',
        message: title.trim() ? 'The document title is empty.' : 'This document has no title.',
        why: 'The title is often used as the link text in search results. Google may rewrite it from other on-page text.',
        evidence: title ? JSON.stringify(title) : `title elements: ${snapshot.titleCount}`,
        remediation: 'Add one descriptive title element.',
        highlightId: null,
        selectorHint: 'title',
        docsUrl: TITLE_DOCS,
      }),
    );
  } else {
    passedChecks.push(passed({ ruleId: 'metadata.title-present', name: 'Title', category: 'metadata', summary: `Title has ${title.trim().length} characters.` }));
    if (hasEdgeWhitespace(title)) {
      findings.push(whitespaceFinding('metadata.title-whitespace', 'Title whitespace', JSON.stringify(title)));
    }
    if (title.trim().length < TITLE_GUIDANCE.min || title.trim().length > TITLE_GUIDANCE.max) {
      findings.push(
        finding({
          ruleId: 'metadata.title-length',
          name: 'Title length guidance',
          category: 'metadata',
          severity: 'info',
          kind: 'optional',
          message: `The title is ${title.trim().length} characters. A comfortable display range for many results is about ${TITLE_GUIDANCE.min}–${TITLE_GUIDANCE.max} characters.`,
          why: 'Search results truncate by rendered width, device, and query. A character count is not a ranking requirement.',
          evidence: title.trim(),
          remediation: 'Write a specific title. Do not pad or cut it only to hit a character count.',
          highlightId: null,
          selectorHint: 'title',
          docsUrl: TITLE_DOCS,
        }),
      );
    }
    if (looksRepetitive(title)) {
      findings.push(repetitionFinding('metadata.title-repetition', 'Repetitive title', title.trim()));
    }
    if (primary && !normalizeText(title).includes(primary)) {
      findings.push(keywordMissing('metadata.title-keyword', 'Title and target keyword', 'title', title.trim()));
    }
  }

  if (snapshot.titleCount > 1) {
    findings.push(
      finding({
        ruleId: 'metadata.title-duplicate',
        name: 'Repeated title elements',
        category: 'metadata',
        severity: 'warning',
        kind: 'technical',
        message: `This document has ${snapshot.titleCount} title elements.`,
        why: 'Browsers use one title. Extra title elements make the intended value ambiguous.',
        evidence: `title count ${snapshot.titleCount}`,
        remediation: 'Keep a single title element.',
        highlightId: null,
        selectorHint: 'title',
        docsUrl: TITLE_DOCS,
      }),
    );
  }

  if (descriptions.length === 0) {
    findings.push(
      finding({
        ruleId: 'metadata.description-missing',
        name: 'Missing meta description',
        category: 'metadata',
        severity: 'warning',
        kind: 'best-practice',
        message: 'The page has no meta description.',
        why: 'Search engines may generate a snippet from page content. A description is a hint, not a ranking guarantee.',
        evidence: 'No meta[name=description].',
        remediation: 'Add a meta description that summarizes the page in plain language.',
        highlightId: null,
        selectorHint: 'meta[name=description]',
        docsUrl: SNIPPET_DOCS,
      }),
    );
  } else if (!description.trim()) {
    findings.push(
      finding({
        ruleId: 'metadata.description-empty',
        name: 'Empty meta description',
        category: 'metadata',
        severity: 'warning',
        kind: 'technical',
        message: 'The meta description is empty.',
        why: 'An empty description does not give a snippet hint.',
        evidence: JSON.stringify(description),
        remediation: 'Add a short summary or remove the empty tag.',
        highlightId: null,
        selectorHint: 'meta[name=description]',
        docsUrl: SNIPPET_DOCS,
      }),
    );
  } else {
    passedChecks.push(
      passed({
        ruleId: 'metadata.description-present',
        name: 'Meta description',
        category: 'metadata',
        summary: `Description has ${description.trim().length} characters.`,
      }),
    );
    if (hasEdgeWhitespace(description)) findings.push(whitespaceFinding('metadata.description-whitespace', 'Description whitespace', JSON.stringify(description)));
    if (description.trim().length < DESCRIPTION_GUIDANCE.min || description.trim().length > DESCRIPTION_GUIDANCE.max) {
      findings.push(
        finding({
          ruleId: 'metadata.description-length',
          name: 'Description length guidance',
          category: 'metadata',
          severity: 'info',
          kind: 'optional',
          message: `The meta description is ${description.trim().length} characters. About ${DESCRIPTION_GUIDANCE.min}–${DESCRIPTION_GUIDANCE.max} characters is a display aid, not a Google requirement.`,
          why: 'Snippets are chosen and truncated by the search engine. Length alone does not determine rankings.',
          evidence: description.trim(),
          remediation: 'Describe the page accurately. Do not stuff keywords to reach a length.',
          highlightId: null,
          selectorHint: 'meta[name=description]',
          docsUrl: SNIPPET_DOCS,
        }),
      );
    }
    if (looksRepetitive(description)) findings.push(repetitionFinding('metadata.description-repetition', 'Repetitive description', description.trim()));
    if (primary && !normalizeText(description).includes(primary)) {
      findings.push(keywordMissing('metadata.description-keyword', 'Description and target keyword', 'meta description', description.trim()));
    }
  }

  if (descriptions.length > 1) {
    const unique = new Set(descriptions.map((value) => value.trim()));
    findings.push(
      finding({
        ruleId: 'metadata.description-duplicate',
        name: 'Repeated meta descriptions',
        category: 'metadata',
        severity: 'warning',
        kind: 'technical',
        message: `This document has ${descriptions.length} meta description tags${unique.size > 1 ? ' and the values differ.' : '.'}`,
        why: 'Crawlers may use any of the values. Conflicting descriptions make the preferred snippet unclear.',
        evidence: descriptions.map((value, index) => `${index + 1}. ${value || '(empty)'}`).join(' | ').slice(0, 240),
        remediation: 'Keep one meta description.',
        highlightId: null,
        selectorHint: 'meta[name=description]',
        docsUrl: SNIPPET_DOCS,
      }),
    );
  }

  const keywords = metaValues(snapshot, 'name', 'keywords');
  if (keywords.length > 0) {
    findings.push(
      finding({
        ruleId: 'metadata.keywords-tag',
        name: 'Meta keywords',
        category: 'metadata',
        severity: 'info',
        kind: 'optional',
        message: 'A meta keywords tag is present. It is not used as the keyword source for this audit.',
        why: 'Google has said it does not use the keywords meta tag for ranking.',
        evidence: keywords[0]?.slice(0, 180) || '(empty)',
        remediation: 'You can leave the tag out. Put the topic in the title, headings, and body instead.',
        highlightId: null,
        selectorHint: 'meta[name=keywords]',
        docsUrl: 'https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag',
      }),
    );
  }

  return {
    findings,
    passed: passedChecks,
    unavailable: [
      {
        ruleId: 'metadata.cross-page-duplicates',
        name: 'Cross-page duplicate titles',
        category: 'metadata',
        reason: 'This extension sees one page, so it cannot tell whether the title or description is duplicated elsewhere on the site.',
      },
    ],
  };
}

function whitespaceFinding(ruleId: string, name: string, evidence: string): ReturnType<typeof finding> {
  return finding({
    ruleId,
    name,
    category: 'metadata',
    severity: 'info',
    kind: 'technical',
    message: `${name} has leading or trailing whitespace.`,
    why: 'Extra spaces can show up in snippets or comparisons.',
    evidence,
    remediation: 'Trim the value.',
    highlightId: null,
    selectorHint: null,
  });
}

function repetitionFinding(ruleId: string, name: string, evidence: string): ReturnType<typeof finding> {
  return finding({
    ruleId,
    name,
    category: 'metadata',
    severity: 'info',
    kind: 'optional',
    message: `${name} repeats the same word several times.`,
    why: 'Repetition can look accidental. It is not, by itself, a ranking penalty.',
    evidence,
    remediation: 'Use the wording a person would expect for this page.',
    highlightId: null,
    selectorHint: null,
  });
}

function keywordMissing(ruleId: string, name: string, where: string, evidence: string): ReturnType<typeof finding> {
  return finding({
    ruleId,
    name,
    category: 'keywords',
    severity: 'info',
    kind: 'best-practice',
    message: `The target keyword does not appear in the ${where}.`,
    why: 'Matching a query exactly is not required. The title and description should still make the page topic clear.',
    evidence,
    remediation: `Use the target language naturally in the ${where} when it fits the page.`,
    highlightId: null,
    selectorHint: null,
  });
}
