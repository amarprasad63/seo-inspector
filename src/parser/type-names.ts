export interface TypeRead {
  compact: string[];
  raw: string[];
  malformed: boolean;
}

export function compactTypeName(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('#')) {
    const withoutQuery = trimmed.split('?')[0] ?? trimmed;
    const slash = withoutQuery.lastIndexOf('/');
    const hash = withoutQuery.lastIndexOf('#');
    const cut = Math.max(slash, hash);
    const name = cut >= 0 ? withoutQuery.slice(cut + 1) : withoutQuery;
    return name || trimmed;
  }
  const colon = trimmed.lastIndexOf(':');
  if (colon > 0 && colon < trimmed.length - 1) return trimmed.slice(colon + 1);
  return trimmed;
}

export function readTypeValue(typeValue: unknown): TypeRead {
  const items = Array.isArray(typeValue) ? typeValue : [typeValue];
  const raw: string[] = [];
  let malformed = items.length === 0;
  for (const item of items) {
    if (typeof item !== 'string' || item.trim() === '') {
      malformed = true;
      continue;
    }
    raw.push(item.trim());
  }
  return {
    compact: raw.map(compactTypeName),
    raw,
    malformed,
  };
}
