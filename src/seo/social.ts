import type { PageSnapshot } from '../shared/types';
import { finding, passed } from './finding';
import { metaValues } from './metadata';
import { sameDocumentUrl } from './links-classify';
import type { RuleOutcome, SocialPreview } from './types';

const OG_CORE = ['og:title', 'og:description', 'og:type', 'og:url', 'og:image'] as const;

export function groupProperties(snapshot: PageSnapshot, prefix: 'og:' | 'twitter:'): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const meta of snapshot.metas) {
    if (meta.kind !== 'property' && meta.kind !== 'name') continue;
    if (!meta.key.startsWith(prefix)) continue;
    const list = grouped[meta.key] ?? [];
    list.push(meta.content);
    grouped[meta.key] = list;
  }
  return grouped;
}

export function evaluateSocial(snapshot: PageSnapshot): { outcome: RuleOutcome; openGraph: Record<string, string[]>; twitter: Record<string, string[]>; preview: SocialPreview } {
  const openGraph = groupProperties(snapshot, 'og:');
  const twitter = groupProperties(snapshot, 'twitter:');
  const findings = [];
  const passedChecks = [];
  const description = metaValues(snapshot, 'name', 'description')[0] ?? '';
  const canonical = snapshot.headLinks.find((link) => link.rel.split(/\s+/).includes('canonical'))?.href ?? '';

  for (const key of OG_CORE) {
    const values = openGraph[key] ?? [];
    if (values.length === 0) {
      findings.push(
        finding({
          ruleId: `social.missing-${key}`,
          name: `Missing ${key}`,
          category: 'social',
          severity: 'warning',
          kind: 'best-practice',
          message: `${key} is not declared.`,
          why: 'Social platforms often use Open Graph when someone shares the URL. Google Search does not require these tags for ranking.',
          evidence: `No meta property ${key}.`,
          remediation: `Add ${key} if this page is meant to be shared.`,
          highlightId: null,
          selectorHint: `meta[property="${key}"]`,
          docsUrl: 'https://ogp.me/',
        }),
      );
    } else if (!values.some((value) => value.trim())) {
      findings.push(emptySocial(key, values[0] ?? ''));
    } else {
      passedChecks.push(passed({ ruleId: `social.present-${key}`, name: key, category: 'social', summary: values[0]?.trim().slice(0, 120) ?? '' }));
    }
    if (new Set(values.map((value) => value.trim()).filter(Boolean)).size > 1) {
      findings.push(conflict(key, values));
    }
  }

  for (const key of ['og:url', 'og:image', 'og:video', 'og:audio'] as const) {
    for (const value of openGraph[key] ?? []) {
      if (!value.trim()) continue;
      if (isRelative(value)) {
        findings.push(relativeUrl(key, value));
      } else if (!isHttpUrl(value)) {
        findings.push(badUrl(key, value));
      }
    }
  }

  const ogTitle = openGraph['og:title']?.[0]?.trim() ?? '';
  if (ogTitle && snapshot.title.trim() && ogTitle !== snapshot.title.trim()) {
    findings.push(inconsistent('social.title-og', 'Title and og:title differ', snapshot.title.trim(), ogTitle));
  }
  const ogDescription = openGraph['og:description']?.[0]?.trim() ?? '';
  if (ogDescription && description.trim() && ogDescription !== description.trim()) {
    findings.push(inconsistent('social.description-og', 'Description and og:description differ', description.trim(), ogDescription));
  }
  const ogUrl = openGraph['og:url']?.[0]?.trim() ?? '';
  if (ogUrl && canonical && sameDocumentUrl(snapshot.url, ogUrl) != null && sameDocumentUrl(snapshot.url, canonical) != null) {
    try {
      const ogAbsolute = new URL(ogUrl, snapshot.url).href;
      const canonicalAbsolute = new URL(canonical, snapshot.url).href;
      if (ogAbsolute.replace(/#.*$/, '') !== canonicalAbsolute.replace(/#.*$/, '')) {
        findings.push(
          finding({
            ruleId: 'social.og-url-canonical',
            name: 'og:url and canonical',
            category: 'social',
            severity: 'info',
            kind: 'best-practice',
            message: 'og:url and the canonical URL are different. Confirm that is intentional.',
            why: 'They answer different questions. A mismatch is not automatically wrong.',
            evidence: `og:url ${ogUrl}; canonical ${canonical}`,
            remediation: 'Use the URL you want shared, and the canonical you want indexed, on purpose.',
            highlightId: null,
            selectorHint: 'meta[property="og:url"]',
            docsUrl: 'https://ogp.me/',
          }),
        );
      }
    } catch {
      findings.push(badUrl('og:url', ogUrl));
    }
  }

  const ogImage = openGraph['og:image']?.find((value) => value.trim()) ?? '';
  if (ogImage && isHttpUrl(ogImage)) {
    const matched = snapshot.images.some((image) => {
      try {
        return new URL(image.src, snapshot.url).href === new URL(ogImage, snapshot.url).href;
      } catch {
        return false;
      }
    });
    if (!matched) {
      findings.push(
        finding({
          ruleId: 'social.og-image-dom',
          name: 'Open Graph image in the DOM',
          category: 'social',
          severity: 'info',
          kind: 'optional',
          message: snapshot.caps.imagesOmitted
            ? 'No collected img uses the og:image URL. The image list was capped, and the image was not fetched.'
            : 'No img on this page uses the og:image URL. The image was not fetched, so this does not mean it is missing.',
          why: 'Social images are often not the same file as an on-page image.',
          evidence: ogImage,
          remediation: 'Open the image URL yourself if you need to confirm that it loads.',
          highlightId: null,
          selectorHint: null,
        }),
      );
    }
  }
  if (ogImage && (!openGraph['og:image:width'] || !openGraph['og:image:height'])) {
    findings.push(
      finding({
        ruleId: 'social.og-image-dimensions-unknown',
        name: 'Open Graph image dimensions',
        category: 'social',
        severity: 'info',
        kind: 'optional',
        message: 'og:image width or height is not declared. Dimensions were not measured with a network request.',
        why: 'Some platforms use declared dimensions. Unknown is not the same as invalid.',
        evidence: `width: ${openGraph['og:image:width']?.[0] ?? 'unknown'}; height: ${openGraph['og:image:height']?.[0] ?? 'unknown'}`,
        remediation: 'Declare og:image:width and og:image:height if you know the pixel size.',
        highlightId: null,
        selectorHint: null,
        docsUrl: 'https://ogp.me/',
      }),
    );
  }

  const card = twitter['twitter:card']?.[0]?.trim() ?? '';
  if (!card) {
    findings.push(
      finding({
        ruleId: 'social.twitter-missing',
        name: 'Twitter card',
        category: 'social',
        severity: 'info',
        kind: 'optional',
        message: openGraph['og:title']
          ? 'No twitter:card tag. Platforms that still read cards may fall back to Open Graph title, description, and image.'
          : 'No twitter:card tag, and Open Graph title is also missing. A share may show only the URL.',
        why: 'Missing Twitter-specific tags are not a search-ranking failure. Card support changes by platform.',
        evidence: 'No twitter:card.',
        remediation: 'Add twitter:card if you want a card, or rely on Open Graph where the platform falls back.',
        highlightId: null,
        selectorHint: 'meta[name="twitter:card"]',
      }),
    );
  } else if (!['summary', 'summary_large_image', 'app', 'player'].includes(card)) {
    findings.push(
      finding({
        ruleId: 'social.twitter-card-unknown',
        name: 'Unrecognized twitter:card',
        category: 'social',
        severity: 'warning',
        kind: 'technical',
        message: `twitter:card is "${card}", which is not one of summary, summary_large_image, app, or player.`,
        why: 'An unrecognized card type may be ignored.',
        evidence: card,
        remediation: 'Use a card type the platform documents.',
        highlightId: null,
        selectorHint: 'meta[name="twitter:card"]',
      }),
    );
  }
  if ((card === 'summary_large_image' || card === 'summary') && !twitter['twitter:image'] && !openGraph['og:image']) {
    findings.push(
      finding({
        ruleId: 'social.twitter-image',
        name: 'Card image',
        category: 'social',
        severity: 'warning',
        kind: 'best-practice',
        message: 'This card type has no twitter:image and no og:image.',
        why: 'A large card usually expects an image. The image was not fetched.',
        evidence: card,
        remediation: 'Add an absolute image URL.',
        highlightId: null,
        selectorHint: null,
      }),
    );
  }
  if (card === 'player' && !(twitter['twitter:player'] ?? []).some((value) => value.trim())) {
    findings.push(emptySocial('twitter:player', ''));
  }
  for (const key of ['twitter:title', 'twitter:description', 'twitter:image'] as const) {
    const values = twitter[key] ?? [];
    if (new Set(values.map((value) => value.trim()).filter(Boolean)).size > 1) findings.push(conflict(key, values));
    for (const value of values) {
      if (key === 'twitter:image' && value.trim() && isRelative(value)) findings.push(relativeUrl(key, value));
    }
  }
  const twitterTitle = twitter['twitter:title']?.[0]?.trim() ?? '';
  if (twitterTitle && ogTitle && twitterTitle !== ogTitle) {
    findings.push(inconsistent('social.title-twitter', 'og:title and twitter:title differ', ogTitle, twitterTitle));
  }
  const twitterDescription = twitter['twitter:description']?.[0]?.trim() ?? '';
  if (twitterDescription && ogDescription && twitterDescription !== ogDescription) {
    findings.push(inconsistent('social.description-twitter', 'og:description and twitter:description differ', ogDescription, twitterDescription));
  }

  const preview = buildPreview(snapshot, openGraph, twitter, description);
  return { outcome: { findings, passed: passedChecks, unavailable: [] }, openGraph, twitter, preview };
}

function buildPreview(snapshot: PageSnapshot, openGraph: Record<string, string[]>, twitter: Record<string, string[]>, description: string): SocialPreview {
  const card = twitter['twitter:card']?.[0]?.trim() || (openGraph['og:title'] ? 'Open Graph fallback' : '');
  const useTwitterTitle = Boolean(twitter['twitter:title']?.[0]?.trim());
  return {
    title: twitter['twitter:title']?.[0]?.trim() || openGraph['og:title']?.[0]?.trim() || snapshot.title.trim(),
    description: twitter['twitter:description']?.[0]?.trim() || openGraph['og:description']?.[0]?.trim() || description.trim(),
    url: openGraph['og:url']?.[0]?.trim() || snapshot.url,
    image: twitter['twitter:image']?.[0]?.trim() || openGraph['og:image']?.[0]?.trim() || '',
    imageAlt: twitter['twitter:image:alt']?.[0]?.trim() || openGraph['og:image:alt']?.[0]?.trim() || '',
    card,
    source: useTwitterTitle ? 'Twitter/X tags, with Open Graph used only for empty fields' : 'Open Graph and page metadata',
  };
}

function emptySocial(key: string, evidence: string): ReturnType<typeof finding> {
  return finding({
    ruleId: `social.empty-${key}`,
    name: `Empty ${key}`,
    category: 'social',
    severity: 'warning',
    kind: 'technical',
    message: `${key} is present but empty.`,
    why: 'An empty tag does not provide a share title, description, or URL.',
    evidence: evidence || '(empty)',
    remediation: `Give ${key} a value or remove the tag.`,
    highlightId: null,
    selectorHint: null,
  });
}

function conflict(key: string, values: string[]): ReturnType<typeof finding> {
  return finding({
    ruleId: `social.conflict-${key}`,
    name: `Conflicting ${key}`,
    category: 'social',
    severity: 'warning',
    kind: 'technical',
    message: `${key} is declared more than once with different values.`,
    why: 'A platform may use any of the values.',
    evidence: values.map((value) => value || '(empty)').join(' | ').slice(0, 240),
    remediation: 'Keep one value.',
    highlightId: null,
    selectorHint: null,
  });
}

function relativeUrl(key: string, value: string): ReturnType<typeof finding> {
  return finding({
    ruleId: `social.relative-${key}`,
    name: `Relative ${key}`,
    category: 'social',
    severity: 'warning',
    kind: 'best-practice',
    message: `${key} is not an absolute http(s) URL.`,
    why: 'Some platforms do not resolve relative share URLs against the page.',
    evidence: value,
    remediation: 'Use an absolute URL.',
    highlightId: null,
    selectorHint: null,
    docsUrl: 'https://ogp.me/',
  });
}

function badUrl(key: string, value: string): ReturnType<typeof finding> {
  return finding({
    ruleId: `social.bad-url-${key}`,
    name: `Malformed ${key}`,
    category: 'social',
    severity: 'warning',
    kind: 'technical',
    message: `${key} is not a valid absolute URL.`,
    why: 'A share destination or image URL needs to parse as a URL.',
    evidence: value,
    remediation: 'Replace it with an absolute http(s) URL.',
    highlightId: null,
    selectorHint: null,
  });
}

function inconsistent(ruleId: string, name: string, left: string, right: string): ReturnType<typeof finding> {
  return finding({
    ruleId,
    name,
    category: 'social',
    severity: 'info',
    kind: 'optional',
    message: `${name}. That can be intentional.`,
    why: 'Search snippets and social cards do not have to use the same sentence.',
    evidence: `${left} ↔ ${right}`.slice(0, 240),
    remediation: 'Keep them different only when each audience needs different wording.',
    highlightId: null,
    selectorHint: null,
  });
}

function isRelative(value: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//');
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
