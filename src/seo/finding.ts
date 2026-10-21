import { AUDIT_REVIEWED, type AuditFinding, type PassedCheck, type RuleOutcome, type UnavailableCheck } from './types';

export function finding(input: Omit<AuditFinding, 'id' | 'lastReviewed'> & { lastReviewed?: string }): AuditFinding {
  const evidence = input.evidence.slice(0, 240);
  return {
    ...input,
    evidence,
    id: `${input.ruleId}|${input.highlightId ?? ''}|${evidence}`,
    lastReviewed: input.lastReviewed ?? AUDIT_REVIEWED,
  };
}

export function passed(check: PassedCheck): PassedCheck {
  return check;
}

export function unavailable(check: UnavailableCheck): UnavailableCheck {
  return check;
}

export function emptyOutcome(): RuleOutcome {
  return { findings: [], passed: [], unavailable: [] };
}

export function mergeOutcomes(outcomes: RuleOutcome[]): RuleOutcome {
  return {
    findings: outcomes.flatMap((outcome) => outcome.findings),
    passed: outcomes.flatMap((outcome) => outcome.passed),
    unavailable: outcomes.flatMap((outcome) => outcome.unavailable),
  };
}
