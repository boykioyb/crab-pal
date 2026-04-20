import {
  existsSync,
  mkdirSync,
  writeFileSync,
  statSync,
  copyFileSync,
  readdirSync,
} from 'fs';
import { join, dirname, basename, resolve, relative, isAbsolute } from 'path';
import { debug } from '../utils/debug.ts';
import { readJsonFileSync } from '../utils/files.ts';
import { CONFIG_DIR } from './paths.ts';

export const LEGACY_CONFIG_DIR = join(dirname(CONFIG_DIR), '.craft-agent');
export const LEGACY_WORKSPACES_DIR = join(LEGACY_CONFIG_DIR, 'workspaces');
export const LEGACY_IMPORT_MARKER_FILE = join(CONFIG_DIR, '.legacy-import-complete.json');
export const LEGACY_IMPORT_RUNS_DIR = join(CONFIG_DIR, '.legacy-import-runs');

export const LEGACY_IMPORT_FILES = [
  'config.json',
  'preferences.json',
  'credentials.enc',
  'drafts.json',
  'theme.json',
  'provider-domains.json',
  'window-state.json',
] as const;

export const LEGACY_IMPORT_DIRECTORIES = [
  'workspaces',
  'themes',
  'tool-icons',
  'permissions',
] as const;

export type LegacyCategory =
  | 'config'
  | 'preferences'
  | 'credentials'
  | 'drafts'
  | 'sessions'
  | 'sources'
  | 'skills'
  | 'automations'
  | 'labels-statuses'
  | 'permissions'
  | 'themes'
  | 'window-state';

export const ALL_LEGACY_CATEGORIES: readonly LegacyCategory[] = [
  'config',
  'preferences',
  'credentials',
  'drafts',
  'sessions',
  'sources',
  'skills',
  'automations',
  'labels-statuses',
  'permissions',
  'themes',
  'window-state',
];

export type ImportStrategy = 'merge' | 'overwrite';

export interface ImportOptions {
  categories: LegacyCategory[];
  strategy: ImportStrategy;
  dryRun?: boolean;
  onProgress?: (event: ImportProgressEvent) => void;
}

export interface ImportProgressEvent {
  category: LegacyCategory;
  phase: 'start' | 'item' | 'end';
  path?: string;
  action?: 'copied' | 'skipped' | 'error';
  reason?: string;
  message?: string;
  processed?: number;
  total?: number;
}

export interface ImportCopiedEntry {
  category: LegacyCategory;
  path: string;
  bytes: number;
}

export interface ImportSkippedEntry {
  category: LegacyCategory;
  path: string;
  reason: string;
}

export interface ImportErrorEntry {
  category: LegacyCategory;
  path: string;
  message: string;
}

export interface ImportResult {
  copied: ImportCopiedEntry[];
  skipped: ImportSkippedEntry[];
  errors: ImportErrorEntry[];
  durationMs: number;
  strategy: ImportStrategy;
  categories: LegacyCategory[];
  dryRun: boolean;
}

export interface PreviewCategoryResult {
  category: LegacyCategory;
  willCopy: Array<{ path: string; bytes: number }>;
  willSkip: Array<{ path: string; reason: string }>;
}

export interface PreviewResult {
  categories: PreviewCategoryResult[];
}

export interface LegacyPresence {
  exists: boolean;
  path: string;
  sizeBytes: number;
  categoriesAvailable: LegacyCategory[];
}

export interface LegacyImportMarker {
  version: 1;
  source: string;
  completedAt: number;
  outcome: 'imported' | 'skipped-existing-target';
  copiedEntries?: string[];
}

// ---------------------------------------------------------------------------
// Path helpers (moved from storage.ts)
// ---------------------------------------------------------------------------

function normalizePathPrefix(value: string): string {
  return value.replace(/\\/g, '/');
}

