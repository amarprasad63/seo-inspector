import { joinPath } from '../shared/json';
import type { SchemaEntity } from '../shared/types';
import { makeFinding } from './finding';
import type { Finding } from './types';
import { nonEmptyText } from './value-shape';

const URL_PROPERTIES = ['image', 'logo', 'thumbnailUrl', 'contentUrl', 'embedUrl'] as const;

/**
 * Informational SEO notes. These are not errors and they are not Google eligibility.
 */
export function evaluateRecommendations(entities: readonly SchemaEntity[]): Finding[] {
  const findings: Finding[] = [];
  for (const entity of entities) {
    for (const property of URL_PROPERTIES) {
      const value = entity.value[property];
      if (value == null) continue;
      const values = Array.isArray(value) ? value : [value];
      values.forEach((item, index) => {
        const text = nonEmptyText(item);
        if (!text || !isRelativeUrl(text)) return;
        const path = Array.isArray(value) ? `${joinPath(entity.path, property)}[${index}]` : joinPath(entity.path, property);
        findings.push(
          makeFinding({
            ruleId: 'recommendation.relative-url',
            severity: 'info',
            category: 'recommendation',
            message: `${property} is a relative URL. Absolute URLs are easier for rich-result consumers to resolve.`,
            path,
            scriptIndex: entity.scriptIndex,
            property,
            entityType: entity.types.join(', '),
          }),
        );
      });
    }
  }
  return findings;
}

function isRelativeUrl(value: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (value.startsWith('//') || value.startsWith('#') || value.startsWith('{')) return false;
  return true;
}
