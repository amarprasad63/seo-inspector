import type { PageExtraction } from './types';

export const SOURCE = 'jsonld-inspector';
export const PROTOCOL_VERSION = 1;

export interface ExtractRequest {
  source: typeof SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: 'extract';
}

export interface ExtractionMessage {
  source: typeof SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: 'extraction';
  payload: PageExtraction;
}

export interface InjectRequest {
  source: typeof SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: 'inject';
  tabId: number;
}

export interface OpenSidePanelRequest {
  source: typeof SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: 'open-side-panel';
  tabId: number;
}

export interface HighlightRequest {
  source: typeof SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: 'highlight';
  highlightId: string;
}

export interface BackgroundAck {
  ok: boolean;
  error?: string;
}

function isEnvelope(value: unknown): value is { source: string; version: number; type: string } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.source === SOURCE && record.version === PROTOCOL_VERSION && typeof record.type === 'string';
}

export function isExtractRequest(value: unknown): value is ExtractRequest {
  return isEnvelope(value) && value.type === 'extract';
}

export function isExtractionMessage(value: unknown): value is ExtractionMessage {
  if (!isEnvelope(value) || value.type !== 'extraction') return false;
  const payload = (value as { payload?: unknown }).payload;
  if (typeof payload !== 'object' || payload === null) return false;
  const record = payload as Record<string, unknown>;
  if (typeof record.url !== 'string' || typeof record.title !== 'string') return false;
  if (typeof record.extractedAt !== 'string' || !Array.isArray(record.scripts)) return false;
  return record.scripts.every((script) => {
    if (typeof script !== 'object' || script === null) return false;
    const item = script as Record<string, unknown>;
    return typeof item.index === 'number' && typeof item.raw === 'string';
  });
}

export function isInjectRequest(value: unknown): value is InjectRequest {
  if (!isEnvelope(value) || value.type !== 'inject') return false;
  return typeof (value as { tabId?: unknown }).tabId === 'number';
}

export function isOpenSidePanelRequest(value: unknown): value is OpenSidePanelRequest {
  if (!isEnvelope(value) || value.type !== 'open-side-panel') return false;
  return typeof (value as { tabId?: unknown }).tabId === 'number';
}

const HIGHLIGHT_ID = /^[a-z]+:\d+$/;

export function isHighlightRequest(value: unknown): value is HighlightRequest {
  if (!isEnvelope(value) || value.type !== 'highlight') return false;
  const highlightId = (value as { highlightId?: unknown }).highlightId;
  return typeof highlightId === 'string' && HIGHLIGHT_ID.test(highlightId);
}
