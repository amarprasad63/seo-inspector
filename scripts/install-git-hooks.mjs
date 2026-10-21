import { execSync } from 'node:child_process';
import { chmodSync, mkdirSync, readlinkSync, symlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hookSource = join(root, 'scripts', 'git-hooks', 'pre-commit');

let hooksDir;
try {
  const gitPath = execSync('git rev-parse --git-path hooks', { cwd: root, encoding: 'utf8' }).trim();
  hooksDir = gitPath.startsWith('/') ? gitPath : join(root, gitPath);
} catch {
  process.exit(0);
}

mkdirSync(hooksDir, { recursive: true });
chmodSync(hookSource, 0o755);

const installed = join(hooksDir, 'pre-commit');
const linkTarget = relative(hooksDir, hookSource);

try {
  if (readlinkSync(installed) === linkTarget) process.exit(0);
  console.warn('seo-extension: left the existing .git/hooks/pre-commit in place.');
  process.exit(0);
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code !== 'ENOENT') {
    console.warn('seo-extension: left the existing .git/hooks/pre-commit in place.');
    process.exit(0);
  }
}

try {
  symlinkSync(linkTarget, installed);
} catch (error) {
  const message = error instanceof Error ? error.message : 'could not install the hook';
  console.warn(`seo-extension: pre-commit hook was not installed. ${message}`);
}
