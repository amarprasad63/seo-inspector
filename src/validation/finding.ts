import type { Finding, FindingCategory, Severity } from './types';

export function makeFinding(input: {
  ruleId: string;
  severity: Severity;
  category: FindingCategory;
  message: string;
  path: string;
  scriptIndex: number;
  property?: string;
  entityType?: string;
  docsUrl?: string;
}): Finding {
  const finding: Finding = {
    id: `${input.ruleId}|${input.scriptIndex}|${input.path}|${input.property ?? ''}`,
    ruleId: input.ruleId,
    severity: input.severity,
    category: input.category,
    message: input.message,
    path: input.path,
    scriptIndex: input.scriptIndex,
  };
  if (input.property !== undefined) finding.property = input.property;
  if (input.entityType !== undefined) finding.entityType = input.entityType;
  if (input.docsUrl !== undefined) finding.docsUrl = input.docsUrl;
  return finding;
}
