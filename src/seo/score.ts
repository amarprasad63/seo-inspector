import type {
  AuditCategory,
  AuditFinding,
  AuditKind,
  AuditSeverity,
  GroupScore,
  PassedCheck,
  ScoreContribution,
  ScoreCoverage,
  ScoreDeduction,
  ScoreGroup,
  ScoreOverlap,
  ScoreReport,
  UnavailableCheck,
} from './types';

/**
 * Penalties live here only.
 * Error 10 and warning 3 are the cost of one rule, not of each element.
 * Info is recorded and does not change a score.
 *
 * Which score a rule changes is also decided here, not by editing severities:
 * - On-page SEO: title, description, indexability, technical defects, invalid JSON-LD.
 * - Accessibility: accessible names, unlabeled controls, iframe titles, missing H1, missing alt.
 *   Those stay warnings because they matter to people using the page. They are not ranking defects.
 * - Social: Open Graph and Twitter tags. A missing og:url is a sharing gap, not an SEO error.
 * - Structured data: schema and rich-result eligibility. Invalid JSON stays on the SEO score.
 *
 * Duplicate ids stay an SEO warning. They can break fragments and references, and the impact
 * depends on whether anything uses the id, so they are not raised to an error.
 */
export const SCORE_WEIGHTS: Record<AuditSeverity, number> = {
  error: 10,
  warning: 3,
  info: 0,
};

/** Coverage under this percent is labeled provisional. Disabled rules are not in the denominator. */
export const COVERAGE_PROVISIONAL_BELOW = 70;

export const SCORE_GROUP_LABEL: Record<ScoreGroup, string> = {
  seo: 'On-page SEO',
  accessibility: 'Accessibility',
  social: 'Social metadata',
  'structured-data': 'Structured data',
};

const GROUP_ORDER: readonly ScoreGroup[] = ['seo', 'accessibility', 'social', 'structured-data'];

/**
 * Rules that describe one underlying issue. Only the strongest deducts.
 * The others stay visible and record which rule took the points.
 * Preference is list order when the penalties are equal, so the result does not depend on finding order.
 */
const OVERLAP_GROUPS: readonly (readonly string[])[] = [
  ['indexability.canonical-multiple', 'indexability.canonical-empty', 'indexability.canonical-relative', 'indexability.canonical-invalid'],
  ['indexability.robots-conflict', 'indexability.noindex'],
  ['social.missing-og:image', 'social.empty-og:image', 'social.twitter-image'],
];

const ACCESSIBILITY_PASSED = new Set(['headings.single-h1', 'images.alt-present']);

export const SCORE_METHODOLOGY =
  'The on-page SEO score starts at 100. Each SEO rule deducts once, using its strongest severity: error 10, warning 3, info 0. Repeated elements of the same rule do not deduct again; the instance count is how many elements matched. Accessibility, social metadata, and structured-data eligibility have their own scores and do not change the on-page number. When two rules describe the same issue, only one deducts. Disabled rules and checks that could not be evaluated are excluded and are not treated as passed. This is an internal diagnostic, not a Google ranking score. Changing it does not guarantee a ranking change.';

export interface ScoreInput {
  findings: readonly AuditFinding[];
  passed?: readonly PassedCheck[];
  unavailable?: readonly UnavailableCheck[];
  disabled: ReadonlySet<string>;
  /** False when the DOM snapshot was missing. Coverage percent stays null because the denominator is unknown. */
  onPageCollected: boolean;
}

interface RuleTally {
  ruleId: string;
  group: ScoreGroup;
  severity: AuditSeverity;
  points: number;
  instances: number;
}

export function scoreGroupFor(ruleId: string, category: AuditCategory, kind?: AuditKind): ScoreGroup {
  if (category === 'social' || ruleId.startsWith('social.')) return 'social';
  if (category === 'accessibility' || kind === 'accessibility' || ACCESSIBILITY_PASSED.has(ruleId)) return 'accessibility';
  if (ruleId.startsWith('jsonld.syntax.') || ruleId.startsWith('jsonld.structure.')) return 'seo';
  if (category === 'structured-data' || ruleId.startsWith('jsonld.')) return 'structured-data';
  return 'seo';
}

