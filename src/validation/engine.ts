import { discoverEntities } from '../parser/entity-discovery';
import { parseScript } from '../parser/jsonld-parser';
import { LIMITS } from '../shared/limits';
import type { PageExtraction, ParsedScript, SchemaEntity } from '../shared/types';
import { makeFinding } from './finding';
import { evaluateGoogleRules } from './google-rich-results';
import { evaluateSyntax } from './json-syntax';
import { evaluateStructure } from './jsonld-structure';
import { evaluateRecommendations } from './recommendations';
import { evaluateSchemaOrg } from './schema-org-rules';
import { SEVERITY_RANK, type Finding } from './types';

export interface Analysis {
  scripts: ParsedScript[];
  entities: SchemaEntity[];
  findings: Finding[];
}

export function analyzePage(extraction: PageExtraction): Analysis {
  const scripts = extraction.scripts.map((script) =>
    parseScript({
      index: script.index,
      elementId: script.elementId,
      raw: script.raw,
      originalLength: script.originalLength,
      truncated: script.truncated,
    }),
  );
  return analyzeScripts(scripts);
}

export function analyzeScripts(scripts: readonly ParsedScript[]): Analysis {
  const syntax = scripts.flatMap((script) => evaluateSyntax(script));
  const structure = evaluateStructure(scripts);
  const discovery = discoverEntities(scripts);
  const schema = evaluateSchemaOrg(discovery.entities);
  const google = evaluateGoogleRules(discovery.entities);
  const recommendations = evaluateRecommendations(discovery.entities);
  const findings = dedupeAndSort([
    ...syntax,
    ...structure,
    ...discovery.notes,
    ...schema,
    ...google,
    ...recommendations,
  ]);
  return {
    scripts: [...scripts],
    entities: discovery.entities,
    findings: capFindings(findings),
  };
}

function dedupeAndSort(findings: Finding[]): Finding[] {
  const map = new Map<string, Finding>();
  for (const finding of findings) {
    if (!map.has(finding.id)) map.set(finding.id, finding);
  }
  return [...map.values()].sort(
    (left, right) =>
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
      left.scriptIndex - right.scriptIndex ||
      left.path.localeCompare(right.path) ||
      left.ruleId.localeCompare(right.ruleId),
  );
}

function capFindings(findings: Finding[]): Finding[] {
  if (findings.length <= LIMITS.maxFindings) return findings;
  const omitted = findings.length - (LIMITS.maxFindings - 1);
  const kept = findings.slice(0, LIMITS.maxFindings - 1);
  kept.push(
    makeFinding({
      ruleId: 'engine.finding-limit',
      severity: 'info',
      category: 'structure',
      message: `Validation stopped after ${LIMITS.maxFindings.toLocaleString('en-US')} findings. ${omitted.toLocaleString('en-US')} additional findings were not generated. The limit is configurable (LIMITS.maxFindings). Raw scripts and parsed JSON are still included in export.`,
      path: '$',
      scriptIndex: 0,
    }),
  );
  return kept;
}
