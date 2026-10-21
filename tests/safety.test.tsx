/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonTree } from '../src/components/JsonTree';

describe('safe rendering', () => {
  it('renders untrusted keys and strings as text', () => {
    const payload = {
      '<img src=x onerror=alert(1)>': '<script>alert(1)</script>',
      nested: { name: '"><img src=x>' },
    };
    const view = render(<JsonTree value={payload} initialExpandDepth={3} />);
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.textContent).toContain('<script>alert(1)</script>');
    expect(view.container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(view.container.textContent).toContain('"><img src=x>');
  });
});

describe('source boundaries', () => {
  it('does not send page data or render JSON as HTML', () => {
    const files = walk('src').filter((file) => /\.(ts|tsx|css|mjs)$/.test(file));
    const banned = [/innerHTML/, /\beval\s*\(/, /new Function/, /sendBeacon/, /\bfetch\s*\(/, /XMLHttpRequest/];
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of banned) {
        if (pattern.test(source)) offenders.push(`${file} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return [path];
  });
}
