import { isRecord, joinPath } from '../shared/json';
import { LIMITS } from '../shared/limits';
import { readTypeValue } from '../parser/type-names';
import type { ParsedScript } from '../shared/types';
import { makeFinding } from './finding';
import type { Finding } from './types';

interface IdUse {
  id: string;
  scriptIndex: number;
  path: string;
  types: string[];
  fingerprint: string;
}

export function evaluateStructure(scripts: readonly ParsedScript[]): Finding[] {
  const findings: Finding[] = [];
  const ids: IdUse[] = [];

  for (const script of scripts) {
    if (script.parseStatus !== 'ok') continue;
    if (!isRecord(script.data) && !Array.isArray(script.data)) continue;

    if (Array.isArray(script.data) && script.data.length === 0) {
      findings.push(
        makeFinding({
          ruleId: 'structure.empty-root',
          severity: 'warning',
          category: 'structure',
          message: 'Top-level JSON array is empty.',
          path: '$',
          scriptIndex: script.index,
        }),
      );
      continue;
    }

    findings.push(...contextFindings(script));
    const seen = new WeakSet<object>();
    walk(script.data, '$', script.index, 0, seen, findings, ids, { nodes: 0, capped: false });
  }

  findings.push(...duplicateIdFindings(ids));
  return findings;
}

function contextFindings(script: ParsedScript): Finding[] {
  const nodes = Array.isArray(script.data) ? script.data : [script.data];
  const objects = nodes.filter(isRecord);
  if (objects.length === 0) return [];

  const contexts = objects.map((node) => ('@context' in node ? node['@context'] : undefined));
  const present = contexts.filter((value) => value !== undefined);
  if (present.length === 0) {
    return [
      makeFinding({
        ruleId: 'structure.missing-context',
        severity: 'warning',
        category: 'structure',
        message:
          'No @context was found on the root node. JSON-LD consumers usually need a context such as https://schema.org to interpret properties.',
        path: '$',
        scriptIndex: script.index,
        property: '@context',
      }),
    ];
  }

  const verdicts = present.map(classifyContext);
  if (verdicts.every((verdict) => verdict === 'malformed')) {
    return [
      makeFinding({
        ruleId: 'structure.malformed-context',
        severity: 'warning',
        category: 'structure',
        message: '@context is present but is not a string, array, or object.',
        path: '$',
        scriptIndex: script.index,
        property: '@context',
      }),
    ];
  }
  if (verdicts.some((verdict) => verdict === 'schema')) return [];
  return [
    makeFinding({
      ruleId: 'structure.unfamiliar-context',
      severity: 'info',
      category: 'structure',
      message:
        '@context does not mention schema.org. That can be valid JSON-LD for another vocabulary. Schema.org and Google checks still run against compact @type names and may not apply.',
      path: '$',
      scriptIndex: script.index,
      property: '@context',
    }),
  ];
}

function classifyContext(value: unknown): 'schema' | 'other' | 'malformed' | 'absent' {
  if (value == null) return 'absent';
  if (typeof value === 'string') return /schema\.org/i.test(value) ? 'schema' : 'other';
  if (typeof value === 'number' || typeof value === 'boolean') return 'malformed';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'absent';
    const parts = value.map(classifyContext);
    if (parts.some((part) => part === 'schema')) return 'schema';
    if (parts.every((part) => part === 'malformed')) return 'malformed';
    return 'other';
  }
  if (!isRecord(value)) return 'malformed';
  if (typeof value['@vocab'] === 'string') {
    return /schema\.org/i.test(value['@vocab']) ? 'schema' : 'other';
  }
  const serialized = JSON.stringify(value);
  if (serialized && /schema\.org/i.test(serialized)) return 'schema';
  return 'other';
}

interface WalkBudget {
  nodes: number;
  capped: boolean;
}

function walk(
  value: unknown,
  path: string,
  scriptIndex: number,
  depth: number,
  seen: WeakSet<object>,
  findings: Finding[],
  ids: IdUse[],
  budget: WalkBudget,
): void {
  if (budget.capped) return;
  budget.nodes += 1;
  if (budget.nodes > LIMITS.maxNodes || depth > LIMITS.maxDepth) {
    budget.capped = true;
    return;
  }

  if (Array.isArray(value)) {
    if (path === '$') {
      value.forEach((item, index) => {
        if (!isRecord(item)) {
          findings.push(
            makeFinding({
              ruleId: 'syntax.primitive-root',
              severity: 'error',
              category: 'syntax',
              message: `Top-level array item ${index} is not an object.`,
              path: `$[${index}]`,
              scriptIndex,
            }),
          );
        }
      });
    }
    value.forEach((item, index) => {
      walk(item, `${path}[${index}]`, scriptIndex, depth + 1, seen, findings, ids, budget);
    });
    return;
  }
  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  if ('@type' in value) {
    const types = readTypeValue(value['@type']);
    if (types.malformed || types.compact.length === 0) {
      findings.push(
        makeFinding({
          ruleId: 'structure.malformed-type',
          severity: 'warning',
          category: 'structure',
          message: '@type is empty or contains a non-string value.',
          path,
          scriptIndex,
          property: '@type',
        }),
      );
    }
  }

  if ('@id' in value && (typeof value['@id'] !== 'string' || value['@id'].trim() === '')) {
    findings.push(
      makeFinding({
        ruleId: 'structure.malformed-id',
        severity: 'warning',
        category: 'structure',
        message: '@id is present but is not a non-empty string.',
        path,
        scriptIndex,
        property: '@id',
      }),
    );
  } else if (typeof value['@id'] === 'string' && value['@id'].trim()) {
    const types = '@type' in value ? readTypeValue(value['@type']).compact : [];
    ids.push({
      id: value['@id'],
      scriptIndex,
      path,
      types,
      fingerprint: fingerprint(value),
    });
  }

  if ('@list' in value && !Array.isArray(value['@list'])) {
    findings.push(
      makeFinding({
        ruleId: 'structure.malformed-list',
        severity: 'error',
        category: 'structure',
        message: '@list must be an array.',
        path,
        scriptIndex,
        property: '@list',
      }),
    );
  }

  if ('@graph' in value) {
    findings.push(...graphFindings(value['@graph'], path, scriptIndex));
  }

  if (isExpectedEntityPath(path) && !('@type' in value) && !('@graph' in value)) {
    findings.push(
      makeFinding({
        ruleId: 'structure.missing-type',
        severity: 'warning',
        category: 'structure',
        message:
          path === '$'
            ? 'Top-level object has neither @type nor @graph, so there is no typed entity at the root.'
            : 'Top-level array item has neither @type nor @graph.',
        path,
        scriptIndex,
        property: '@type',
      }),
    );
  }

  for (const key of Object.keys(value)) {
    walk(value[key], joinPath(path, key), scriptIndex, depth + 1, seen, findings, ids, budget);
  }
}

