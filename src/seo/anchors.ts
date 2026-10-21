import type { AnchorEntry, PageSnapshot } from '../shared/types';
import { finding } from './finding';
import type { RuleOutcome } from './types';

const GENERIC = new Set(['click here', 'here', 'read more', 'learn more', 'more', 'this', 'link', 'continue', 'details']);

export function evaluateAnchors(snapshot: PageSnapshot): RuleOutcome {
  const findings = [];
  const idSet = new Set(snapshot.ids);
  let nofollow = 0;
  let sponsored = 0;
  let ugc = 0;
  for (const anchor of snapshot.anchors) {
    if (anchor.hidden) continue;
    const rels = new Set(anchor.rel.split(/\s+/).filter(Boolean));
    if (rels.has('nofollow')) nofollow += 1;
    if (rels.has('sponsored')) sponsored += 1;
    if (rels.has('ugc')) ugc += 1;
    const name = anchor.text || anchor.imageAlt;
    if (!name && anchor.className !== 'empty') {
      findings.push(anchorFinding(anchor, 'links.unnamed', 'Link without an accessible name', 'warning', 'accessibility', 'This link has no visible text and no image alt text.', 'People using assistive technology cannot tell where the link goes.', anchor.href || anchor.selectorHint, 'Add link text, or alt text on the image inside the link.'));
    }
    if (anchor.className === 'empty' || (anchor.href.trim() === '' && !name)) {
      findings.push(anchorFinding(anchor, 'links.empty-destination', 'Empty link destination', 'warning', 'technical', 'This anchor has an empty href.', 'An empty destination does not navigate.', anchor.selectorHint, 'Point the link at a URL or remove it.'));
    }
    if (anchor.className === 'malformed') {
      findings.push(anchorFinding(anchor, 'links.malformed', 'Malformed link', 'warning', 'technical', 'This href could not be parsed as a URL.', 'The destination is not a usable URL. It was not requested, so it is not labeled broken.', anchor.href, 'Replace the href with a valid URL.'));
    }
    if (name && GENERIC.has(name.toLowerCase())) {
      findings.push(anchorFinding(anchor, 'links.generic', 'Generic anchor text', 'info', 'best-practice', `Anchor text is "${name}".`, 'Generic text is weak out of context. It is not a ranking penalty.', anchor.href, 'Use text that describes the destination.'));
    }
    if (anchor.className === 'fragment') {
      const id = fragmentId(anchor.href, snapshot.url);
      if (id && !idSet.has(id)) {
        findings.push(
          anchorFinding(
            anchor,
            'links.missing-fragment',
            'Fragment target not in the DOM',
            'warning',
            'technical',
            snapshot.caps.idsTruncated
              ? `No collected id matches #${id}. The id list was capped, so the target might exist beyond the sample.`
              : `No element on this page has id "${id}".`,
            'The link was not followed. A missing id only refers to the current DOM.',
            anchor.href,
            'Add the target element or change the fragment.',
          ),
        );
      }
    }
    if (anchor.target === '_blank' && !rels.has('noopener') && !rels.has('noreferrer')) {
      findings.push(anchorFinding(anchor, 'links.blank-rel', 'New tab without rel protection', 'info', 'best-practice', 'target=_blank is set without rel=noopener or rel=noreferrer.', 'This is a browsing-context concern, not a search-ranking error. nofollow, sponsored, and ugc are separate and are not required here.', anchor.href, 'Add rel="noopener" when opening a new tab.'));
    }
  }
  if (nofollow + sponsored + ugc > 0) {
    findings.push(
      finding({
        ruleId: 'links.rel-qualifiers',
        name: 'Qualified links',
        category: 'links',
        severity: 'info',
        kind: 'optional',
        message: `Collected links include nofollow (${nofollow}), sponsored (${sponsored}), and ugc (${ugc}). These are not errors.`,
        why: 'nofollow asks crawlers not to treat the link as an endorsement. sponsored and ugc describe the relationship. Google documents them as qualifiers, not problems.',
        evidence: `nofollow ${nofollow}; sponsored ${sponsored}; ugc ${ugc}`,
        remediation: 'Keep the qualifier that matches the link. Do not remove it only to clear this note.',
        highlightId: null,
        selectorHint: null,
        docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links',
      }),
    );
  }
  if (snapshot.caps.anchorsOmitted > 0) {
    findings.push(
      finding({
        ruleId: 'links.capped',
        name: 'Link list capped',
        category: 'links',
        severity: 'info',
        kind: 'technical',
        message: `${snapshot.caps.anchorsOmitted} anchors were not inventoried.`,
        why: 'Omitted links were not marked as passing, and none were fetched.',
        evidence: `Collected ${snapshot.anchors.length}.`,
        remediation: 'Raise maxAnchors for a larger sample.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  return {
    findings,
    passed: [],
    unavailable: [
      { ruleId: 'links.broken', name: 'Broken links', category: 'links', reason: 'Destinations were not requested, so no link is reported as broken.' },
    ],
  };
}

function fragmentId(href: string, pageUrl: string): string {
  if (href.startsWith('#')) return decodeSafe(href.slice(1));
  try {
    return decodeSafe(new URL(href, pageUrl).hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function anchorFinding(
  anchor: AnchorEntry,
  ruleId: string,
  name: string,
  severity: 'warning' | 'info',
  kind: 'technical' | 'accessibility' | 'best-practice' | 'optional',
  message: string,
  why: string,
  evidence: string,
  remediation: string,
): ReturnType<typeof finding> {
  return finding({
    ruleId,
    name,
    category: 'links',
    severity,
    kind,
    message,
    why,
    evidence,
    remediation,
    highlightId: anchor.highlightId,
    selectorHint: anchor.selectorHint,
  });
}
