import type { Finding } from '../validation/types';
import { finding } from './finding';
import type { AuditFinding, RuleOutcome } from './types';

const CATEGORY_KIND: Record<Finding['category'], AuditFinding['kind']> = {
  syntax: 'technical',
  structure: 'technical',
  'schema-org': 'best-practice',
  'google-rich-results': 'best-practice',
  recommendation: 'optional',
};

export function structuredFromJsonLd(jsonLdFindings: readonly Finding[]): RuleOutcome {
  const findings = jsonLdFindings.map((item) =>
    finding({
      ruleId: `jsonld.${item.ruleId}`,
      name: item.ruleId,
      category: 'structured-data',
      severity: item.severity,
      kind: CATEGORY_KIND[item.category],
      message: item.message,
      why: 'This comes from the existing JSON-LD checks. Schema.org coverage is a local subset, and Google checks are local diagnostics, not eligibility.',
      evidence: `${item.path}${item.property ? ` · ${item.property}` : ''}${item.entityType ? ` · ${item.entityType}` : ''}`,
      remediation: 'Open Structured data for the entity, the JSON path, and the raw script.',
      highlightId: null,
      selectorHint: item.scriptIndex >= 0 ? `script ${item.scriptIndex}` : null,
      docsUrl: item.docsUrl,
      lastReviewed: '2026-10-01',
    }),
  );
  return { findings, passed: [], unavailable: [] };
}
