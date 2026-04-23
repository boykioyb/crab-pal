#!/usr/bin/env bun
// Sync or bump workspace versions against the root package.json.
//
// Usage:
//   bun run bump              # sync all workspace package.json versions to root
//   bun run bump patch        # bump root patch, then sync
//   bun run bump minor
//   bun run bump major
//   bun run bump 1.2.3        # set root to 1.2.3, then sync

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_NOTES_DIR = join(REPO_ROOT, 'apps/electron/resources/release-notes');

function readTopLevelVersion(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/"version"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error(`No "version" field in ${path}`);
  return m[1];
}

function writeTopLevelVersion(path: string, target: string): boolean {
  const raw = readFileSync(path, 'utf8');
  const updated = raw.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${target}"`);
  if (updated === raw) return false;
  writeFileSync(path, updated);
  return true;
}

function parseSemver(v: string): [number, number, number] {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function resolveTarget(current: string, arg: string | undefined): string {
  if (!arg) return current;
  if (/^\d+\.\d+\.\d+$/.test(arg)) return arg;
  const [maj, min, pat] = parseSemver(current);
  switch (arg) {
    case 'patch': return `${maj}.${min}.${pat + 1}`;
    case 'minor': return `${maj}.${min + 1}.0`;
    case 'major': return `${maj + 1}.0.0`;
    default:
      throw new Error(`Unknown bump kind: "${arg}" (use X.Y.Z | patch | minor | major)`);
  }
}

function workspacePackageJsons(): string[] {
  const out: string[] = [];
  for (const group of ['apps', 'packages']) {
    const base = join(REPO_ROOT, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      const dir = join(base, entry);
      if (!statSync(dir).isDirectory()) continue;
      const pkg = join(dir, 'package.json');
      if (existsSync(pkg)) out.push(pkg);
    }
  }
  return out;
}

function ensureReleaseNotes(version: string): boolean {
  const path = join(RELEASE_NOTES_DIR, `${version}.md`);
  if (existsSync(path)) return false;
  writeFileSync(path, `# v${version}\n\n_Release notes pending._\n`);
  return true;
}

function main(): void {
  const rootPkgPath = join(REPO_ROOT, 'package.json');
  const current = readTopLevelVersion(rootPkgPath);
  const target = resolveTarget(current, process.argv[2]);

  if (target !== current) {
    console.log(`Bumping root: ${current} → ${target}`);
    writeTopLevelVersion(rootPkgPath, target);
  } else {
    console.log(`Root is at ${target} (sync mode)`);
  }

  const rel = (p: string) => p.replace(REPO_ROOT + '/', '');
  let synced = 0;
  for (const path of workspacePackageJsons()) {
    const v = readTopLevelVersion(path);
    if (v === target) continue;
    console.log(`  ${rel(path)}: ${v} → ${target}`);
    writeTopLevelVersion(path, target);
    synced++;
  }
  console.log(synced === 0 ? 'All workspaces already in sync.' : `Synced ${synced} package(s).`);

  if (ensureReleaseNotes(target)) {
    console.log(`Created apps/electron/resources/release-notes/${target}.md (stub).`);
  }
}

main();