function replaceLegacyPathPrefix(value: string): string {
  const normalizedValue = normalizePathPrefix(value);
  const normalizedLegacyWorkspacesDir = normalizePathPrefix(LEGACY_WORKSPACES_DIR);
  const normalizedLegacyConfigDir = normalizePathPrefix(LEGACY_CONFIG_DIR);
  const normalizedWorkspacesDir = normalizePathPrefix(join(CONFIG_DIR, 'workspaces'));
  const normalizedConfigDir = normalizePathPrefix(CONFIG_DIR);

  if (
    normalizedValue === normalizedLegacyWorkspacesDir ||
    normalizedValue.startsWith(normalizedLegacyWorkspacesDir + '/')
  ) {
    return normalizedWorkspacesDir + normalizedValue.slice(normalizedLegacyWorkspacesDir.length);
  }

  if (
    normalizedValue === normalizedLegacyConfigDir ||
    normalizedValue.startsWith(normalizedLegacyConfigDir + '/')
  ) {
    return normalizedConfigDir + normalizedValue.slice(normalizedLegacyConfigDir.length);
  }

  return value;
}

export function rewriteLegacyPathsInJson(value: unknown): unknown {
  if (typeof value === 'string') {
    return replaceLegacyPathPrefix(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => rewriteLegacyPathsInJson(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, rewriteLegacyPathsInJson(entryValue)]),
    );
  }

  return value;
}

export function copyDirectoryRecursive(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
  }
}

export function rewriteImportedJsonFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  try {
    const content = readJsonFileSync<unknown>(filePath);
    const rewritten = rewriteLegacyPathsInJson(content);
    writeFileSync(filePath, JSON.stringify(rewritten, null, 2), 'utf-8');
  } catch (error) {
    debug(
      '[config] Failed to rewrite imported JSON file:',
      filePath,
      error instanceof Error ? error.message : error,
    );
  }
}

export function rewriteImportedWorkspaceConfigs(workspacesDir: string): void {
  if (!existsSync(workspacesDir)) return;

  try {
    for (const entry of readdirSync(workspacesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      rewriteImportedJsonFile(join(workspacesDir, entry.name, 'config.json'));
    }
  } catch (error) {
    debug(
      '[config] Failed to rewrite imported workspace configs:',
      error instanceof Error ? error.message : error,
    );
  }
}

export function targetConfigHasUserData(): boolean {
  return [...LEGACY_IMPORT_FILES, ...LEGACY_IMPORT_DIRECTORIES].some((entry) =>
    existsSync(join(CONFIG_DIR, entry)),
  );
}

export function writeLegacyImportMarker(
  outcome: LegacyImportMarker['outcome'],
  copiedEntries: string[] = [],
): void {
  const marker: LegacyImportMarker = {
    version: 1,
    source: LEGACY_CONFIG_DIR,
    completedAt: Date.now(),
    outcome,
    copiedEntries,
  };

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(LEGACY_IMPORT_MARKER_FILE, JSON.stringify(marker, null, 2), 'utf-8');
}

function hasExplicitConfigDirOverride(): boolean {
  return !!process.env.CRABPAL_CONFIG_DIR || !!process.env.CRAB_PAL_CONFIG_DIR;
}

// ---------------------------------------------------------------------------
// Path traversal guard
// ---------------------------------------------------------------------------

function assertUnderLegacyRoot(absolutePath: string): void {
  const resolved = resolve(absolutePath);
  const rootResolved = resolve(LEGACY_CONFIG_DIR);
  const rel = relative(rootResolved, resolved);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`[legacy-import] Path escapes legacy root: ${absolutePath}`);
  }
}

function dirSizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    try {
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const p = join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(p);
        } else if (entry.isFile()) {
          try {
            total += statSync(p).size;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return total;
}

function fileSizeBytes(file: string): number {
  if (!existsSync(file)) return 0;
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Category source layout
// ---------------------------------------------------------------------------

function legacyWorkspaceDirs(): string[] {
  if (!existsSync(LEGACY_WORKSPACES_DIR)) return [];
  try {
    return readdirSync(LEGACY_WORKSPACES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => join(LEGACY_WORKSPACES_DIR, e.name));
  } catch {
    return [];
  }
}

function targetWorkspaceDirs(): string[] {
  const dir = join(CONFIG_DIR, 'workspaces');
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => join(dir, e.name));
  } catch {
    return [];
  }
}

