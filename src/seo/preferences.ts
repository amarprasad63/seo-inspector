import { EMPTY_TARGETS, type KeywordTargets } from './types';

const STORAGE_KEY = 'seoInspectorKeywordTargets';
const THEME_KEY = 'seoInspectorTheme';

export type ColorTheme = 'light' | 'dark';

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

export async function loadTheme(): Promise<ColorTheme> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return 'light';
  try {
    const stored = await chrome.storage.local.get(THEME_KEY);
    return stored[THEME_KEY] === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export async function saveTheme(theme: ColorTheme): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [THEME_KEY]: theme });
}

export function watchTheme(onChange: (theme: ColorTheme) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => undefined;
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(THEME_KEY in changes)) return;
    const next = changes[THEME_KEY]?.newValue;
    if (next === 'light' || next === 'dark') onChange(next);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
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
