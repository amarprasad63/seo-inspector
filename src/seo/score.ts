import type { AuditFinding, ScoreReport } from './types';

const WEIGHT: Record<AuditFinding['severity'], number> = {
  error: 10,
  warning: 3,
  info: 0,
};

export const SCORE_METHODOLOGY =
  'The score starts at 100. Each rule id deducts points once, using its strongest severity: error 10, warning 3, info 0. Repeated instances of the same rule do not deduct again. Disabled rules and checks that could not be evaluated are excluded. Info findings stay visible and do not change the score. This is an internal diagnostic, not a Google ranking score. Changing it does not guarantee a ranking change.';

export function scoreAudit(findings: readonly AuditFinding[], disabled: ReadonlySet<string>): ScoreReport {
  const active = findings.filter((item) => !disabled.has(item.ruleId));
  const groups = new Map<string, AuditFinding[]>();
  for (const item of active) {
    const list = groups.get(item.ruleId) ?? [];
    list.push(item);
    groups.set(item.ruleId, list);
  }
  const deductions = [];
  let total = 0;
  let infoIgnored = 0;
  for (const [ruleId, list] of groups) {
    const worst = list.reduce((best, item) => (WEIGHT[item.severity] > WEIGHT[best.severity] ? item : best));
    const points = WEIGHT[worst.severity];
    if (points === 0) {
      infoIgnored += 1;
      continue;
    }
    deductions.push({ ruleId, severity: worst.severity, points, instances: list.length });
    total += points;
  }
  deductions.sort((left, right) => right.points - left.points || left.ruleId.localeCompare(right.ruleId));
  const score = Math.max(0, 100 - total);
  return {
    score,
    label: 'Internal diagnostic score. Not a Google ranking score.',
    methodology: SCORE_METHODOLOGY,
    deductions,
    excludedRuleIds: [...disabled],
    infoIgnored,
  };
}