function categoryHasSource(category: LegacyCategory): boolean {
  switch (category) {
    case 'config':
      return existsSync(join(LEGACY_CONFIG_DIR, 'config.json'));
    case 'preferences':
      return existsSync(join(LEGACY_CONFIG_DIR, 'preferences.json'));
    case 'credentials':
      return existsSync(join(LEGACY_CONFIG_DIR, 'credentials.enc'));
    case 'drafts':
      return existsSync(join(LEGACY_CONFIG_DIR, 'drafts.json'));
    case 'window-state':
      return existsSync(join(LEGACY_CONFIG_DIR, 'window-state.json'));
    case 'themes':
      return (
        existsSync(join(LEGACY_CONFIG_DIR, 'themes')) ||
        existsSync(join(LEGACY_CONFIG_DIR, 'tool-icons'))
      );
    case 'permissions':
      return (
        existsSync(join(LEGACY_CONFIG_DIR, 'permissions')) ||
        legacyWorkspaceDirs().some(w => existsSync(join(w, 'permissions.json')))
      );
    case 'sessions':
      return legacyWorkspaceDirs().some(w => existsSync(join(w, 'sessions')));
    case 'sources':
      return legacyWorkspaceDirs().some(w => existsSync(join(w, 'sources')));
    case 'skills':
      return legacyWorkspaceDirs().some(w => existsSync(join(w, 'skills')));
    case 'automations':
      return legacyWorkspaceDirs().some(w => existsSync(join(w, 'automations.json')));
    case 'labels-statuses':
      return legacyWorkspaceDirs().some(
        w => existsSync(join(w, 'labels')) || existsSync(join(w, 'statuses')),
      );
  }
}

// ---------------------------------------------------------------------------
// Public: detect
// ---------------------------------------------------------------------------

export function detectLegacyPresence(): LegacyPresence {
  const exists = existsSync(LEGACY_CONFIG_DIR);
  if (!exists) {
    return {
      exists: false,
      path: LEGACY_CONFIG_DIR,
      sizeBytes: 0,
      categoriesAvailable: [],
    };
  }

  const categoriesAvailable: LegacyCategory[] = [];
  for (const cat of ALL_LEGACY_CATEGORIES) {
    if (categoryHasSource(cat)) categoriesAvailable.push(cat);
  }

  return {
    exists: true,
    path: LEGACY_CONFIG_DIR,
    sizeBytes: dirSizeBytes(LEGACY_CONFIG_DIR),
    categoriesAvailable,
  };
}

// ---------------------------------------------------------------------------
// Per-category planning
// ---------------------------------------------------------------------------

interface PlannedItem {
  category: LegacyCategory;
  srcPath: string;
  destPath: string;
  /** Target-relative id for merge keys (session id, slug, filename, etc.) */
  itemKey?: string;
  /** Whether to treat this as JSON path-rewrite candidate after copy. */
  rewriteJson?: boolean;
  /** Whole directory copy vs single file */
  kind: 'file' | 'dir';
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    try {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const p = join(current, entry.name);
        if (entry.isDirectory()) stack.push(p);
        else if (entry.isFile()) out.push(p);
      }
    } catch {
      // ignore
    }
  }
  return out;
}

