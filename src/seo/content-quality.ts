import type { PageSnapshot } from '../shared/types';
import { finding, unavailable } from './finding';
import { normalizeText } from './text';
import type { RuleOutcome } from './types';

export function evaluateContent(snapshot: PageSnapshot): RuleOutcome {
  const findings = [];
  const words = snapshot.content.wordCount;
  if (words < 40) {
    findings.push(
      finding({
        ruleId: 'content.thin',
        name: 'Little visible text',
        category: 'content',
        severity: 'info',
        kind: 'optional',
        message: `About ${words} words of visible text were analyzed. There is no universal minimum word count.`,
        why: 'Some useful pages are short. This note only says the extract is small. It does not judge quality, expertise, or originality.',
        evidence: snapshot.content.source === 'main' ? 'Source: main element.' : 'Source: body outside navigation, footer, and aside.',
        remediation: 'Add the explanation a visitor needs. Do not add words only to clear this note.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  if (snapshot.content.truncated) {
    findings.push(
      finding({
        ruleId: 'content.truncated',
        name: 'Analyzed text truncated',
        category: 'content',
        severity: 'info',
        kind: 'technical',
        message: 'Visible text was longer than the analysis limit. Counts use the retained prefix only.',
        why: 'The omitted tail is not described as analyzed.',
        evidence: `Retained ${snapshot.content.includedText.length} characters of about ${snapshot.content.originalLength}.`,
        remediation: 'Raise maxContentChars if you need a longer extract.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  const repeats = new Map<string, number>();
  for (const paragraph of snapshot.content.paragraphs) {
    const key = normalizeText(paragraph);
    if (key.length < 80) continue;
    repeats.set(key, (repeats.get(key) ?? 0) + 1);
  }
  for (const [text, count] of repeats) {
    if (count < 3) continue;
    findings.push(
      finding({
        ruleId: 'content.repeated-paragraph',
        name: 'Repeated paragraph',
        category: 'content',
        severity: 'info',
        kind: 'optional',
        message: `The same paragraph appears ${count} times in the collected text.`,
        why: 'Repetition can be a template or an accidental duplicate. This is a heuristic, not a plagiarism check.',
        evidence: text.slice(0, 180),
        remediation: 'Keep one copy unless the repetition helps the reader.',
        highlightId: null,
        selectorHint: null,
      }),
    );
    break;
  }
  if (snapshot.counts.paragraphs === 0 && words > 0) {
    findings.push(
      finding({
        ruleId: 'content.no-paragraphs',
        name: 'No paragraphs',
        category: 'content',
        severity: 'info',
        kind: 'optional',
        message: 'No paragraph elements were found in the analyzed region.',
        why: 'Text can live in other elements. This is not a quality score.',
        evidence: `${words} words; ${snapshot.counts.lists} lists; ${snapshot.counts.tables} tables.`,
        remediation: 'Use paragraphs when the text is prose.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  return {
    findings,
    passed: words >= 40 ? [{ ruleId: 'content.word-count', name: 'Visible text', category: 'content', summary: `${words} analyzed words. This is not a quality score.` }] : [],
    unavailable: [
      unavailable({
        ruleId: 'content.quality',
        name: 'Content quality',
        category: 'content',
        reason: 'Factual accuracy, originality across the web, expertise, and search intent cannot be judged from one page.',
      }),
    ],
  };
}
