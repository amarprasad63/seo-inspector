/** Visible-text helpers. Phrase matching is case-insensitive and ignores surrounding punctuation. */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'is', 'are',
  'was', 'were', 'be', 'this', 'that', 'it', 'as', 'your', 'you', 'our', 'we', 'they', 'their', 'its',
  'not', 'but', 'if', 'can', 'will', 'have', 'has', 'had', 'all', 'any', 'into', 'over', 'than', 'then',
]);

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordsOf(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ') : [];
}

export function countPhrase(haystack: string, phrase: string): number {
  const text = normalizeText(haystack);
  const needle = normalizeText(phrase);
  if (!needle || !text) return 0;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, 'gu');
  return [...text.matchAll(pattern)].length;
}

export function splitKeywordList(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim().slice(0, 80);
    const key = normalizeText(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= 5) break;
  }
  return result;
}

export function topTerms(text: string, limit = 8): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const word of wordsOf(text)) {
    if (word.length < 3 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

export function looksRepetitive(value: string): boolean {
  const words = wordsOf(value).filter((word) => word.length >= 4);
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.values()].some((count) => count >= 3);
}

export function hasEdgeWhitespace(value: string): boolean {
  return value !== value.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
