import { fnv1a } from '../shared/json';

export function scriptSignature(
  scripts: readonly { index: number; elementId: string | null; raw: string }[],
): string {
  return scripts
    .map((script) => `${script.index}\u0000${script.elementId ?? ''}\u0000${fnv1a(script.raw)}\u0000${script.raw.length}`)
    .join('\u0001');
}
