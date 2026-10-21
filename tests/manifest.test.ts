import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('manifest', () => {
  it('is Manifest V3 with least-privilege host access', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as {
      manifest_version: number;
      minimum_chrome_version: string;
      permissions: string[];
      host_permissions: string[];
      background: { service_worker: string; type: string };
      action: { default_popup: string };
      side_panel: { default_path: string };
      content_scripts: { matches: string[]; js: string[]; all_frames: boolean }[];
    };
    expect(manifest.manifest_version).toBe(3);
    expect(Number.parseInt(manifest.minimum_chrome_version, 10)).toBeGreaterThanOrEqual(116);
    expect(manifest.permissions.sort()).toEqual(['activeTab', 'scripting', 'sidePanel', 'tabs']);
    expect(manifest.host_permissions).toEqual(['http://*/*', 'https://*/*']);
    expect(manifest.background.type).toBe('module');
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
    expect(manifest.content_scripts[0]?.matches).toEqual(['http://*/*', 'https://*/*']);
    expect(manifest.content_scripts[0]?.all_frames).toBe(false);
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(['cookies', 'history', 'webRequest', '<all_urls>']));
  });
});
