import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const manifestPath = resolve(dist, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('dist/manifest.json is missing');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) {
  console.error('manifest_version is not 3');
  process.exit(1);
}

const required = [
  manifest.action?.default_popup,
  manifest.side_panel?.default_path,
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
];

let failed = false;
for (const relative of required) {
  if (typeof relative !== 'string' || !existsSync(resolve(dist, relative))) {
    console.error('Missing dist file:', relative);
    failed = true;
  }
}

for (const htmlName of ['popup.html', 'sidepanel.html']) {
  const htmlPath = resolve(dist, htmlName);
  if (!existsSync(htmlPath)) {
    console.error('Missing', htmlName);
    failed = true;
    continue;
  }
  const html = readFileSync(htmlPath, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1] ?? '');
  for (const ref of refs) {
    if (/^(https?:|data:|#)/.test(ref)) continue;
    const clean = ref.split('?')[0]?.replace(/^\.\//, '') ?? ref;
    if (!existsSync(resolve(dist, clean))) {
      console.error(`${htmlName} references missing file: ${ref}`);
      failed = true;
    }
  }
}

const content = readFileSync(resolve(dist, 'content/content-script.js'), 'utf8');
if (/\bimport\s|\bexport\s/.test(content)) {
  console.error('Content script bundle still has import or export statements');
  failed = true;
}

if (failed) process.exit(1);
console.log('dist manifest references existing files');
