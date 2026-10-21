import { isRecord } from '../shared/json';
import { readTypeValue } from '../parser/type-names';
import { isSubtypeOf } from './schema-org-vocabulary';

const PRIMITIVE_EXPECTATIONS = new Set([
  'Text',
  'URL',
  'Boolean',
  'Integer',
  'Number',
  'Date',
  'DateTime',
  'Duration',
]);

export function literalValue(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if ('@value' in value) return value['@value'];
  return value;
}

export function isDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(
    value.trim(),
  );
}

export function isDurationLike(value: string): boolean {
  return /^P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/i.test(
    value.trim(),
  );
}

function isNumberLike(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) return true;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return true;
  return false;
}

function isIntegerLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return true;
  return false;
}

function matchesTypedObject(value: unknown, expected: string): boolean {
  if (typeof value === 'string' && value.trim().length > 0) return true;
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === '@id' && typeof value['@id'] === 'string') return true;
  if (!('@type' in value)) return typeof value['@id'] === 'string';
  const types = readTypeValue(value['@type']);
  if (types.compact.length === 0) return false;
  return types.compact.some((typeName) => typeName === expected || isSubtypeOf(typeName, expected));
}

export function matchesOne(value: unknown, expected: string): boolean {
  const literal = literalValue(value);
  switch (expected) {
    case 'Text':
      return typeof literal === 'string';
    case 'URL':
      return typeof literal === 'string' && literal.trim().length > 0;
    case 'Boolean':
      return (
        typeof literal === 'boolean' ||
        literal === 'true' ||
        literal === 'false' ||
        literal === 'https://schema.org/True' ||
        literal === 'https://schema.org/False'
      );
    case 'Integer':
      return isIntegerLike(literal);
    case 'Number':
      return isNumberLike(literal) || matchesTypedObject(value, 'QuantitativeValue');
    case 'Date':
    case 'DateTime':
      return typeof literal === 'string' && isDateLike(literal);
    case 'Duration':
      return typeof literal === 'string' && isDurationLike(literal);
    default:
      return matchesTypedObject(value, expected);
  }
}

export function propertyMatches(value: unknown, expectations: readonly string[]): boolean {
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) return false;
  return values.every((item) => expectations.some((expected) => matchesOne(item, expected)));
}

export function isPrimitiveExpectation(expected: string): boolean {
  return PRIMITIVE_EXPECTATIONS.has(expected);
}

export function nonEmptyText(value: unknown): string | null {
  const literal = literalValue(value);
  if (typeof literal !== 'string') return null;
  const trimmed = literal.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasPresentValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
