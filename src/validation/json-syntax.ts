import { LIMITS } from '../shared/limits';
import { isRecord } from '../shared/json';
import type { ParsedScript } from '../shared/types';
import { makeFinding } from './finding';
import type { Finding } from './types';

export function evaluateSyntax(script: ParsedScript): Finding[] {
  const findings: Finding[] = [];
  if (script.truncated) {
    findings.push(
      makeFinding({
        ruleId: 'syntax.truncated',
        severity: 'error',
        category: 'syntax',
        message: script.parseError ?? `Script ${script.index} exceeded the retention limit and was not parsed.`,
        path: '$',
        scriptIndex: script.index,
      }),
    );
    return findings;
  }

  if (script.parseStatus === 'empty') {
    findings.push(
      makeFinding({
        ruleId: 'syntax.empty',
        severity: 'error',
        category: 'syntax',
        message: 'JSON-LD script is empty.',
        path: '$',
        scriptIndex: script.index,
      }),
    );
    return findings;
  }

  if (script.parseStatus === 'error') {
    findings.push(
      makeFinding({
        ruleId: 'syntax.invalid-json',
        severity: 'error',
        category: 'syntax',
        message: script.parseError
          ? `Malformed JSON: ${script.parseError}`
          : 'Malformed JSON.',
        path: '$',
        scriptIndex: script.index,
      }),
    );
    return findings;
  }

  if (!isRecord(script.data) && !Array.isArray(script.data)) {
    const kind = script.data === null ? 'null' : typeof script.data;
    findings.push(
      makeFinding({
        ruleId: 'syntax.primitive-root',
        severity: 'error',
        category: 'syntax',
        message: `JSON-LD root is ${kind}. A script is expected to contain an object, an array of nodes, or an object with @graph. The raw script was kept.`,
        path: '$',
        scriptIndex: script.index,
      }),
    );
  }

  if (script.raw.length > LIMITS.maxParseOnPageChars) {
    findings.push(
      makeFinding({
        ruleId: 'syntax.large-script',
        severity: 'info',
        category: 'syntax',
        message: `This script is ${script.raw.length.toLocaleString('en-US')} characters. It was parsed in the extension, not on the page thread, so the site stays responsive.`,
        path: '$',
        scriptIndex: script.index,
      }),
    );
  }

  return findings;
}
