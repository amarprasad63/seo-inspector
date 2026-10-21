export type ContentParseStatus = 'ok' | 'error' | 'empty' | 'deferred';

export type ParseStatus = 'ok' | 'error' | 'empty';

/** Payload collected from the page. Raw script text only — never full HTML. */
export interface ExtractedScript {
  index: number;
  elementId: string | null;
  raw: string;
  originalLength: number;
  truncated: boolean;
  parseStatus: ContentParseStatus;
  parseError: string | null;
}

export interface PageExtraction {
  url: string;
  title: string;
  extractedAt: string;
  scripts: ExtractedScript[];
  /**
   * On-page evidence collected with the JSON-LD scripts.
   * Absent only for older payloads. JSON-LD analysis does not require it.
   */
  snapshot?: PageSnapshot;
}

export interface MetaEntry {
  kind: 'name' | 'property' | 'http-equiv' | 'charset';
  key: string;
  content: string;
  index: number;
}

export interface HeadLinkEntry {
  rel: string;
  href: string;
  hreflang: string | null;
  type: string | null;
  index: number;
}

export interface HeadingEntry {
  level: number;
  text: string;
  hidden: boolean;
  highlightId: string;
  selectorHint: string;
  index: number;
}

export interface ImageEntry {
  src: string;
  srcset: string;
  alt: string | null;
  altPresent: boolean;
  widthAttr: string | null;
  heightAttr: string | null;
  loading: string | null;
  decoding: string | null;
  fetchPriority: string | null;
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  complete: boolean;
  failed: boolean;
  hidden: boolean;
  inLink: boolean;
  aboveFold: boolean | null;
  highlightId: string;
  selectorHint: string;
  index: number;
}

export interface AnchorEntry {
  href: string;
  text: string;
  rel: string;
  target: string | null;
  hasImage: boolean;
  imageAlt: string;
  hidden: boolean;
  highlightId: string;
  selectorHint: string;
  index: number;
  className: 'internal' | 'external' | 'fragment' | 'mailto' | 'tel' | 'other' | 'empty' | 'malformed';
}

export interface PageSnapshot {
  url: string;
  title: string;
  titleCount: number;
  htmlLang: string;
  charset: string;
  metas: MetaEntry[];
  headLinks: HeadLinkEntry[];
  headings: HeadingEntry[];
  images: ImageEntry[];
  anchors: AnchorEntry[];
  ids: string[];
  landmarks: { main: number; nav: number; header: number; footer: number; aside: number; article: number };
  counts: {
    paragraphs: number;
    lists: number;
    tables: number;
    tablesWithoutHeader: number;
    forms: number;
    unlabeledControls: number;
    namelessButtons: number;
    untitledIframes: number;
    brokenAriaRefs: number;
    duplicateIds: number;
  };
  duplicateIdExamples: string[];
  content: {
    includedText: string;
    wordCount: number;
    truncated: boolean;
    originalLength: number;
    source: 'main' | 'body';
    paragraphs: string[];
  };
  caps: {
    imagesOmitted: number;
    anchorsOmitted: number;
    headingsOmitted: number;
    idsTruncated: boolean;
    paragraphsOmitted: number;
  };
  mixedContentUrls: string[];
  unavailableSignals: string[];
}

export interface ParsedScript {
  index: number;
  elementId: string | null;
  raw: string;
  originalLength: number;
  truncated: boolean;
  parseStatus: ParseStatus;
  parseError: string | null;
  /**
   * Parsed JSON when parseStatus is `ok`.
   * `null` here means the JSON value was null when status is `ok`.
   * When status is `error` or `empty`, `data` is also null and must not be
   * treated as a JSON null value.
   */
  data: unknown | null;
}

export interface SchemaEntity {
  id: string;
  scriptIndex: number;
  path: string;
  types: string[];
  rawTypes: string[];
  value: Record<string, unknown>;
}
