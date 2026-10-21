import { describe, expect, it } from 'vitest';
import { discoverEntities } from '../src/parser/entity-discovery';
import { parseScript, preprocessJsonLd } from '../src/parser/jsonld-parser';
import { compactTypeName } from '../src/parser/type-names';
import type { ParsedScript } from '../src/shared/types';

function parsed(raw: string, index = 0, extra: Partial<ParsedScript> = {}): ParsedScript {
  return parseScript({
    index,
    elementId: extra.elementId ?? null,
    raw,
    originalLength: extra.originalLength,
    truncated: extra.truncated,
  });
}

describe('json-ld parser', () => {
  it('parses an object and keeps raw text', () => {
    const script = parsed('{"@type":"JobPosting","title":"Editor"}');
    expect(script.parseStatus).toBe('ok');
    expect(script.parseError).toBeNull();
    expect(script.data).toMatchObject({ title: 'Editor' });
    expect(script.raw).toContain('Editor');
  });

  it('reports invalid JSON without dropping the raw script', () => {
    const raw = '{"@type": "JobPosting"';
    const script = parsed(raw);
    expect(script.parseStatus).toBe('error');
    expect(script.parseError).toBeTruthy();
    expect(script.data).toBeNull();
    expect(script.raw).toBe(raw);
  });

  it('reports empty and whitespace scripts', () => {
    expect(parsed('').parseStatus).toBe('empty');
    expect(parsed('   \n').parseStatus).toBe('empty');
  });

  it('unwraps HTML comments and CDATA before parsing', () => {
    const commented = parsed('<!-- {"@type":"Thing","name":"A"} -->');
    expect(commented.parseStatus).toBe('ok');
    expect(commented.data).toMatchObject({ name: 'A' });
    const cdata = parsed('<![CDATA[{"@type":"Thing","name":"B"}]]>');
    expect(cdata.parseStatus).toBe('ok');
    expect(preprocessJsonLd('\uFEFF {"a":1}')).toBe('{"a":1}');
  });

  it('accepts JSON null and primitive roots as parsed values', () => {
    expect(parsed('null').parseStatus).toBe('ok');
    expect(parsed('null').data).toBeNull();
    expect(parsed('"just a string"').data).toBe('just a string');
    expect(parsed('12').data).toBe(12);
  });

  it('marks truncated scripts as errors and keeps the prefix', () => {
    const script = parsed('{"@type":"Thing"}', 0, { truncated: true, originalLength: 50 });
    expect(script.parseStatus).toBe('error');
    expect(script.truncated).toBe(true);
    expect(script.raw).toContain('@type');
    expect(script.parseError).toMatch(/50/);
  });
});

describe('type names', () => {
  it('compacts schema.org URLs, hashes, and prefixes', () => {
    expect(compactTypeName('https://schema.org/JobPosting')).toBe('JobPosting');
    expect(compactTypeName('http://schema.org/Organization')).toBe('Organization');
    expect(compactTypeName('https://schema.org/Person#something')).toBe('something');
    expect(compactTypeName('schema:Place')).toBe('Place');
    expect(compactTypeName('WebPage')).toBe('WebPage');
  });
});

describe('entity discovery', () => {
  it('discovers nested entities, graphs, arrays, and multiple types', () => {
    const graph = parsed(
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'Acme', founder: { '@type': ['Person', 'https://schema.org/Person'], name: 'Ada' } },
          { '@type': 'WebPage', name: 'Home' },
        ],
      }),
    );
    const list = parsed(
      JSON.stringify([
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Jobs', item: 'https://example.com/jobs' }] },
      ]),
      1,
    );
    const discovered = discoverEntities([graph, list]);
    const types = discovered.entities.map((entity) => entity.types.join('+'));
    expect(types).toContain('Organization');
    expect(types).toContain('Person+Person');
    expect(types).toContain('WebPage');
    expect(types).toContain('BreadcrumbList');
    expect(types).toContain('ListItem');
    const person = discovered.entities.find((entity) => entity.types.includes('Person'));
    expect(person?.path).toContain('founder');
    expect(person?.scriptIndex).toBe(0);
    expect(discovered.entities.some((entity) => entity.value.name === 'Acme' && !entity.types.includes('WebPage'))).toBe(true);
  });

  it('does not treat untyped nested objects as entities', () => {
    const script = parsed(JSON.stringify({ '@type': 'Thing', extra: { name: 'not an entity' } }));
    const discovered = discoverEntities([script]);
    expect(discovered.entities).toHaveLength(1);
    expect(discovered.entities[0]?.types).toEqual(['Thing']);
  });

  it('stops on cyclic references', () => {
    const left: Record<string, unknown> = { '@type': 'Thing', name: 'Left' };
    const right: Record<string, unknown> = { '@type': 'Thing', name: 'Right', related: left };
    left.related = right;
    const script: ParsedScript = {
      index: 0,
      elementId: null,
      raw: '',
      originalLength: 0,
      truncated: false,
      parseStatus: 'ok',
      parseError: null,
      data: left,
    };
    const discovered = discoverEntities([script]);
    expect(discovered.entities.map((entity) => entity.value.name).sort()).toEqual(['Left', 'Right']);
  });

  it('caps depth and records a finding instead of walking forever', () => {
    let node: Record<string, unknown> = { '@type': 'Thing', name: 'deep' };
    for (let index = 0; index < 80; index += 1) {
      node = { '@type': 'Thing', name: `level-${index}`, child: node };
    }
    const discovered = discoverEntities([
      {
        index: 3,
        elementId: null,
        raw: '',
        originalLength: 0,
        truncated: false,
        parseStatus: 'ok',
        parseError: null,
        data: node,
      },
    ]);
    expect(discovered.entities.length).toBeGreaterThan(10);
    expect(discovered.entities.length).toBeLessThan(80);
    expect(discovered.notes.some((note) => note.ruleId === 'discovery.depth-limit')).toBe(true);
  });
});