function planCategory(category: LegacyCategory, strategy: ImportStrategy): {
  copy: PlannedItem[];
  skip: ImportSkippedEntry[];
} {
  const copy: PlannedItem[] = [];
  const skip: ImportSkippedEntry[] = [];

  const singleFile = (filename: string, rewrite = false) => {
    const src = join(LEGACY_CONFIG_DIR, filename);
    const dest = join(CONFIG_DIR, filename);
    if (!existsSync(src)) return;
    if (existsSync(dest) && strategy === 'merge') {
      skip.push({ category, path: src, reason: 'target-exists' });
      return;
    }
    copy.push({ category, srcPath: src, destPath: dest, kind: 'file', rewriteJson: rewrite });
  };

  switch (category) {
    case 'config':
      singleFile('config.json', true);
      break;
    case 'preferences':
      singleFile('preferences.json', true);
      break;
    case 'drafts':
      singleFile('drafts.json', true);
      break;
    case 'window-state':
      singleFile('window-state.json', true);
      break;
    case 'credentials': {
      const src = join(LEGACY_CONFIG_DIR, 'credentials.enc');
      const dest = join(CONFIG_DIR, 'credentials.enc');
      if (existsSync(src)) {
        if (existsSync(dest)) {
          skip.push({ category, path: src, reason: 'target-exists-encrypted-blob-not-mergeable' });
        } else {
          copy.push({ category, srcPath: src, destPath: dest, kind: 'file' });
        }
      }
      break;
    }
    case 'themes': {
      for (const sub of ['themes', 'tool-icons']) {
        const src = join(LEGACY_CONFIG_DIR, sub);
        const destRoot = join(CONFIG_DIR, sub);
        if (!existsSync(src)) continue;
        for (const file of listFiles(src)) {
          const rel = relative(src, file);
          const dest = join(destRoot, rel);
          if (existsSync(dest) && strategy === 'merge') {
            skip.push({ category, path: file, reason: 'filename-collision' });
          } else {
            copy.push({ category, srcPath: file, destPath: dest, kind: 'file' });
          }
        }
      }
      break;
    }
    case 'permissions': {
      const src = join(LEGACY_CONFIG_DIR, 'permissions');
      const destRoot = join(CONFIG_DIR, 'permissions');
      if (existsSync(src)) {
        for (const file of listFiles(src)) {
          const rel = relative(src, file);
          const dest = join(destRoot, rel);
          if (existsSync(dest) && strategy === 'merge') {
            skip.push({ category, path: file, reason: 'filename-collision' });
          } else {
            copy.push({ category, srcPath: file, destPath: dest, kind: 'file' });
          }
        }
      }
      // workspace-level permissions.json
      for (const wsDir of legacyWorkspaceDirs()) {
        const p = join(wsDir, 'permissions.json');
        if (!existsSync(p)) continue;
        const slug = basename(wsDir);
        const dest = join(CONFIG_DIR, 'workspaces', slug, 'permissions.json');
        if (existsSync(dest) && strategy === 'merge') {
          skip.push({ category, path: p, reason: 'target-exists' });
        } else {
          copy.push({ category, srcPath: p, destPath: dest, kind: 'file', rewriteJson: true });
        }
      }
      break;
    }
    case 'sessions':
    case 'sources':
    case 'skills': {
      const sub =
        category === 'sessions' ? 'sessions' : category === 'sources' ? 'sources' : 'skills';
      for (const wsDir of legacyWorkspaceDirs()) {
        const slug = basename(wsDir);
        const srcBase = join(wsDir, sub);
        if (!existsSync(srcBase)) continue;
        // Top-level entries inside sub/ are keyed units (session id / source slug / skill slug).
        let entries: string[] = [];
        try {
          entries = readdirSync(srcBase);
        } catch {
          entries = [];
        }
        for (const name of entries) {
          const srcEntry = join(srcBase, name);
          const destEntry = join(CONFIG_DIR, 'workspaces', slug, sub, name);
          if (existsSync(destEntry) && strategy === 'merge') {
            skip.push({
              category,
              path: srcEntry,
              reason:
                category === 'sessions'
                  ? 'session-id-collision'
                  : 'slug-collision',
            });
            continue;
          }
          let kind: 'file' | 'dir' = 'file';
          try {
            kind = statSync(srcEntry).isDirectory() ? 'dir' : 'file';
          } catch {
            // skip
            continue;
          }
          copy.push({
            category,
            srcPath: srcEntry,
            destPath: destEntry,
            itemKey: name,
            kind,
            rewriteJson: kind === 'file' && name.endsWith('.json'),
          });
        }
      }
      break;
    }
    case 'automations': {
      for (const wsDir of legacyWorkspaceDirs()) {
        const slug = basename(wsDir);
        const src = join(wsDir, 'automations.json');
        const dest = join(CONFIG_DIR, 'workspaces', slug, 'automations.json');
        if (!existsSync(src)) continue;
        // Special-case: append non-duplicate rules. Planned as a single file item
        // with a marker itemKey so the executor knows to merge rather than blind-copy.
        copy.push({
          category,
          srcPath: src,
          destPath: dest,
          itemKey: '__merge_array__',
          kind: 'file',
          rewriteJson: true,
        });
      }
      break;
    }
    case 'labels-statuses': {
      for (const wsDir of legacyWorkspaceDirs()) {
        const slug = basename(wsDir);
        for (const sub of ['labels', 'statuses']) {
          const srcBase = join(wsDir, sub);
          if (!existsSync(srcBase)) continue;
          for (const file of listFiles(srcBase)) {
            const rel = relative(srcBase, file);
            const dest = join(CONFIG_DIR, 'workspaces', slug, sub, rel);
            if (existsSync(dest) && strategy === 'merge') {
              skip.push({ category, path: file, reason: 'id-collision' });
            } else {
              copy.push({
                category,
                srcPath: file,
                destPath: dest,
                kind: 'file',
                rewriteJson: file.endsWith('.json'),
                itemKey: basename(file, '.json'),
              });
            }
          }
        }
      }
      break;
    }
  }

  return { copy, skip };
}

