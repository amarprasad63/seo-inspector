export const AUDIT_REVIEWED = '2026-10-21';

export type AuditSeverity = 'error' | 'warning' | 'info';

export type AuditKind = 'technical' | 'accessibility' | 'best-practice' | 'optional';

export type AuditCategory =
  | 'metadata'
  | 'keywords'
  | 'headings'
  | 'social'
  | 'links'
  | 'images'
  | 'indexability'
  | 'structured-data'
  | 'technical'
  | 'content'
  | 'accessibility'
  | 'recommendations';

export interface AuditFinding {
  id: string;
  ruleId: string;
  name: string;
  category: AuditCategory;
  severity: AuditSeverity;
  kind: AuditKind;
  message: string;
  why: string;
  evidence: string;
  remediation: string;
  highlightId: string | null;
  selectorHint: string | null;
  docsUrl?: string;
  lastReviewed: string;
}

export interface PassedCheck {
  ruleId: string;
  name: string;
  category: AuditCategory;
  summary: string;
}

export interface UnavailableCheck {
  ruleId: string;
  name: string;
  category: AuditCategory;
  reason: string;
  /**
   * False when the check was not requested, such as a keyword the user did not enter.
   * Those checks stay visible and are left out of the coverage denominator.
   */
  countsTowardCoverage?: boolean;
}

export interface RuleOutcome {
  findings: AuditFinding[];
  passed: PassedCheck[];
  unavailable: UnavailableCheck[];
}

export interface KeywordTargets {
  primary: string;
  secondary: string;
  brand: string;
  remember: boolean;
}

export const EMPTY_TARGETS: KeywordTargets = { primary: '', secondary: '', brand: '', remember: false };

export interface KeywordSnippet {
  where: string;
  text: string;
  highlightId: string | null;
}

export interface KeywordRow {
  keyword: string;
  source: 'primary' | 'secondary' | 'brand' | 'automatic';
  occurrences: number;
  frequency: number;
  title: number;
  description: number;
  h1: number;
  headings: number;
  content: number;
  alt: number;
  anchors: number;
  url: number;
  snippets: KeywordSnippet[];
}

export interface KeywordReport {
  analyzedWords: number;
  textSource: string;
  truncated: boolean;
  includedText: string;
  rows: KeywordRow[];
  notes: string[];
}

export interface HeadingNode {
  level: number;
  text: string;
  hidden: boolean;
  highlightId: string;
  selectorHint: string;
  children: HeadingNode[];
}

export type ScoreGroup = 'seo' | 'accessibility' | 'social' | 'structured-data';

export interface ScoreDeduction {
  ruleId: string;
  severity: AuditSeverity;
  points: number;
  instances: number;
}

export interface ScoreOverlap {
  ruleId: string;
  countedAs: string;
  instances: number;
}

export interface ScoreContribution {
  ruleId: string;
  group: ScoreGroup;
  groupLabel: string;
  severity: AuditSeverity;
  /** Points actually deducted. Zero when the finding is informational or already covered by another rule. */
  points: number;
  instances: number;
  /** Set when a related rule already took the deduction for the same issue. */
  countedAs: string | null;
}

export interface GroupScore {
  group: ScoreGroup;
  label: string;
  /** Null when this group had no evaluated check. A missing check is not treated as 100. */
  score: number | null;
  deductions: ScoreDeduction[];
  overlapped: ScoreOverlap[];
  evaluated: number;
}

export interface ScoreCoverage {
  evaluated: number;
  unevaluated: number;
  disabled: number;
  /**
   * evaluated / (evaluated + unevaluated), as a rounded percent.
   * Null when that denominator is 0, or when the page snapshot was not collected.
   */
  percent: number | null;
  provisional: boolean;
  summary: string;
}

export interface ScoreReport {
  /** On-page SEO score. Null when no SEO check was evaluated. */
  score: number | null;
  label: string;
  methodology: string;
  /** Deductions that changed the on-page SEO score. */
  deductions: ScoreDeduction[];
  groups: GroupScore[];
  contributions: ScoreContribution[];
  coverage: ScoreCoverage;
  excludedRuleIds: string[];
  infoIgnored: number;
}

export interface SocialPreview {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  card: string;
  source: string;
}

export interface SeoAudit {
  summary: {
    score: number | null;
    errors: number;
    warnings: number;
    info: number;
    passed: number;
    metadataStatus: string;
    headingStatus: string;
    imageStatus: string;
    internalLinks: number;
    externalLinks: number;
    entities: number;
    indexability: string;
  };
  score: ScoreReport;
  findings: AuditFinding[];
  passed: PassedCheck[];
  unavailable: UnavailableCheck[];
  keywords: KeywordReport;
  headingOutline: HeadingNode[];
  openGraph: Record<string, string[]>;
  twitter: Record<string, string[]>;
  preview: SocialPreview;
  findingsOmitted: number;
}

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  metadata: 'Metadata',
  keywords: 'Keywords',
  headings: 'Headings',
  social: 'Social',
  links: 'Links',
  images: 'Images',
  indexability: 'Indexability',
  'structured-data': 'Structured data',
  technical: 'Technical SEO',
  content: 'Content analysis',
  accessibility: 'Accessibility',
  recommendations: 'Recommendations',
};

export const SECTION_ORDER = [
  'overview',
  'metadata',
  'keywords',
  'headings',
  'social',
  'links',
  'images',
  'indexability',
  'structured',
  'technical',
  'content',
  'recommendations',
] as const;

export type AuditSection = (typeof SECTION_ORDER)[number];

export const SECTION_LABEL: Record<AuditSection, string> = {
  overview: 'Overview',
  metadata: 'Metadata',
  keywords: 'Keywords',
  headings: 'Headings',
  social: 'Social',
  links: 'Links',
  images: 'Images',
  indexability: 'Indexability',
  structured: 'Structured data',
  technical: 'Technical SEO',
  content: 'Content analysis',
  recommendations: 'Recommendations',
};
