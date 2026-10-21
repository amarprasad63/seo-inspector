import type { PageExtraction } from '../shared/types';
import type { Analysis } from '../validation/engine';
import { evaluateAnchors } from './anchors';
import { evaluateContent } from './content-quality';
import { mergeOutcomes } from './finding';
import { evaluateHeadings } from './headings';
import { evaluateImages } from './images';
import { evaluateIndexability } from './indexability';
import { evaluateKeywords } from './keywords';
import { evaluateMetadata } from './metadata';
import { scoreAudit } from './score';
import { evaluateSocial } from './social';
import { structuredFromJsonLd } from './structured';
import { evaluateTechnical } from './technical';
import { EMPTY_TARGETS, type AuditFinding, type KeywordTargets, type SeoAudit } from './types';

const PER_RULE_CAP = 25;

export interface AuditOptions {
  targets?: KeywordTargets;
  disabledRuleIds?: ReadonlySet<string>;
}

export function auditPage(extraction: PageExtraction, analysis: Analysis | null, options: AuditOptions = {}): SeoAudit {
  const targets = options.targets ?? EMPTY_TARGETS;
  const disabled = options.disabledRuleIds ?? new Set<string>();
  const snapshot = extraction.snapshot;
  if (!snapshot) {
    const structured = structuredFromJsonLd(analysis?.findings ?? []);
    const score = scoreAudit(structured.findings, disabled);
    return {
      summary: emptySummary(score.score, analysis?.entities.length ?? 0, 'On-page signals were not in this payload.'),
      score,
      findings: capFindings(structured.findings.filter((item) => !disabled.has(item.ruleId))).findings,
      passed: [],
      unavailable: [
        {
          ruleId: 'audit.snapshot-missing',
          name: 'On-page snapshot',
          category: 'technical',
          reason: 'This payload has JSON-LD only. Metadata, headings, links, and images were not collected, so those checks were not passed or failed.',
        },
      ],
      keywords: {
        analyzedWords: 0,
        textSource: 'No page text was collected.',
        truncated: false,
        includedText: '',
        rows: [],
        notes: [],
      },
      headingOutline: [],
      openGraph: {},
      twitter: {},
      preview: { title: extraction.title, description: '', url: extraction.url, image: '', imageAlt: '', card: '', source: 'Page title only' },
      findingsOmitted: 0,
    };
  }

  const metadata = evaluateMetadata(snapshot, targets);
  const keywords = evaluateKeywords(snapshot, targets);
  const headings = evaluateHeadings(snapshot);
  const social = evaluateSocial(snapshot);
  const images = evaluateImages(snapshot);
  const anchors = evaluateAnchors(snapshot);
  const indexability = evaluateIndexability(snapshot);
  const content = evaluateContent(snapshot);
  const technical = evaluateTechnical(snapshot);
  const structured = structuredFromJsonLd(analysis?.findings ?? []);
  const merged = mergeOutcomes([metadata, keywords.outcome, headings.outcome, social.outcome, images, anchors, indexability, content, technical, structured]);
  const score = scoreAudit(merged.findings, disabled);
  const active = merged.findings.filter((item) => !disabled.has(item.ruleId));
  const capped = capFindings(active);
  const errors = active.filter((item) => item.severity === 'error').length;
  const warnings = active.filter((item) => item.severity === 'warning').length;
  const info = active.filter((item) => item.severity === 'info').length;
  const metadataPassed = merged.passed.filter((item) => item.category === 'metadata').length;
  const metadataIssues = active.filter((item) => item.category === 'metadata' && item.severity !== 'info').length;
  const headingIssue = active.find((item) => item.ruleId === 'headings.missing-h1' || item.ruleId === 'headings.multiple-h1' || item.ruleId === 'headings.skip');
  const missingAlt = active.filter((item) => item.ruleId === 'images.missing-alt').length;
  const internalLinks = snapshot.anchors.filter((anchor) => anchor.className === 'internal').length;
  const externalLinks = snapshot.anchors.filter((anchor) => anchor.className === 'external').length;
  const indexabilityFinding = active.find((item) => item.ruleId === 'indexability.noindex');

  return {
    summary: {
      score: score.score,
      errors,
      warnings,
      info,
      passed: merged.passed.filter((item) => !disabled.has(item.ruleId)).length,
      metadataStatus: metadataIssues > 0 ? `${metadataIssues} metadata issues` : `${metadataPassed} metadata checks passed`,
      headingStatus: headingIssue ? headingIssue.message : snapshot.headings.length ? 'Visible heading outline collected' : 'No headings collected',
      imageStatus: missingAlt > 0 ? `${missingAlt} images missing alt` : snapshot.images.length ? 'Collected images have alt attributes' : 'No images collected',
      internalLinks,
      externalLinks,
      entities: analysis?.entities.length ?? 0,
      indexability: indexabilityFinding ? 'noindex or none found — indexing status unknown' : 'No noindex directive in the collected meta tags',
    },
    score,
    findings: capped.findings,
    passed: merged.passed.filter((item) => !disabled.has(item.ruleId)),
    unavailable: merged.unavailable,
    keywords: keywords.report,
    headingOutline: headings.outline,
    openGraph: social.openGraph,
    twitter: social.twitter,
    preview: social.preview,
    findingsOmitted: capped.omitted,
  };
}

function capFindings(findings: AuditFinding[]): { findings: AuditFinding[]; omitted: number } {
  const groups = new Map<string, AuditFinding[]>();
  for (const item of findings) {
    const list = groups.get(item.ruleId) ?? [];
    list.push(item);
    groups.set(item.ruleId, list);
  }
  const kept: AuditFinding[] = [];
  let omitted = 0;
  for (const list of groups.values()) {
    kept.push(...list.slice(0, PER_RULE_CAP));
    if (list.length > PER_RULE_CAP) {
      omitted += list.length - PER_RULE_CAP;
      const sample = list[0]!;
      kept.push({
        ...sample,
        id: `${sample.ruleId}|omitted`,
        message: `${list.length - PER_RULE_CAP} more instances of ${sample.ruleId} were omitted from this list. They still count as one rule in the score.`,
        evidence: `${list.length} instances`,
      });
    }
  }
  const rank = { error: 0, warning: 1, info: 2 };
  kept.sort((left, right) => rank[left.severity] - rank[right.severity] || left.ruleId.localeCompare(right.ruleId));
  return { findings: kept, omitted };
}

function emptySummary(score: number | null, entities: number, indexability: string): SeoAudit['summary'] {
  return {
    score,
    errors: 0,
    warnings: 0,
    info: 0,
    passed: 0,
    metadataStatus: 'Not collected',
    headingStatus: 'Not collected',
    imageStatus: 'Not collected',
    internalLinks: 0,
    externalLinks: 0,
    entities,
    indexability,
  };
}
