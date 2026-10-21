/**
 * Size and traversal limits. They are the single configuration point for
 * memory protection. When a limit is hit, the inspector records an explicit
 * finding or truncation flag and surfaces it in the UI and in exports.
 */
export interface Limits {
  maxRetainedChars: number;
  maxParseOnPageChars: number;
  workerThresholdChars: number;
  maxDepth: number;
  treeDisplayDepth: number;
  maxEntities: number;
  maxFindings: number;
  maxNodes: number;
  mutationDebounceMs: number;
  treePageSize: number;
  stringPreviewChars: number;
  rawPreviewChars: number;
  rawRenderMaxChars: number;
  listPageSize: number;
}

export const LIMITS: Limits = {
  /** Characters of each script kept for analysis and export. */
  maxRetainedChars: 2_000_000,
  /** Above this, the content script does not parse on the page thread. */
  maxParseOnPageChars: 300_000,
  /** Above this total raw size, the extension page analyzes in a worker. */
  workerThresholdChars: 120_000,
  /** Entity walk stops descending past this depth. */
  maxDepth: 48,
  /** JSON tree display stops offering nested expansion past this depth. */
  treeDisplayDepth: 30,
  /** Maximum typed entities recorded per page. */
  maxEntities: 4_000,
  /** Maximum validation findings generated per page. */
  maxFindings: 5_000,
  /** Maximum nodes visited while walking one script. */
  maxNodes: 100_000,
  /** Mutation observer debounce. */
  mutationDebounceMs: 300,
  /** Object/array children rendered before "Show more". */
  treePageSize: 50,
  /** Characters of a string shown before "Show more". */
  stringPreviewChars: 240,
  /** Characters of a raw script rendered before the user asks for more. */
  rawPreviewChars: 4_000,
  /** Do not mount a single text node larger than this. */
  rawRenderMaxChars: 500_000,
  /** Schema explorer and validation lists page size. */
  listPageSize: 80,
};
