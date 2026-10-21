/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { collectJsonLd } from '../src/content/extract';
import { createDebounced } from '../src/content/debounce';
import { isJsonLdScriptElement, shouldHandleMutation, type MutationLike, type NodeLike } from '../src/content/dom-filter';

describe('DOM extraction', () => {
  it('reads multiple JSON-LD scripts, ids, and charset type attributes', () => {
    document.title = 'Jobs';
    document.body.replaceChildren();
    const first = document.createElement('script');
    first.type = 'application/ld+json';
    first.id = 'job-schema';
    first.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Editor' });
    const second = document.createElement('script');
    second.type = 'application/ld+json; charset=utf-8';
    second.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' });
    const ignored = document.createElement('script');
    ignored.type = 'application/json';
    ignored.textContent = '{"ignored":true}';
    document.body.append(first, second, ignored);

    const extraction = collectJsonLd(document);
    expect(extraction.title).toBe('Jobs');
    expect(extraction.scripts).toHaveLength(2);
    expect(extraction.scripts[0]).toMatchObject({ index: 0, elementId: 'job-schema', parseStatus: 'ok' });
    expect(extraction.scripts[1]?.parseStatus).toBe('ok');
    expect(extraction.scripts[0]?.raw).toContain('JobPosting');
  });

  it('keeps invalid raw text and records truncation', () => {
    document.body.replaceChildren();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = '{"unterminated":';
    document.body.append(script);
    const invalid = collectJsonLd(document);
    expect(invalid.scripts[0]?.parseStatus).toBe('error');
    expect(invalid.scripts[0]?.raw).toBe('{"unterminated":');

    const huge = document.createElement('script');
    huge.type = 'application/ld+json';
    huge.textContent = `{"name":"${'x'.repeat(40)}"}`;
    document.body.replaceChildren(huge);
    const truncated = collectJsonLd(document, { maxRetainedChars: 12 });
    expect(truncated.scripts[0]?.truncated).toBe(true);
    expect(truncated.scripts[0]?.raw.length).toBe(12);
    expect(truncated.scripts[0]?.originalLength).toBeGreaterThan(12);
    expect(truncated.scripts[0]?.parseError).toMatch(/truncated|retention/i);
  });

  it('defers parsing of large scripts on the page thread', () => {
    document.body.replaceChildren();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({ '@type': 'Thing', name: 'x'.repeat(50) });
    document.body.append(script);
    const extraction = collectJsonLd(document, { maxParseOnPageChars: 10, maxRetainedChars: 10_000 });
    expect(extraction.scripts[0]?.parseStatus).toBe('deferred');
    expect(extraction.scripts[0]?.raw).toContain('Thing');
  });
});

describe('mutation filter and debounce', () => {
  it('ignores unrelated DOM changes and notices JSON-LD edits', () => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = '{}';
    const div = document.createElement('div');
    div.append(script);

    expect(isJsonLdScriptElement(script)).toBe(true);
    expect(shouldHandleMutation(record('childList', div, [], []))).toBe(false);
    expect(shouldHandleMutation(record('childList', div, [script], []))).toBe(true);
    expect(shouldHandleMutation(record('childList', div, [div], []))).toBe(true);
    expect(shouldHandleMutation(record('attributes', script, [], [], 'type'))).toBe(true);
    expect(shouldHandleMutation(record('attributes', div, [], [], 'class'))).toBe(false);

    const text = script.firstChild;
    expect(text).toBeTruthy();
    if (text) {
      expect(shouldHandleMutation(record('characterData', text, [], []))).toBe(true);
    }
  });

  it('debounces repeated triggers', () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const task = createDebounced(() => calls.push(1), 300);
    task.trigger();
    task.trigger();
    vi.advanceTimersByTime(299);
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(1);
    task.cancel();
    vi.useRealTimers();
  });
});

function record(
  type: string,
  target: Node,
  added: Node[],
  removed: Node[],
  attributeName: string | null = null,
): MutationLike {
  return {
    type,
    attributeName,
    target: target as NodeLike,
    addedNodes: added as unknown as NodeLike[],
    removedNodes: removed as unknown as NodeLike[],
  };
}
