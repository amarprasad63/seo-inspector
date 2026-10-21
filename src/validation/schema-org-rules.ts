import { readTypeValue } from '../parser/type-names';
import { joinPath } from '../shared/json';
import type { SchemaEntity } from '../shared/types';
import { makeFinding } from './finding';
import {
  JSONLD_KEYWORDS,
  expectationsFor,
  isKnownType,
  isSubtypeOf,
} from './schema-org-vocabulary';
import type { Finding } from './types';
import { propertyMatches } from './value-shape';

/**
 * Local Schema.org subset checks.
 * Unknown types and unknown properties are informational: this module does
 * not claim complete Schema.org conformance, and unfamiliar vocabulary is
 * not treated as an error.
 */
export function evaluateSchemaOrg(entities: readonly SchemaEntity[]): Finding[] {
  const findings: Finding[] = [];
  for (const entity of entities) {
    findings.push(...checkEntity(entity));
  }
  return findings;
}

function checkEntity(entity: SchemaEntity): Finding[] {
  const findings: Finding[] = [];
  const recognized = entity.types.filter((typeName) => isKnownType(typeName));
  const unknownTypes = entity.types.filter((typeName) => !isKnownType(typeName));

  if (recognized.length === 0) {
    findings.push(
      makeFinding({
        ruleId: 'schema.unknown-type',
        severity: 'info',
        category: 'schema-org',
        message: `None of the types are in the local Schema.org subset (${entity.types.join(', ') || 'none'}). Property checks were not applied. This is not a conformance failure.`,
        path: entity.path,
        scriptIndex: entity.scriptIndex,
        property: '@type',
        entityType: entity.types.join(', '),
      }),
    );
    return findings;
  }

  if (unknownTypes.length > 0) {
    findings.push(
      makeFinding({
        ruleId: 'schema.unknown-type',
        severity: 'info',
        category: 'schema-org',
        message: `Additional @type values are outside the local Schema.org subset: ${unknownTypes.join(', ')}. Checks use the recognized types only (${recognized.join(', ')}).`,
        path: entity.path,
        scriptIndex: entity.scriptIndex,
        property: '@type',
        entityType: entity.types.join(', '),
      }),
    );
  }

  const unknownProperties: string[] = [];
  for (const key of Object.keys(entity.value)) {
    if (JSONLD_KEYWORDS.has(key)) continue;
    const expectations = expectationsFor(recognized, key);
    if (expectations === null || expectations.length === 0) {
      unknownProperties.push(key);
      continue;
    }
    const value = entity.value[key];
    if (value == null) continue;
    if (!propertyMatches(value, expectations)) {
      const typeFindings = nestedTypeMismatch(entity, key, value, expectations, recognized);
      if (typeFindings.length > 0) findings.push(...typeFindings);
      else {
        findings.push(
          makeFinding({
            ruleId: 'schema.value-shape',
            severity: 'warning',
            category: 'schema-org',
            message: `${key} does not match the expected value for ${recognized.join(' / ')} (${expectations.join(' or ')}).`,
            path: entity.path,
            scriptIndex: entity.scriptIndex,
            property: key,
            entityType: recognized.join(', '),
          }),
        );
      }
    }
  }

  if (unknownProperties.length > 0) {
    const listed = unknownProperties.slice(0, 8).join(', ');
    const extra = unknownProperties.length > 8 ? ` (+${unknownProperties.length - 8} more)` : '';
    findings.push(
      makeFinding({
        ruleId: 'schema.unknown-properties',
        severity: 'info',
        category: 'schema-org',
        message: `These properties are not in the local Schema.org subset for ${recognized.join(' / ')}: ${listed}${extra}. The subset is incomplete, so this is not a conformance failure.`,
        path: entity.path,
        scriptIndex: entity.scriptIndex,
        entityType: recognized.join(', '),
      }),
    );
  }

  return findings;
}

function nestedTypeMismatch(
  entity: SchemaEntity,
  property: string,
  value: unknown,
  expectations: readonly string[],
  recognized: readonly string[],
): Finding[] {
  const typeExpectations = expectations.filter((item) => !PRIMITIVES.has(item));
  if (typeExpectations.length === 0) return [];
  const values = Array.isArray(value) ? value : [value];
  const findings: Finding[] = [];
  values.forEach((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    if (!('@type' in record)) return;
    const types = readTypeValue(record['@type']);
    if (types.compact.length === 0) return;
    const matches = types.compact.some((typeName) =>
      typeExpectations.some((expected) => typeName === expected || isSubtypeOf(typeName, expected)),
    );
    if (matches) return;
    const propertyPath = joinPath(entity.path, property);
    const itemPath = Array.isArray(value) ? `${propertyPath}[${index}]` : propertyPath;
    findings.push(
      makeFinding({
        ruleId: 'schema.type-combination',
        severity: 'warning',
        category: 'schema-org',
        message: `${property} @type ${types.compact.join(', ')} is not one of the types expected by ${recognized.join(' / ')} (${typeExpectations.join(' or ')}).`,
        path: itemPath,
        scriptIndex: entity.scriptIndex,
        property,
        entityType: recognized.join(', '),
      }),
    );
  });
  return findings;
}

const PRIMITIVES = new Set(['Text', 'URL', 'Boolean', 'Integer', 'Number', 'Date', 'DateTime', 'Duration']);
