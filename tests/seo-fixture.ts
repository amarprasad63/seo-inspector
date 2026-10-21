import type { PageSnapshot } from '../src/shared/types';

export function snapshot(partial: Partial<PageSnapshot> = {}): PageSnapshot {
  const base: PageSnapshot = {
    url: 'https://example.com/internships',
    title: 'Internships in India',
    titleCount: 1,
    htmlLang: 'en',
    charset: 'UTF-8',
    metas: [
      { kind: 'charset', key: 'charset', content: 'utf-8', index: 0 },
      { kind: 'name', key: 'description', content: 'Find internships across India for students and fresh graduates.', index: 1 },
      { kind: 'name', key: 'viewport', content: 'width=device-width, initial-scale=1', index: 2 },
    ],
    headLinks: [{ rel: 'canonical', href: 'https://example.com/internships', hreflang: null, type: null, index: 0 }],
    headings: [
      { level: 1, text: 'Internships in India', hidden: false, highlightId: 'h:0', selectorHint: 'h1', index: 0 },
      { level: 2, text: 'Engineering', hidden: false, highlightId: 'h:1', selectorHint: 'h2', index: 1 },
    ],
    images: [],
    anchors: [],
    ids: ['engineering'],
    landmarks: { main: 1, nav: 1, header: 1, footer: 1, aside: 0, article: 0 },
    counts: {
      paragraphs: 2,
      lists: 1,
      tables: 0,
      tablesWithoutHeader: 0,
      forms: 0,
      unlabeledControls: 0,
      namelessButtons: 0,
      untitledIframes: 0,
      brokenAriaRefs: 0,
      duplicateIds: 0,
    },
    duplicateIdExamples: [],
    content: {
      includedText: 'Internships in India help students find engineering and marketing roles.',
      wordCount: 11,
      truncated: false,
      originalLength: 72,
      source: 'main',
      paragraphs: ['Internships in India help students find engineering and marketing roles.'],
    },
    caps: { imagesOmitted: 0, anchorsOmitted: 0, headingsOmitted: 0, idsTruncated: false, paragraphsOmitted: 0 },
    mixedContentUrls: [],
    unavailableSignals: [],
  };
  return {
    ...base,
    ...partial,
    metas: partial.metas ?? base.metas,
    headLinks: partial.headLinks ?? base.headLinks,
    headings: partial.headings ?? base.headings,
    images: partial.images ?? base.images,
    anchors: partial.anchors ?? base.anchors,
    landmarks: { ...base.landmarks, ...partial.landmarks },
    counts: { ...base.counts, ...partial.counts },
    content: { ...base.content, ...partial.content },
    caps: { ...base.caps, ...partial.caps },
  };
}