// ---------------------------------------------------------------------------
// Public: preview
// ---------------------------------------------------------------------------

export async function previewLegacyImport(
  categories: LegacyCategory[],
): Promise<PreviewResult> {
  const result: PreviewResult = { categories: [] };
  for (const category of categories) {
    const { copy, skip } = planCategory(category, 'merge');
    const willCopy = copy.map(item => ({
      path: item.srcPath,
      bytes: item.kind === 'dir' ? dirSizeBytes(item.srcPath) : fileSizeBytes(item.srcPath),
    }));
    result.categories.push({
      category,
      willCopy,
      willSkip: skip.map(s => ({ path: s.path, reason: s.reason })),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-item executors
// ---------------------------------------------------------------------------

function copyPlannedFile(item: PlannedItem): number {
  assertUnderLegacyRoot(item.srcPath);
  mkdirSync(dirname(item.destPath), { recursive: true });
  copyFileSync(item.srcPath, item.destPath);
  if (item.rewriteJson) rewriteImportedJsonFile(item.destPath);
  try {
    return statSync(item.destPath).size;
  } catch {
    return 0;
  }
}

function copyPlannedDir(item: PlannedItem): number {
  assertUnderLegacyRoot(item.srcPath);
  copyDirectoryRecursive(item.srcPath, item.destPath);
  // rewrite JSON files within, limited to a shallow pass on workspace config style files.
  const files = listFiles(item.destPath);
  for (const f of files) {
    if (f.endsWith('.json')) rewriteImportedJsonFile(f);
  }
  return dirSizeBytes(item.destPath);
}

function mergeAutomationsFile(srcPath: string, destPath: string): { merged: boolean; bytes: number } {
  mkdirSync(dirname(destPath), { recursive: true });
  let srcData: unknown;
  try {
    srcData = readJsonFileSync<unknown>(srcPath);
  } catch {
    return { merged: false, bytes: 0 };
  }
  const rewrittenSrc = rewriteLegacyPathsInJson(srcData);

  if (!existsSync(destPath)) {
    writeFileSync(destPath, JSON.stringify(rewrittenSrc, null, 2), 'utf-8');
    return { merged: true, bytes: fileSizeBytes(destPath) };
  }

  let destData: unknown;
  try {
    destData = readJsonFileSync<unknown>(destPath);
  } catch {
    return { merged: false, bytes: 0 };
  }

  const srcArr = Array.isArray(rewrittenSrc) ? (rewrittenSrc as any[]) : [];
  const destArr = Array.isArray(destData) ? (destData as any[]) : [];
  const existingIds = new Set(destArr.map(r => (r && typeof r === 'object' ? (r as any).id : undefined)).filter(Boolean));
  let added = 0;
  for (const rule of srcArr) {
    const id = rule && typeof rule === 'object' ? (rule as any).id : undefined;
    if (id && existingIds.has(id)) continue;
    destArr.push(rule);
    added++;
  }
  if (added > 0) {
    writeFileSync(destPath, JSON.stringify(destArr, null, 2), 'utf-8');
  }
  return { merged: added > 0, bytes: fileSizeBytes(destPath) };
}

// ---------------------------------------------------------------------------
// Public: run import
// ---------------------------------------------------------------------------

export async function importLegacySelective(options: ImportOptions): Promise<ImportResult> {
  const started = Date.now();
  const { categories, strategy, dryRun = false, onProgress } = options;

  const copied: ImportCopiedEntry[] = [];
  const skipped: ImportSkippedEntry[] = [];
  const errors: ImportErrorEntry[] = [];

  for (const category of categories) {
    const { copy, skip } = planCategory(category, strategy);
    skipped.push(...skip);
    onProgress?.({ category, phase: 'start', total: copy.length });

    let processed = 0;
    for (const item of copy) {
      try {
        let bytes = 0;
        if (dryRun) {
          bytes = item.kind === 'dir' ? dirSizeBytes(item.srcPath) : fileSizeBytes(item.srcPath);
        } else if (category === 'automations' && item.itemKey === '__merge_array__') {
          const { bytes: b } = mergeAutomationsFile(item.srcPath, item.destPath);
          bytes = b;
        } else {
          bytes = item.kind === 'dir' ? copyPlannedDir(item) : copyPlannedFile(item);
        }
        copied.push({ category, path: item.srcPath, bytes });
        processed++;
        onProgress?.({
          category,
          phase: 'item',
          path: item.srcPath,
          action: 'copied',
          processed,
          total: copy.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ category, path: item.srcPath, message });
        onProgress?.({
          category,
          phase: 'item',
          path: item.srcPath,
          action: 'error',
          message,
          processed,
          total: copy.length,
        });
      }
    }

    for (const s of skip) {
      onProgress?.({
        category,
        phase: 'item',
        path: s.path,
        action: 'skipped',
        reason: s.reason,
      });
    }

    onProgress?.({ category, phase: 'end', total: copy.length });
  }

  const durationMs = Date.now() - started;
  const result: ImportResult = {
    copied,
    skipped,
    errors,
    durationMs,
    strategy,
    categories,
    dryRun,
  };

  if (!dryRun) {
    try {
      mkdirSync(LEGACY_IMPORT_RUNS_DIR, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const logPath = join(LEGACY_IMPORT_RUNS_DIR, `${ts}.json`);
      writeFileSync(logPath, JSON.stringify(result, null, 2), 'utf-8');
    } catch (error) {
      debug('[legacy-import] Failed to write run log:', error instanceof Error ? error.message : error);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Auto-migration path (preserves exact existing semantics)
// ---------------------------------------------------------------------------

export function importLegacyConfigDirOnce(): void {
  if (hasExplicitConfigDirOverride()) return;
  if (CONFIG_DIR === LEGACY_CONFIG_DIR) return;
  if (existsSync(LEGACY_IMPORT_MARKER_FILE)) return;
  if (!existsSync(LEGACY_CONFIG_DIR)) return;

  if (targetConfigHasUserData()) {
    writeLegacyImportMarker('skipped-existing-target');
    debug('[config] Skipped legacy import because target config root already has user data');
    return;
  }

  const copiedEntries: string[] = [];

  try {
    mkdirSync(CONFIG_DIR, { recursive: true });

    for (const filename of LEGACY_IMPORT_FILES) {
      const srcPath = join(LEGACY_CONFIG_DIR, filename);
      const destPath = join(CONFIG_DIR, filename);
      if (!existsSync(srcPath) || existsSync(destPath)) continue;
      copyFileSync(srcPath, destPath);
      copiedEntries.push(filename);
    }

    for (const directoryName of LEGACY_IMPORT_DIRECTORIES) {
      const srcPath = join(LEGACY_CONFIG_DIR, directoryName);
      const destPath = join(CONFIG_DIR, directoryName);
      if (!existsSync(srcPath) || existsSync(destPath)) continue;
      copyDirectoryRecursive(srcPath, destPath);
      copiedEntries.push(directoryName);
    }

    rewriteImportedJsonFile(join(CONFIG_DIR, 'config.json'));
    rewriteImportedJsonFile(join(CONFIG_DIR, 'drafts.json'));
    rewriteImportedJsonFile(join(CONFIG_DIR, 'preferences.json'));
    rewriteImportedJsonFile(join(CONFIG_DIR, 'window-state.json'));
    rewriteImportedWorkspaceConfigs(join(CONFIG_DIR, 'workspaces'));

    writeLegacyImportMarker('imported', copiedEntries);

    if (copiedEntries.length > 0) {
      debug('[config] Imported legacy config from ~/.craft-agent:', copiedEntries.join(', '));
    }
  } catch (error) {
    debug('[config] Legacy config import failed:', error instanceof Error ? error.message : error);
  }
}
