export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function joinPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  if (IDENTIFIER.test(key)) return `${parent}.${key}`;
  return `${parent}[${JSON.stringify(key)}]`;
}

export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const json = JSON.stringify(
    value,
    (_key, current: unknown) => {
      if (typeof current === 'object' && current !== null) {
        if (seen.has(current)) return '[Circular]';
        seen.add(current);
      }
      if (typeof current === 'bigint') return current.toString();
      return current;
    },
    2,
  );
  return json ?? 'null';
}

export function pageAccess(url: string | undefined): { ok: true } | { ok: false; reason: string } {
  if (!url) {
    return {
      ok: false,
      reason:
        'This tab has no readable address. JSON-LD inspection runs on ordinary http and https pages.',
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'This tab address could not be read.' };
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return { ok: true };
  return {
    ok: false,
    reason: `This page uses the ${parsed.protocol} scheme. The inspector only reads ordinary http and https pages, so browser settings, extension, and other restricted pages are skipped.`,
  };
}
