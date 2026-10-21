import type { HeadingEntry, PageSnapshot } from '../shared/types';
import { finding, passed } from './finding';
import type { HeadingNode, RuleOutcome } from './types';

export function outlineHeadings(headings: readonly HeadingEntry[]): HeadingNode[] {
  const roots: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  for (const heading of headings) {
    const node: HeadingNode = {
      level: heading.level,
      text: heading.text,
      hidden: heading.hidden,
      highlightId: heading.highlightId,
      selectorHint: heading.selectorHint,
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1]!.level >= heading.level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

export function formatOutline(nodes: readonly HeadingNode[], depth = 0): string {
  return nodes
    .map((node) => `${'  '.repeat(depth)}H${node.level}: ${node.text || '(empty)'}${node.hidden ? ' [hidden]' : ''}\n${formatOutline(node.children, depth + 1)}`)
    .join('');
}

export function evaluateHeadings(snapshot: PageSnapshot): { outcome: RuleOutcome; outline: HeadingNode[] } {
  const outline = outlineHeadings(snapshot.headings);
  const findings = [];
  const visible = snapshot.headings.filter((heading) => !heading.hidden);
  const h1s = visible.filter((heading) => heading.level === 1);

  if (snapshot.caps.headingsOmitted > 0) {
    findings.push(
      finding({
        ruleId: 'headings.capped',
        name: 'Heading list capped',
        category: 'headings',
        severity: 'info',
        kind: 'technical',
        message: `${snapshot.caps.headingsOmitted} headings were not collected because the list is capped.`,
        why: 'The audit does not silently treat omitted headings as valid.',
        evidence: `Collected ${snapshot.headings.length}; omitted ${snapshot.caps.headingsOmitted}.`,
        remediation: 'Review the remaining headings on the page. Raise maxHeadings if you need a larger sample.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }

  if (h1s.length === 0) {
    findings.push(
      finding({
        ruleId: 'headings.missing-h1',
        name: 'Missing H1',
        category: 'headings',
        severity: 'warning',
        kind: 'accessibility',
        message: 'No visible H1 was found.',
        why: 'A primary heading helps readers and assistive technology. A missing H1 is not proof of a ranking loss.',
        evidence: `Visible headings: ${visible.length}.`,
        remediation: 'Add a descriptive H1 if the page does not already expose its topic in a heading.',
        highlightId: null,
        selectorHint: 'h1',
      }),
    );
  } else if (h1s.length > 1) {
    findings.push(
      finding({
        ruleId: 'headings.multiple-h1',
        name: 'Multiple H1 elements',
        category: 'headings',
        severity: 'info',
        kind: 'accessibility',
        message: `${h1s.length} visible H1 elements were found. This is not treated as a Google penalty.`,
        why: 'HTML allows more than one H1. One clear primary heading is easier to follow.',
        evidence: h1s.map((heading) => heading.text || '(empty)').join(' | ').slice(0, 240),
        remediation: 'Use a single H1 when the page has one main topic, and use H2 for sections.',
        highlightId: h1s[1]?.highlightId ?? null,
        selectorHint: 'h1',
      }),
    );
  }

  const seen = new Map<string, number>();
  let previousLevel = 0;
  for (const heading of snapshot.headings) {
    if (!heading.text) {
      findings.push(
        finding({
          ruleId: 'headings.empty',
          name: 'Empty heading',
          category: 'headings',
          severity: 'warning',
          kind: 'accessibility',
          message: `H${heading.level} has no text.`,
          why: 'An empty heading is announced by assistive technology without a name.',
          evidence: heading.selectorHint,
          remediation: 'Add text or remove the heading element.',
          highlightId: heading.highlightId,
          selectorHint: heading.selectorHint,
        }),
      );
    } else if (heading.text.length > 120) {
      findings.push(
        finding({
          ruleId: 'headings.long',
          name: 'Long heading',
          category: 'headings',
          severity: 'info',
          kind: 'optional',
          message: `H${heading.level} is ${heading.text.length} characters. Long headings are harder to scan. This is not a length limit from Google.`,
          why: 'Headings work best as labels, not paragraphs.',
          evidence: heading.text.slice(0, 180),
          remediation: 'Shorten the heading and move detail into the section.',
          highlightId: heading.highlightId,
          selectorHint: heading.selectorHint,
        }),
      );
    }
    if (heading.hidden) {
      findings.push(
        finding({
          ruleId: 'headings.hidden',
          name: 'Hidden heading',
          category: 'headings',
          severity: 'info',
          kind: 'optional',
          message: `H${heading.level} is hidden. Hidden headings can be legitimate, or they can exist only to add keywords.`,
          why: 'This check sees the hidden attribute, aria-hidden, or display/visibility. It cannot judge intent.',
          evidence: heading.text || '(empty)',
          remediation: 'Keep a hidden heading only when it names a section for assistive technology.',
          highlightId: heading.highlightId,
          selectorHint: heading.selectorHint,
        }),
      );
    }
    if (!heading.hidden && previousLevel > 0 && heading.level > previousLevel + 1) {
      findings.push(
        finding({
          ruleId: 'headings.skip',
          name: 'Heading level jump',
          category: 'headings',
          severity: 'info',
          kind: 'accessibility',
          message: `Heading level jumps from H${previousLevel} to H${heading.level}.`,
          why: 'Skipped levels make the outline harder to follow. They are not a documented Google penalty.',
          evidence: heading.text || '(empty)',
          remediation: 'Step one level at a time when the sections are nested.',
          highlightId: heading.highlightId,
          selectorHint: heading.selectorHint,
        }),
      );
    }
    if (!heading.hidden) previousLevel = heading.level;
    if (!heading.hidden && heading.text) {
      const key = heading.text.toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  for (const [text, count] of seen) {
    if (count < 3) continue;
    findings.push(
      finding({
        ruleId: 'headings.repeated',
        name: 'Repeated heading',
        category: 'headings',
        severity: 'info',
        kind: 'optional',
        message: `"${text}" is used ${count} times as a visible heading.`,
        why: 'Repeated labels can be real sections, or a sign the outline is not specific.',
        evidence: text,
        remediation: 'Make each heading describe its own section.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }

  const passedChecks = h1s.length === 1 ? [passed({ ruleId: 'headings.single-h1', name: 'H1', category: 'headings', summary: h1s[0]?.text ?? '' })] : [];
  return { outcome: { findings, passed: passedChecks, unavailable: [] }, outline };
}
