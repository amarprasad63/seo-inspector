import type { PageSnapshot } from '../shared/types';
import { finding, passed, unavailable } from './finding';
import { sameDocumentUrl, trackingParams } from './links-classify';
import { metaValues } from './metadata';
import type { RuleOutcome } from './types';

const ROBOTS_DOCS = 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag';
const CANONICAL_DOCS = 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls';
const HREFLANG_DOCS = 'https://developers.google.com/search/docs/specialty/international/localized-versions';

export function evaluateIndexability(snapshot: PageSnapshot): RuleOutcome {
  const findings = [];
  const passedChecks = [];
  const unavailableChecks = [
    unavailable({ ruleId: 'indexability.robots-txt', name: 'robots.txt', category: 'indexability', reason: 'robots.txt was not fetched.' }),
    unavailable({ ruleId: 'indexability.x-robots', name: 'X-Robots-Tag', category: 'indexability', reason: 'Response headers were not read, so X-Robots-Tag is unknown.' }),
    unavailable({ ruleId: 'indexability.redirects', name: 'Redirects', category: 'indexability', reason: 'The redirect chain is not available from the DOM.' }),
    unavailable({ ruleId: 'indexability.indexed', name: 'Indexing status', category: 'indexability', reason: 'A directive in the DOM does not prove whether the URL is indexed.' }),
  ];

  const robotsTags = [
    ...metaValues(snapshot, 'name', 'robots').map((content) => ({ bot: 'robots', content })),
    ...metaValues(snapshot, 'name', 'googlebot').map((content) => ({ bot: 'googlebot', content })),
    ...metaValues(snapshot, 'name', 'bingbot').map((content) => ({ bot: 'bingbot', content })),
  ];
  const directives = robotsTags.flatMap((tag) => parseDirectives(tag.content).map((directive) => ({ ...tag, directive })));
  const names = new Set(directives.map((item) => item.directive));
  if (names.has('noindex') || names.has('none')) {
    findings.push(
      finding({
        ruleId: 'indexability.noindex',
        name: 'noindex directive',
        category: 'indexability',
        severity: 'warning',
        kind: 'technical',
        message: 'A meta robots directive includes noindex or none. That can keep the URL out of search results if crawlers honor it. Actual indexing status is unknown.',
        why: 'noindex is a directive, not a confirmation that the page is absent from the index.',
        evidence: robotsTags.map((tag) => `${tag.bot}: ${tag.content}`).join(' | '),
        remediation: 'Remove noindex only if this URL should be eligible to appear in search.',
        highlightId: null,
        selectorHint: 'meta[name=robots]',
        docsUrl: ROBOTS_DOCS,
      }),
    );
  } else if (robotsTags.length > 0) {
    passedChecks.push(passed({ ruleId: 'indexability.noindex-absent', name: 'noindex', category: 'indexability', summary: 'No noindex or none directive was found in the collected meta tags.' }));
  }
  if (names.has('nofollow') || names.has('none')) {
    findings.push(
      finding({
        ruleId: 'indexability.nofollow',
        name: 'nofollow directive',
        category: 'indexability',
        severity: 'info',
        kind: 'technical',
        message: 'A meta robots directive includes nofollow or none.',
        why: 'This asks crawlers not to follow links on the page. It does not by itself say the page is excluded.',
        evidence: robotsTags.map((tag) => `${tag.bot}: ${tag.content}`).join(' | '),
        remediation: 'Keep it only when links on this page should not be followed.',
        highlightId: null,
        selectorHint: 'meta[name=robots]',
        docsUrl: ROBOTS_DOCS,
      }),
    );
  }
  if ((names.has('noindex') && names.has('index')) || (names.has('nofollow') && names.has('follow')) || (names.has('none') && (names.has('index') || names.has('follow')))) {
    findings.push(
      finding({
        ruleId: 'indexability.robots-conflict',
        name: 'Conflicting robots directives',
        category: 'indexability',
        severity: 'warning',
        kind: 'technical',
        message: 'Robots directives conflict, such as index and noindex together.',
        why: 'Crawlers need one instruction. Conflicting tags make the intended rule unclear.',
        evidence: robotsTags.map((tag) => `${tag.bot}: ${tag.content}`).join(' | '),
        remediation: 'Keep one consistent robots directive.',
        highlightId: null,
        selectorHint: 'meta[name=robots]',
        docsUrl: ROBOTS_DOCS,
      }),
    );
  }
  const extra = [...names].filter((name) => ['noarchive', 'nosnippet', 'max-snippet', 'max-image-preview', 'max-video-preview', 'notranslate', 'unavailable_after'].some((token) => name === token || name.startsWith(`${token}:`)));
  if (extra.length > 0) {
    findings.push(
      finding({
        ruleId: 'indexability.robots-extra',
        name: 'Additional robots directives',
        category: 'indexability',
        severity: 'info',
        kind: 'optional',
        message: `Additional directives are present: ${extra.join(', ')}.`,
        why: 'These change snippets or caching. They are reported so they are visible, not because they are mistakes.',
        evidence: extra.join(', '),
        remediation: 'Leave them in place when they match the page policy.',
        highlightId: null,
        selectorHint: null,
        docsUrl: ROBOTS_DOCS,
      }),
    );
  }

  const canonicals = snapshot.headLinks.filter((link) => link.rel.split(/\s+/).includes('canonical'));
  if (canonicals.length === 0) {
    findings.push(
      finding({
        ruleId: 'indexability.canonical-missing',
        name: 'Missing canonical',
        category: 'indexability',
        severity: 'info',
        kind: 'best-practice',
        message: 'No canonical link was found.',
        why: 'A canonical is a hint for duplicate URLs. Many unique pages omit it without being errors.',
        evidence: 'No link[rel=canonical].',
        remediation: 'Add a canonical when this URL has duplicates or tracking parameters.',
        highlightId: null,
        selectorHint: 'link[rel=canonical]',
        docsUrl: CANONICAL_DOCS,
      }),
    );
  } else if (canonicals.length > 1) {
    findings.push(
      finding({
        ruleId: 'indexability.canonical-multiple',
        name: 'Multiple canonicals',
        category: 'indexability',
        severity: 'warning',
        kind: 'technical',
        message: `${canonicals.length} canonical links were found.`,
        why: 'More than one canonical makes the preferred URL ambiguous.',
        evidence: canonicals.map((link) => link.href || '(empty)').join(' | ').slice(0, 240),
        remediation: 'Keep one canonical.',
        highlightId: null,
        selectorHint: 'link[rel=canonical]',
        docsUrl: CANONICAL_DOCS,
      }),
    );
  }
  for (const link of canonicals) {
    if (!link.href.trim()) {
      findings.push(canonicalIssue('indexability.canonical-empty', 'Empty canonical', 'The canonical href is empty.', link.href));
    } else if (isRelative(link.href)) {
      findings.push(canonicalIssue('indexability.canonical-relative', 'Relative canonical', 'The canonical URL is relative. An absolute URL is easier for crawlers to interpret.', link.href));
    } else {
      try {
        const absolute = new URL(link.href, snapshot.url).href;
        if (sameDocumentUrl(absolute, snapshot.url) === false) {
          findings.push(
            finding({
              ruleId: 'indexability.canonical-mismatch',
              name: 'Canonical differs from this URL',
              category: 'indexability',
              severity: 'info',
              kind: 'best-practice',
              message: 'The canonical URL is different from the current page URL. That can be intentional.',
              why: 'Canonicals exist to point duplicates at a preferred URL. A difference is not automatically wrong.',
              evidence: `${snapshot.url} → ${link.href}`,
              remediation: 'Confirm the canonical is the URL that should represent this page.',
              highlightId: null,
              selectorHint: 'link[rel=canonical]',
              docsUrl: CANONICAL_DOCS,
            }),
          );
        } else if (canonicals.length === 1) {
          passedChecks.push(passed({ ruleId: 'indexability.canonical-self', name: 'Canonical', category: 'indexability', summary: link.href }));
        }
      } catch {
        findings.push(canonicalIssue('indexability.canonical-invalid', 'Invalid canonical', 'The canonical href is not a valid URL.', link.href));
      }
    }
  }

  const refresh = snapshot.metas.find((meta) => meta.kind === 'http-equiv' && meta.key === 'refresh');
  if (refresh) {
    findings.push(
      finding({
        ruleId: 'indexability.meta-refresh',
        name: 'Meta refresh',
        category: 'indexability',
        severity: 'warning',
        kind: 'technical',
        message: 'A meta refresh directive is present.',
        why: 'Refresh redirects are harder to follow than an HTTP redirect. This extension did not execute the refresh.',
        evidence: refresh.content,
        remediation: 'Prefer a server redirect when a move is permanent.',
        highlightId: null,
        selectorHint: 'meta[http-equiv=refresh]',
      }),
    );
  }

  const hreflang = snapshot.headLinks.filter((link) => link.rel.split(/\s+/).includes('alternate') && link.hreflang);
  const byLang = new Map<string, string[]>();
  for (const link of hreflang) {
    const lang = (link.hreflang ?? '').trim().toLowerCase();
    const list = byLang.get(lang) ?? [];
    list.push(link.href);
    byLang.set(lang, list);
    if (lang !== 'x-default' && !/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(link.hreflang ?? '')) {
      findings.push(
        finding({
          ruleId: 'indexability.hreflang-invalid',
          name: 'Invalid hreflang',
          category: 'indexability',
          severity: 'warning',
          kind: 'technical',
          message: `hreflang "${link.hreflang}" does not look like a language code or x-default.`,
          why: 'Crawlers expect language or language-region codes.',
          evidence: link.href,
          remediation: 'Use a code such as en or en-IN, or x-default.',
          highlightId: null,
          selectorHint: 'link[rel=alternate]',
          docsUrl: HREFLANG_DOCS,
        }),
      );
    }
  }
  for (const [lang, hrefs] of byLang) {
    if (new Set(hrefs).size > 1) {
      findings.push(
        finding({
          ruleId: 'indexability.hreflang-conflict',
          name: 'Conflicting hreflang',
          category: 'indexability',
          severity: 'warning',
          kind: 'technical',
          message: `hreflang ${lang} points at more than one URL.`,
          why: 'One language should map to one URL in this document.',
          evidence: hrefs.join(' | ').slice(0, 240),
          remediation: 'Keep one alternate URL per language.',
          highlightId: null,
          selectorHint: null,
          docsUrl: HREFLANG_DOCS,
        }),
      );
    }
  }
  if (hreflang.length > 0) {
    unavailableChecks.push(
      unavailable({
        ruleId: 'indexability.hreflang-return',
        name: 'hreflang return links',
        category: 'indexability',
        reason: 'Other language URLs were not fetched, so return links and self-references on those pages were not verified.',
      }),
    );
  }

  const tracked = trackingParams(snapshot.url);
  if (tracked.length > 0) {
    findings.push(
      finding({
        ruleId: 'indexability.tracking-params',
        name: 'Tracking parameters',
        category: 'indexability',
        severity: 'info',
        kind: 'optional',
        message: `This URL includes tracking parameters (${tracked.join(', ')}). That is not a ranking penalty.`,
        why: 'Parameters can create duplicate URLs. A canonical can declare the preferred one.',
        evidence: snapshot.url,
        remediation: 'Canonicalize to the URL you want indexed if these parameters are not meaningful content.',
        highlightId: null,
        selectorHint: null,
        docsUrl: CANONICAL_DOCS,
      }),
    );
  }

  if (snapshot.url.startsWith('http://')) {
    findings.push(
      finding({
        ruleId: 'indexability.http',
        name: 'HTTP page',
        category: 'indexability',
        severity: 'info',
        kind: 'best-practice',
        message: 'This page was loaded over HTTP.',
        why: 'HTTPS protects visitors. This check does not know whether HTTPS is also offered.',
        evidence: snapshot.url,
        remediation: 'Serve the page over HTTPS when the site supports it.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }

  return { findings, passed: passedChecks, unavailable: unavailableChecks };
}

function parseDirectives(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isRelative(value: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

function canonicalIssue(ruleId: string, name: string, message: string, evidence: string): ReturnType<typeof finding> {
  return finding({
    ruleId,
    name,
    category: 'indexability',
    severity: 'warning',
    kind: 'technical',
    message,
    why: 'Crawlers use the canonical as a preferred-URL hint.',
    evidence: evidence || '(empty)',
    remediation: 'Use one absolute canonical URL.',
    highlightId: null,
    selectorHint: 'link[rel=canonical]',
    docsUrl: CANONICAL_DOCS,
  });
}
