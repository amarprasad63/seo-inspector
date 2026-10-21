import { fnv1a } from '../shared/json';
import type { PageExtraction } from '../shared/types';

export function scriptSignature(
  scripts: readonly { index: number; elementId: string | null; raw: string }[],
): string {
  return scripts
    .map((script) => `${script.index}\u0000${script.elementId ?? ''}\u0000${fnv1a(script.raw)}\u0000${script.raw.length}`)
    .join('\u0001');
}

export function pageSignature(extraction: PageExtraction): string {
  const snapshot = extraction.snapshot;
  if (!snapshot) return scriptSignature(extraction.scripts);
  const seo = fnv1a(
    [
      snapshot.title,
      snapshot.htmlLang,
      snapshot.metas.map((meta) => `${meta.key}:${meta.content}`).join('\n'),
      snapshot.headings.map((heading) => `${heading.level}:${heading.text}:${heading.hidden}`).join('\n'),
      snapshot.images.map((image) => `${image.src}:${image.alt ?? ''}:${image.failed}`).join('\n'),
      snapshot.anchors.map((anchor) => `${anchor.href}:${anchor.text}`).join('\n'),
      snapshot.content.includedText.slice(0, 4000),
      String(snapshot.content.wordCount),
    ].join('\u0002'),
  );
  return `${scriptSignature(extraction.scripts)}\u0002${seo}`;
}
