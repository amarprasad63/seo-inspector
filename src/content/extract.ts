import { LIMITS, type Limits } from '../shared/limits';
import type { ExtractedScript, PageExtraction } from '../shared/types';
import { parseScript, preprocessJsonLd } from '../parser/jsonld-parser';
import { collectPage } from './collect-page';
import { isJsonLdScriptElement } from './dom-filter';

export function collectJsonLd(
  doc: Document,
  limits: Partial<Limits> = {},
  register?: (id: string, element: Element) => void,
): PageExtraction {
  const active = { ...LIMITS, ...limits };
  const elements = [...doc.querySelectorAll('script')].filter((element) => isJsonLdScriptElement(element));
  const scripts = elements.map((element, index) => readScript(element, index, active));
  return {
    url: doc.URL,
    title: doc.title,
    extractedAt: new Date().toISOString(),
    scripts,
    snapshot: collectPage(doc, active, register),
  };
}

function readScript(element: Element, index: number, limits: Limits): ExtractedScript {
  const full = element.textContent ?? '';
  const originalLength = full.length;
  const truncated = originalLength > limits.maxRetainedChars;
  const raw = truncated ? full.slice(0, limits.maxRetainedChars) : full;
  const base = {
    index,
    elementId: element.id ? element.id : null,
    raw,
    originalLength,
    truncated,
  };

  if (preprocessJsonLd(raw).length === 0) {
    return {
      ...base,
      parseStatus: 'empty',
      parseError: 'JSON-LD script is empty.',
    };
  }

  if (truncated) {
    return {
      ...base,
      parseStatus: 'error',
      parseError: `This JSON-LD script is ${originalLength.toLocaleString('en-US')} characters and exceeds the ${limits.maxRetainedChars.toLocaleString('en-US')} character retention limit. The first ${limits.maxRetainedChars.toLocaleString('en-US')} characters were kept and recorded as truncated. The omitted tail is not recoverable from this inspection.`,
    };
  }

  if (raw.length > limits.maxParseOnPageChars) {
    return {
      ...base,
      parseStatus: 'deferred',
      parseError: null,
    };
  }

  const parsed = parseScript({
    index,
    elementId: base.elementId,
    raw,
    originalLength,
    truncated: false,
  });
  return {
    ...base,
    parseStatus: parsed.parseStatus,
    parseError: parsed.parseError,
  };
}
