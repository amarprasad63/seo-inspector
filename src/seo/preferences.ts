import { EMPTY_TARGETS, type KeywordTargets } from './types';

const STORAGE_KEY = 'seoInspectorKeywordTargets';

export async function loadKeywordTargets(): Promise<KeywordTargets> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return { ...EMPTY_TARGETS };
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return sanitizeTargets(stored[STORAGE_KEY]);
  } catch {
    return { ...EMPTY_TARGETS };
  }
}

export async function saveKeywordTargets(targets: KeywordTargets): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  if (!targets.remember) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: sanitizeTargets(targets) });
}

function sanitizeTargets(value: unknown): KeywordTargets {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_TARGETS };
  const record = value as Partial<KeywordTargets>;
  return {
    primary: clip(record.primary, 120),
    secondary: clip(record.secondary, 300),
    brand: clip(record.brand, 120),
    remember: record.remember === true,
  };
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