export function scoreAudit(input: ScoreInput): ScoreReport {
  const disabled = input.disabled;
  const passed = input.passed ?? [];
  const unavailable = input.unavailable ?? [];
  const active = input.findings.filter((item) => !disabled.has(item.ruleId));
  const byRule = new Map<string, AuditFinding[]>();
  for (const item of active) {
    const list = byRule.get(item.ruleId) ?? [];
    list.push(item);
    byRule.set(item.ruleId, list);
  }

  const tallies: RuleTally[] = [];
  for (const [ruleId, list] of byRule) {
    const worst = [...list].sort((left, right) => SCORE_WEIGHTS[right.severity] - SCORE_WEIGHTS[left.severity] || left.id.localeCompare(right.id))[0]!;
    tallies.push({
      ruleId,
      group: scoreGroupFor(ruleId, worst.category, worst.kind),
      severity: worst.severity,
      points: SCORE_WEIGHTS[worst.severity],
      instances: list.length,
    });
  }
  tallies.sort((left, right) => left.ruleId.localeCompare(right.ruleId));

  const countedAs = resolveOverlaps(tallies);
  const contributions: ScoreContribution[] = tallies.map((tally) => ({
    ruleId: tally.ruleId,
    group: tally.group,
    groupLabel: SCORE_GROUP_LABEL[tally.group],
    severity: tally.severity,
    points: countedAs.has(tally.ruleId) ? 0 : tally.points,
    instances: tally.instances,
    countedAs: countedAs.get(tally.ruleId) ?? null,
  }));

  const groups = GROUP_ORDER.map((group) => buildGroup(group, tallies, countedAs, passed, disabled));
  const seo = groups[0]!;
  const evaluatedIds = new Set<string>();
  for (const tally of tallies) evaluatedIds.add(tally.ruleId);
  for (const check of passed) {
    if (!disabled.has(check.ruleId)) evaluatedIds.add(check.ruleId);
  }
  const unevaluatedIds = new Set<string>();
  for (const check of unavailable) {
    if (check.countsTowardCoverage === false) continue;
    if (disabled.has(check.ruleId) || evaluatedIds.has(check.ruleId)) continue;
    unevaluatedIds.add(check.ruleId);
  }

  const coverage = buildCoverage({
    evaluated: evaluatedIds.size,
    unevaluated: unevaluatedIds.size,
    disabled: disabled.size,
    onPageCollected: input.onPageCollected,
  });

  return {
    score: seo.score,
    label: 'On-page SEO score. Not a Google ranking score.',
    methodology: SCORE_METHODOLOGY,
    deductions: seo.deductions,
    groups,
    contributions,
    coverage,
    excludedRuleIds: [...disabled].sort((left, right) => left.localeCompare(right)),
    infoIgnored: tallies.filter((tally) => tally.points === 0).length,
  };
}

function resolveOverlaps(tallies: readonly RuleTally[]): Map<string, string> {
  const byId = new Map(tallies.map((tally) => [tally.ruleId, tally]));
  const countedAs = new Map<string, string>();
  for (const group of OVERLAP_GROUPS) {
    const present = group
      .map((ruleId) => byId.get(ruleId))
      .filter((tally): tally is RuleTally => tally != null && tally.points > 0);
    if (present.length < 2) continue;
    const winner = [...present].sort((left, right) => {
      const pointGap = right.points - left.points;
      if (pointGap !== 0) return pointGap;
      return group.indexOf(left.ruleId) - group.indexOf(right.ruleId);
    })[0]!;
    for (const tally of present) {
      if (tally.ruleId !== winner.ruleId) countedAs.set(tally.ruleId, winner.ruleId);
    }
  }
  return countedAs;
}

function buildGroup(
  group: ScoreGroup,
  tallies: readonly RuleTally[],
  countedAs: ReadonlyMap<string, string>,
  passed: readonly PassedCheck[],
  disabled: ReadonlySet<string>,
): GroupScore {
  const mine = tallies.filter((tally) => tally.group === group);
  const deductions: ScoreDeduction[] = [];
  const overlapped: ScoreOverlap[] = [];
  let total = 0;
  for (const tally of mine) {
    const coveredBy = countedAs.get(tally.ruleId);
    if (coveredBy) {
      overlapped.push({ ruleId: tally.ruleId, countedAs: coveredBy, instances: tally.instances });
      continue;
    }
    if (tally.points === 0) continue;
    deductions.push({ ruleId: tally.ruleId, severity: tally.severity, points: tally.points, instances: tally.instances });
    total += tally.points;
  }
  deductions.sort((left, right) => right.points - left.points || left.ruleId.localeCompare(right.ruleId));
  overlapped.sort((left, right) => left.ruleId.localeCompare(right.ruleId));

  const evaluated = new Set(mine.map((tally) => tally.ruleId));
  for (const check of passed) {
    if (disabled.has(check.ruleId)) continue;
    if (scoreGroupFor(check.ruleId, check.category) === group) evaluated.add(check.ruleId);
  }
  const score = evaluated.size === 0 ? null : clamp(100 - total);
  return { group, label: SCORE_GROUP_LABEL[group], score, deductions, overlapped, evaluated: evaluated.size };
}

function buildCoverage(input: { evaluated: number; unevaluated: number; disabled: number; onPageCollected: boolean }): ScoreCoverage {
  const { evaluated, unevaluated, disabled, onPageCollected } = input;
  const denominator = evaluated + unevaluated;
  const percent = !onPageCollected || denominator === 0 ? null : Math.round((100 * evaluated) / denominator);
  const provisional = !onPageCollected || percent == null || percent < COVERAGE_PROVISIONAL_BELOW;
  const counts = `${evaluated} ${evaluated === 1 ? 'check' : 'checks'} evaluated, ${unevaluated} could not be evaluated, ${disabled} disabled.`;
  let summary: string;
  if (!onPageCollected) {
    summary = `Provisional. ${counts} On-page checks were not collected, so coverage is not calculated. Unevaluated checks are not treated as passed.`;
  } else if (percent == null) {
    summary = `Provisional. ${counts} No applicable checks were recorded, so coverage is not calculated.`;
  } else if (provisional) {
    summary = `Provisional. ${counts} Coverage ${percent}% of applicable checks. Disabled rules are not in that total. The result is incomplete.`;
  } else {
    summary = `${counts} Coverage ${percent}% of applicable checks. Disabled rules are not in that total.`;
  }
  return { evaluated, unevaluated, disabled, percent, provisional, summary };
}

function clamp(score: number): number {
  return Math.min(100, Math.max(0, score));
}
