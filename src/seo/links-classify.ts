import type { AnchorEntry } from '../shared/types';

export function classifyLink(href: string, pageUrl: string): AnchorEntry['className'] {
  const trimmed = href.trim();
  if (!trimmed) return 'empty';
  if (trimmed.startsWith('#')) return 'fragment';
  if (/^mailto:/i.test(trimmed)) return 'mailto';
  if (/^tel:/i.test(trimmed)) return 'tel';
  let url: URL;
  let page: URL;
  try {
    page = new URL(pageUrl);
    url = new URL(trimmed, pageUrl);
  } catch {
    return 'malformed';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'other';
  if (url.origin === page.origin) {
    if (url.pathname === page.pathname && url.search === page.search && url.hash) return 'fragment';
    return 'internal';
  }
  return 'external';
}

export function sameDocumentUrl(left: string, right: string): boolean | null {
  try {
    const a = new URL(left);
    const b = new URL(right, left);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch {
    return null;
  }
}

const TRACKING = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'igshid',
]);

export function trackingParams(pageUrl: string): string[] {
  try {
    const url = new URL(pageUrl);
    return [...url.searchParams.keys()].filter((key) => TRACKING.has(key.toLowerCase()));
  } catch {
    return [];
  }
}
