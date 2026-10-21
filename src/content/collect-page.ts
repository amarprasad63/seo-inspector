import { LIMITS, type Limits } from '../shared/limits';
import type { AnchorEntry, HeadingEntry, ImageEntry, MetaEntry, PageSnapshot } from '../shared/types';
import { classifyLink } from '../seo/links-classify';
import { wordsOf } from '../seo/text';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEMPLATE', 'TEXTAREA', 'SELECT', 'OPTION']);

export function collectPage(doc: Document, limits: Partial<Limits> = {}, register?: (id: string, element: Element) => void): PageSnapshot {
  const active = { ...LIMITS, ...limits };
  const root = doc.documentElement;
  const url = doc.URL || 'about:blank';
  const titleNodes = [...doc.querySelectorAll('title')];
  const metas = collectMetas(doc);
  const headLinks = [...doc.querySelectorAll('link')].slice(0, 200).map((element, index) => ({
    rel: (element.getAttribute('rel') ?? '').toLowerCase(),
    href: element.getAttribute('href') ?? '',
    hreflang: element.getAttribute('hreflang'),
    type: element.getAttribute('type'),
    index,
  }));
  const ids = collectIds(doc, active.maxIds);
  const headings = collectHeadings(doc, active.maxHeadings, register);
  const images = collectImages(doc, active.maxImages, register);
  const anchors = collectAnchors(doc, url, active.maxAnchors, register);
  const content = collectContent(doc, active);
  const duplicates = duplicateIds(doc, active.maxIds);
  const https = url.startsWith('https:');

  return {
    url,
    title: doc.title ?? '',
    titleCount: titleNodes.length,
    htmlLang: root?.getAttribute('lang')?.trim() ?? '',
    charset: doc.characterSet || '',
    metas,
    headLinks,
    headings: headings.kept,
    images: images.kept,
    anchors: anchors.kept,
    ids: ids.ids,
    landmarks: {
      main: doc.querySelectorAll('main, [role="main"]').length,
      nav: doc.querySelectorAll('nav, [role="navigation"]').length,
      header: doc.querySelectorAll('header, [role="banner"]').length,
      footer: doc.querySelectorAll('footer, [role="contentinfo"]').length,
      aside: doc.querySelectorAll('aside, [role="complementary"]').length,
      article: doc.querySelectorAll('article').length,
    },
    counts: {
      paragraphs: content.paragraphCount,
      lists: doc.querySelectorAll('ul, ol').length,
      tables: doc.querySelectorAll('table').length,
      tablesWithoutHeader: [...doc.querySelectorAll('table')].filter((table) => !table.querySelector('th')).length,
      forms: doc.querySelectorAll('form').length,
      unlabeledControls: countUnlabeledControls(doc),
      namelessButtons: countNamelessButtons(doc),
      untitledIframes: [...doc.querySelectorAll('iframe')].filter((frame) => !(frame.getAttribute('title') ?? '').trim()).length,
      brokenAriaRefs: countBrokenAria(doc),
      duplicateIds: duplicates.count,
    },
    duplicateIdExamples: duplicates.examples,
    content: {
      includedText: content.text,
      wordCount: wordsOf(content.text).length,
      truncated: content.truncated,
      originalLength: content.originalLength,
      source: content.source,
      paragraphs: content.paragraphs,
    },
    caps: {
      imagesOmitted: images.omitted,
      anchorsOmitted: anchors.omitted,
      headingsOmitted: headings.omitted,
      idsTruncated: ids.truncated,
      paragraphsOmitted: content.paragraphsOmitted,
    },
    mixedContentUrls: https ? mixedContent(doc) : [],
    unavailableSignals: [
      'robots.txt was not fetched.',
      'The HTTP X-Robots-Tag header was not read.',
      'Redirects and other response headers were not read.',
      'Image byte size was not measured.',
      'Link destinations were not requested.',
    ],
  };
}

function collectMetas(doc: Document): MetaEntry[] {
  const metas: MetaEntry[] = [];
  let index = 0;
  for (const element of doc.querySelectorAll('meta')) {
    const charset = element.getAttribute('charset');
    if (charset != null) {
      metas.push({ kind: 'charset', key: 'charset', content: charset, index });
      index += 1;
      continue;
    }
    const name = element.getAttribute('name');
    const property = element.getAttribute('property');
    const httpEquiv = element.getAttribute('http-equiv');
    const content = element.getAttribute('content') ?? '';
    if (name) metas.push({ kind: 'name', key: name.trim().toLowerCase(), content, index });
    else if (property) metas.push({ kind: 'property', key: property.trim().toLowerCase(), content, index });
    else if (httpEquiv) metas.push({ kind: 'http-equiv', key: httpEquiv.trim().toLowerCase(), content, index });
    else continue;
    index += 1;
    if (metas.length >= 300) break;
  }
  return metas;
}

