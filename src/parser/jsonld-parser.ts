import { LIMITS } from '../shared/limits';
import { isRecord } from '../shared/json';
import type { ParsedScript } from '../shared/types';

export interface ParseInput {
  index: number;
  elementId: string | null;
  raw: string;
  originalLength?: number;
  truncated?: boolean;
}

export function preprocessJsonLd(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '').trim();
  if (text.startsWith('<!--')) {
    text = text.replace(/^<!--/, '');
    const end = text.lastIndexOf('-->');
    if (end >= 0) text = text.slice(0, end);
    text = text.trim();
  }
  if (text.startsWith('<![CDATA[') && text.endsWith(']]>')) {
    text = text.slice('<![CDATA['.length, -']]>'.length).trim();
  }
  return text;
}

export function parseScript(input: ParseInput): ParsedScript {
  const originalLength = input.originalLength ?? input.raw.length;
  const truncated = input.truncated ?? false;
  const base = {
    index: input.index,
    elementId: input.elementId,
    raw: input.raw,
    originalLength,
    truncated,
  };

  if (truncated) {
    return {
      ...base,
      parseStatus: 'error',
      parseError: `This JSON-LD script is ${originalLength.toLocaleString('en-US')} characters and exceeds the ${LIMITS.maxRetainedChars.toLocaleString('en-US')} character retention limit. The first ${LIMITS.maxRetainedChars.toLocaleString('en-US')} characters were kept. Parsing and validation were skipped for the truncated script so a cut-off fragment is not treated as the real document.`,
      data: null,
    };
  }

  const text = preprocessJsonLd(input.raw);
  if (text.length === 0) {
    return {
      ...base,
      parseStatus: 'empty',
      parseError: 'JSON-LD script is empty.',
      data: null,
    };
  }

  try {
    const data: unknown = JSON.parse(text);
    return {
      ...base,
      parseStatus: 'ok',
      parseError: null,
      data,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown JSON.parse failure';
    return {
      ...base,
      parseStatus: 'error',
      parseError: detail,
      data: null,
    };
  }
}

export function isPrimitiveJson(data: unknown): boolean {
  return data === null || (typeof data !== 'object' && !isRecord(data));
}
