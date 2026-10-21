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