function collectHeadings(doc: Document, max: number, register?: (id: string, element: Element) => void): { kept: HeadingEntry[]; omitted: number } {
  const all = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const kept = all.slice(0, max).map((element, index) => {
    const highlightId = `h:${index}`;
    register?.(highlightId, element);
    return {
      level: Number(element.tagName.slice(1)),
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
      hidden: isHidden(element),
      highlightId,
      selectorHint: selectorHint(element),
      index,
    };
  });
  return { kept, omitted: Math.max(0, all.length - kept.length) };
}

function collectImages(doc: Document, max: number, register?: (id: string, element: Element) => void): { kept: ImageEntry[]; omitted: number } {
  const all = [...doc.querySelectorAll('img')];
  const kept = all.slice(0, max).map((element, index) => {
    const highlightId = `img:${index}`;
    register?.(highlightId, element);
    const image = element as HTMLImageElement;
    const altAttr = element.getAttribute('alt');
    const src = element.getAttribute('src') ?? '';
    const complete = Boolean(image.complete);
    const naturalWidth = numberOrZero(image.naturalWidth);
    const naturalHeight = numberOrZero(image.naturalHeight);
    return {
      src: src.slice(0, 1000),
      srcset: (element.getAttribute('srcset') ?? '').slice(0, 500),
      alt: altAttr == null ? null : altAttr.slice(0, 500),
      altPresent: altAttr != null,
      widthAttr: element.getAttribute('width'),
      heightAttr: element.getAttribute('height'),
      loading: element.getAttribute('loading'),
      decoding: element.getAttribute('decoding'),
      fetchPriority: element.getAttribute('fetchpriority'),
      naturalWidth,
      naturalHeight,
      renderedWidth: numberOrZero(image.clientWidth),
      renderedHeight: numberOrZero(image.clientHeight),
      complete,
      failed: complete && naturalWidth === 0 && src.trim().length > 0 && !src.trim().startsWith('data:'),
      hidden: isHidden(element),
      inLink: Boolean(element.closest('a')),
      aboveFold: aboveFold(element),
      highlightId,
      selectorHint: selectorHint(element),
      index,
    };
  });
  return { kept, omitted: Math.max(0, all.length - kept.length) };
}

function collectAnchors(doc: Document, pageUrl: string, max: number, register?: (id: string, element: Element) => void): { kept: AnchorEntry[]; omitted: number } {
  const all = [...doc.querySelectorAll('a')];
  const kept = all.slice(0, max).map((element, index) => {
    const highlightId = `a:${index}`;
    register?.(highlightId, element);
    const href = element.getAttribute('href') ?? '';
    const image = element.querySelector('img');
    return {
      href: href.slice(0, 1000),
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
      rel: (element.getAttribute('rel') ?? '').toLowerCase(),
      target: element.getAttribute('target'),
      hasImage: Boolean(image),
      imageAlt: image?.getAttribute('alt')?.trim() ?? '',
      hidden: isHidden(element),
      highlightId,
      selectorHint: selectorHint(element),
      index,
      className: classifyLink(href, pageUrl),
    };
  });
  return { kept, omitted: Math.max(0, all.length - kept.length) };
}

function collectContent(doc: Document, limits: Limits): {
  text: string;
  originalLength: number;
  truncated: boolean;
  source: 'main' | 'body';
  paragraphs: string[];
  paragraphCount: number;
  paragraphsOmitted: number;
} {
  const mains = [...doc.querySelectorAll('main, [role="main"]')];
  const source = mains.length > 0 ? 'main' : 'body';
  const roots = mains.length > 0 ? mains : [doc.body].filter((node): node is HTMLElement => node != null);
  let combined = '';
  let originalLength = 0;
  let truncated = false;
  const paragraphs: string[] = [];
  let paragraphCount = 0;
  let paragraphsOmitted = 0;

  const append = (value: string) => {
    originalLength += value.length;
    if (truncated) return;
    const room = limits.maxContentChars - combined.length;
    if (room <= 0) {
      truncated = true;
      return;
    }
    combined += value.slice(0, room);
    if (value.length > room) truncated = true;
  };

  const walk = (node: Node, boilerplate: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!boilerplate) append(node.textContent ?? '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (SKIP_TAGS.has(element.tagName) || element.tagName === 'INPUT' || element.tagName === 'BUTTON') return;
    if (isHidden(element)) return;
    const nextBoilerplate = boilerplate || isBoilerplate(element);
    if (element.tagName === 'P' && !nextBoilerplate) {
      paragraphCount += 1;
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text && paragraphs.length < limits.maxParagraphs) paragraphs.push(text.slice(0, 500));
      else if (text) paragraphsOmitted += 1;
    }
    for (const child of element.childNodes) walk(child, nextBoilerplate);
  };

  for (const root of roots) walk(root, false);
  return {
    text: combined.replace(/\s+/g, ' ').trim(),
    originalLength,
    truncated,
    source,
    paragraphs,
    paragraphCount,
    paragraphsOmitted,
  };
}

