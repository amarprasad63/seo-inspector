import type { AssetType } from './types';

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tif', 'tiff']);
const SCRIPT_EXT = new Set(['js', 'mjs', 'cjs']);
const STYLE_EXT = new Set(['css']);
const FONT_EXT = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'm3u8']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'aac', 'flac', 'oga', 'opus']);

const INITIATOR_MAP: Record<string, AssetType> = {
  img: 'image',
  image: 'image',
  css: 'css',
  script: 'javascript',
  link: 'other',
  video: 'video',
  audio: 'video',
  xmlhttprequest: 'xhr',
  fetch: 'xhr',
  beacon: 'xhr',
  font: 'font',
  css_font: 'font',
  iframe: 'other',
  other: 'other',
};

export function extensionOf(url: string): string {
  try {
    const pathname = new URL(url, 'https://example.invalid').pathname;
    const base = pathname.split('/').pop() ?? '';
    const clean = base.split('?')[0]?.split('#')[0] ?? '';
    const dot = clean.lastIndexOf('.');
    if (dot < 0) return '';
    return clean.slice(dot + 1).toLowerCase();
  } catch {
    return '';
  }
}

export function formatFromUrl(url: string, mimeHint: string | null = null): string | null {
  if (mimeHint) {
    const subtype = mimeHint.split(';')[0]?.split('/')[1]?.trim().toLowerCase();
    if (subtype) return subtype.toUpperCase();
  }
  const ext = extensionOf(url);
  if (!ext) return null;
  if (ext === 'jpg') return 'JPG';
  if (ext === 'jpeg') return 'JPEG';
  return ext.toUpperCase();
}

export function classifyByExtension(url: string): AssetType | null {
  const ext = extensionOf(url);
  if (!ext) return null;
  if (IMAGE_EXT.has(ext)) return 'image';
  if (SCRIPT_EXT.has(ext)) return 'javascript';
  if (STYLE_EXT.has(ext)) return 'css';
  if (FONT_EXT.has(ext)) return 'font';
  if (VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext)) return 'video';
  return null;
}

export function classifyResource(input: {
  url: string;
  initiatorType?: string | null;
  domHint?: AssetType | null;
  mimeType?: string | null;
}): AssetType {
  if (input.domHint) return input.domHint;

  const initiator = (input.initiatorType ?? '').toLowerCase();
  if (initiator === 'link' || initiator === 'css') {
    const byExt = classifyByExtension(input.url);
    if (byExt === 'css' || byExt === 'font' || byExt === 'image') return byExt;
  }
  if (initiator in INITIATOR_MAP) {
    const mapped = INITIATOR_MAP[initiator];
    if (mapped === 'other' || mapped === 'xhr') {
      const byExt = classifyByExtension(input.url);
      if (byExt) return byExt;
    }
    if (mapped) return mapped;
  }

  const mime = (input.mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('font/') || mime.includes('font-woff') || mime.includes('font-sfnt')) return 'font';
  if (mime.includes('javascript') || mime === 'application/ecmascript') return 'javascript';
  if (mime === 'text/css') return 'css';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'video';

  return classifyByExtension(input.url) ?? 'other';
}

export function filenameOf(url: string): string {
  try {
    const parsed = new URL(url, 'https://example.invalid');
    const path = parsed.pathname;
    const name = path.split('/').filter(Boolean).pop();
    if (name) return decodeURIComponent(name);
    return parsed.hostname || url;
  } catch {
    const parts = url.split('?')[0]?.split('/') ?? [];
    return parts.filter(Boolean).pop() || url;
  }
}

export function domainOf(url: string, pageOrigin: string): { domain: string; sameOrigin: boolean } {
  try {
    const parsed = new URL(url, pageOrigin || undefined);
    const page = pageOrigin ? new URL(pageOrigin) : null;
    return {
      domain: parsed.hostname || '(unknown)',
      sameOrigin: page ? parsed.origin === page.origin : false,
    };
  } catch {
    return { domain: '(invalid)', sameOrigin: false };
  }
}
