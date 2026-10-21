import type { SchemaEntity } from '../shared/types';
import type { Finding, FindingCategory, Severity } from '../validation/types';
import type { ParsedScript } from '../shared/types';

export function entityMatches(entity: SchemaEntity, query: string): boolean {
  if (!query) return true;
  const name = previewText(entity.value);
  const identifier = typeof entity.value['@id'] === 'string' ? entity.value['@id'] : '';
  const haystack = [entity.types.join(' '), entity.rawTypes.join(' '), entity.path, String(entity.scriptIndex), name, identifier]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function findingMatches(
  finding: Finding,
  query: string,
  severities: ReadonlySet<Severity>,
  categories: ReadonlySet<FindingCategory>,
): boolean {
  if (!severities.has(finding.severity)) return false;
  if (!categories.has(finding.category)) return false;
  if (!query) return true;
  const haystack = [finding.ruleId, finding.message, finding.path, finding.property ?? '', finding.entityType ?? '', String(finding.scriptIndex)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function scriptMatches(script: ParsedScript, query: string): boolean {
  if (!query) return true;
  return `${script.index} ${script.elementId ?? ''} ${script.raw}`.toLowerCase().includes(query);
}

export function entitySeverity(entity: SchemaEntity, findings: readonly Finding[]): Severity | 'ok' {
  let status: Severity | 'ok' = 'ok';
  for (const finding of findings) {
    if (finding.scriptIndex !== entity.scriptIndex) continue;
    if (!pathBelongsTo(entity.path, finding.path)) continue;
    if (finding.severity === 'error') return 'error';
    if (finding.severity === 'warning') status = 'warning';
    else if (status === 'ok') status = 'info';
  }
  return status;
}

export function pathBelongsTo(entityPath: string, findingPath: string): boolean {
  return (
    findingPath === entityPath ||
    findingPath.startsWith(`${entityPath}.`) ||
    findingPath.startsWith(`${entityPath}[`)
  );
}

function previewText(value: Record<string, unknown>): string {
  for (const key of ['name', 'headline', 'title', 'text']) {
    const current = value[key];
    if (typeof current === 'string') return current;
  }
  return '';
}
