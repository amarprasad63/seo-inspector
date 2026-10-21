export type Severity = 'error' | 'warning' | 'info';

export type FindingCategory =
  | 'syntax'
  | 'structure'
  | 'schema-org'
  | 'google-rich-results'
  | 'recommendation';

export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  category: FindingCategory;
  message: string;
  path: string;
  scriptIndex: number;
  property?: string;
  entityType?: string;
  docsUrl?: string;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  syntax: 'JSON syntax',
  structure: 'JSON-LD structure',
  'schema-org': 'Schema.org',
  'google-rich-results': 'Google rich results',
  recommendation: 'SEO recommendation',
};