function collectIds(doc: Document, max: number): { ids: string[]; truncated: boolean } {
  const ids: string[] = [];
  for (const element of doc.querySelectorAll('[id]')) {
    if (!element.id) continue;
    ids.push(element.id);
    if (ids.length >= max) return { ids, truncated: true };
  }
  return { ids, truncated: false };
}

function duplicateIds(doc: Document, max: number): { count: number; examples: string[] } {
  const seen = new Map<string, number>();
  let scanned = 0;
  for (const element of doc.querySelectorAll('[id]')) {
    if (!element.id) continue;
    seen.set(element.id, (seen.get(element.id) ?? 0) + 1);
    scanned += 1;
    if (scanned >= max) break;
  }
  const examples = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  return { count: examples.length, examples: examples.slice(0, 10) };
}

function countUnlabeledControls(doc: Document): number {
  let count = 0;
  for (const element of doc.querySelectorAll('input, textarea, select')) {
    const type = (element.getAttribute('type') ?? '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') continue;
    if (hasAccessibleName(element) || element.closest('label')) continue;
    const id = element.getAttribute('id');
    if (id && doc.querySelector(`label[for="${cssEscape(id)}"]`)) continue;
    count += 1;
    if (count >= 100) break;
  }
  return count;
}

function countNamelessButtons(doc: Document): number {
  let count = 0;
  const buttons = doc.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]');
  for (const element of buttons) {
    if (hasAccessibleName(element)) continue;
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const imageAlt = element.querySelector('img')?.getAttribute('alt')?.trim();
    if (text || imageAlt) continue;
    count += 1;
    if (count >= 100) break;
  }
  return count;
}

function countBrokenAria(doc: Document): number {
  let count = 0;
  const elements = doc.querySelectorAll('[aria-labelledby], [aria-describedby]');
  let scanned = 0;
  for (const element of elements) {
    scanned += 1;
    if (scanned > 100) break;
    const refs = `${element.getAttribute('aria-labelledby') ?? ''} ${element.getAttribute('aria-describedby') ?? ''}`
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (refs.some((id) => !doc.getElementById(id))) count += 1;
  }
  return count;
}

function mixedContent(doc: Document): string[] {
  const urls: string[] = [];
  for (const element of doc.querySelectorAll('img, script, link, iframe, video, audio, source')) {
    const value = element.getAttribute('src') ?? element.getAttribute('href') ?? '';
    if (value.startsWith('http://')) urls.push(value.slice(0, 300));
    if (urls.length >= 20) break;
  }
  return urls;
}

function hasAccessibleName(element: Element): boolean {
  return Boolean(
    element.getAttribute('aria-label')?.trim() ||
      element.getAttribute('aria-labelledby')?.trim() ||
      element.getAttribute('title')?.trim(),
  );
}

function isBoilerplate(element: Element): boolean {
  const role = element.getAttribute('role');
  return element.tagName === 'NAV' || element.tagName === 'FOOTER' || element.tagName === 'ASIDE' || role === 'navigation' || role === 'contentinfo';
}

export function isHidden(element: Element): boolean {
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return true;
  const style = element.getAttribute('style') ?? '';
  if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) return true;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const computed = view.getComputedStyle(element);
  return computed.display === 'none' || computed.visibility === 'hidden';
}

function aboveFold(element: Element): boolean | null {
  if (typeof element.getBoundingClientRect !== 'function') return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  const height = element.ownerDocument.defaultView?.innerHeight ?? 0;
  if (!height) return null;
  return rect.top < height && rect.bottom > 0;
}

function selectorHint(element: Element): string {
  if (element.id && /^[A-Za-z][A-Za-z0-9_-]*$/.test(element.id)) return `#${element.id}`;
  return element.tagName.toLowerCase();
}

function numberOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
