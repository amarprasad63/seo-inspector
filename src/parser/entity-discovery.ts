import { makeFinding } from '../validation/finding';
import { LIMITS } from '../shared/limits';
import { isRecord, joinPath } from '../shared/json';
import type { Finding } from '../validation/types';
import type { ParsedScript, SchemaEntity } from '../shared/types';
import { readTypeValue } from './type-names';

export interface DiscoveryResult {
  entities: SchemaEntity[];
  notes: Finding[];
}

interface WalkState {
  entities: SchemaEntity[];
  notes: Finding[];
  visited: number;
  depthLimited: boolean;
  nodeLimited: boolean;
  entityLimited: boolean;
}

export function discoverEntities(scripts: readonly ParsedScript[]): DiscoveryResult {
  const entities: SchemaEntity[] = [];
  const notes: Finding[] = [];

  for (const script of scripts) {
    if (script.parseStatus !== 'ok') continue;
    const state: WalkState = {
      entities,
      notes,
      visited: 0,
      depthLimited: false,
      nodeLimited: false,
      entityLimited: false,
    };
    walk(script.data, '$', script.index, 0, new WeakSet<object>(), state);
    if (state.depthLimited) {
      notes.push(
        makeFinding({
          ruleId: 'discovery.depth-limit',
          severity: 'info',
          category: 'structure',
          message: `Entity discovery stopped descending past depth ${LIMITS.maxDepth} in script ${script.index}. Deeper typed nodes are not listed separately. The parsed JSON retained for this script is unchanged.`,
          path: '$',
          scriptIndex: script.index,
        }),
      );
    }
    if (state.nodeLimited) {
      notes.push(
        makeFinding({
          ruleId: 'discovery.node-limit',
          severity: 'info',
          category: 'structure',
          message: `Entity discovery stopped after visiting ${LIMITS.maxNodes.toLocaleString('en-US')} nodes in script ${script.index}. Additional typed nodes may be missing from the entity list. Export still includes the parsed JSON that was retained.`,
          path: '$',
          scriptIndex: script.index,
        }),
      );
    }
  }

  if (entities.length >= LIMITS.maxEntities) {
    notes.push(
      makeFinding({
        ruleId: 'discovery.entity-limit',
        severity: 'info',
        category: 'structure',
        message: `Entity discovery stopped at ${LIMITS.maxEntities.toLocaleString('en-US')} typed entities. Further entities were not listed. This limit is configurable in the extension source (LIMITS.maxEntities).`,
        path: '$',
        scriptIndex: entities[entities.length - 1]?.scriptIndex ?? 0,
      }),
    );
  }

  entities.sort((left, right) => left.scriptIndex - right.scriptIndex || left.path.localeCompare(right.path));
  return { entities, notes };
}

function walk(
  value: unknown,
  path: string,
  scriptIndex: number,
  depth: number,
  seen: WeakSet<object>,
  state: WalkState,
): void {
  if (state.entityLimited || state.nodeLimited) return;
  state.visited += 1;
  if (state.visited > LIMITS.maxNodes) {
    state.nodeLimited = true;
    return;
  }
  if (depth > LIMITS.maxDepth) {
    state.depthLimited = true;
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      walk(value[index], `${path}[${index}]`, scriptIndex, depth + 1, seen, state);
      if (state.entityLimited || state.nodeLimited) return;
    }
    return;
  }

  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  if ('@type' in value) {
    const types = readTypeValue(value['@type']);
    if (types.compact.length > 0) {
      if (state.entities.length >= LIMITS.maxEntities) {
        state.entityLimited = true;
        return;
      }
      state.entities.push({
        id: `${scriptIndex}|${path}|${types.compact.join('+')}`,
        scriptIndex,
        path,
        types: types.compact,
        rawTypes: types.raw,
        value,
      });
    }
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    if (key === '@context') continue;
    walk(value[key], joinPath(path, key), scriptIndex, depth + 1, seen, state);
    if (state.entityLimited || state.nodeLimited) return;
  }
}