function graphFindings(graph: unknown, path: string, scriptIndex: number): Finding[] {
  const graphPath = joinPath(path, '@graph');
  if (Array.isArray(graph)) {
    if (graph.length === 0) {
      return [
        makeFinding({
          ruleId: 'structure.empty-graph',
          severity: 'warning',
          category: 'structure',
          message: '@graph is an empty array.',
          path: graphPath,
          scriptIndex,
          property: '@graph',
        }),
      ];
    }
    const findings: Finding[] = [];
    graph.forEach((node, index) => {
      if (!isRecord(node)) {
        findings.push(
          makeFinding({
            ruleId: 'structure.malformed-graph',
            severity: 'error',
            category: 'structure',
            message: `@graph item ${index} is not an object.`,
            path: `${graphPath}[${index}]`,
            scriptIndex,
            property: '@graph',
          }),
        );
        return;
      }
      if (!('@type' in node)) {
        findings.push(
          makeFinding({
            ruleId: 'structure.missing-type',
            severity: 'warning',
            category: 'structure',
            message: '@graph node has no @type.',
            path: `${graphPath}[${index}]`,
            scriptIndex,
            property: '@type',
          }),
        );
      }
    });
    return findings;
  }

  if (isRecord(graph)) {
    if (!('@type' in graph)) {
      return [
        makeFinding({
          ruleId: 'structure.missing-type',
          severity: 'warning',
          category: 'structure',
          message: '@graph node has no @type. A single object is accepted, but it should still be a typed node.',
          path: graphPath,
          scriptIndex,
          property: '@type',
        }),
      ];
    }
    return [];
  }

  return [
    makeFinding({
      ruleId: 'structure.malformed-graph',
      severity: 'error',
      category: 'structure',
      message: '@graph must be an object or an array of objects.',
      path: graphPath,
      scriptIndex,
      property: '@graph',
    }),
  ];
}

function isExpectedEntityPath(path: string): boolean {
  return path === '$' || /^\$\[\d+\]$/.test(path);
}

function fingerprint(value: Record<string, unknown>): string {
  const keys = Object.keys(value)
    .filter((key) => key !== '@context')
    .sort()
    .slice(0, 80);
  return keys
    .map((key) => {
      const current = value[key];
      if (current === null) return `${key}:null`;
      if (typeof current !== 'object') return `${key}:${JSON.stringify(current)}`;
      if (Array.isArray(current)) return `${key}:array:${current.length}`;
      return `${key}:object`;
    })
    .join('|')
    .slice(0, 2000);
}

function duplicateIdFindings(ids: IdUse[]): Finding[] {
  const groups = new Map<string, IdUse[]>();
  for (const use of ids) {
    const group = groups.get(use.id);
    if (group) group.push(use);
    else groups.set(use.id, [use]);
  }
  const findings: Finding[] = [];
  for (const [id, uses] of groups) {
    if (uses.length < 2) continue;
    const first = uses[0];
    if (!first) continue;
    const typesDiffer = uses.some((use) => use.types.join('|') !== first.types.join('|'));
    const valuesDiffer = uses.some((use) => use.fingerprint !== first.fingerprint);
    const where = uses.map((use) => `script ${use.scriptIndex} ${use.path}`).join('; ');
    if (typesDiffer) {
      findings.push(
        makeFinding({
          ruleId: 'structure.conflicting-id',
          severity: 'warning',
          category: 'structure',
          message: `@id ${id} is defined more than once with different @type values (${where}).`,
          path: first.path,
          scriptIndex: first.scriptIndex,
          property: '@id',
        }),
      );
    } else if (valuesDiffer) {
      findings.push(
        makeFinding({
          ruleId: 'structure.conflicting-id',
          severity: 'warning',
          category: 'structure',
          message: `@id ${id} is defined more than once with different properties (${where}).`,
          path: first.path,
          scriptIndex: first.scriptIndex,
          property: '@id',
        }),
      );
    } else {
      findings.push(
        makeFinding({
          ruleId: 'structure.duplicate-id',
          severity: 'info',
          category: 'structure',
          message: `@id ${id} is repeated with the same types and top-level values (${where}).`,
          path: first.path,
          scriptIndex: first.scriptIndex,
          property: '@id',
        }),
      );
    }
  }
  return findings;
}
