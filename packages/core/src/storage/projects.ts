/**
 * Project Storage
 *
 * Workspace-scoped CRUD for projects. Persisted to
 *   {workspaceRootPath}/projects.json
 * as a plain JSON array. Each project represents a folder-backed grouping
 * of sessions inside the workspace.
 *
 * This module intentionally only handles project metadata. Cascade deletion
 * of sessions is performed via a caller-supplied `onDeleteProject` hook so
 * that @crabpal/core does not depend on session storage (which lives in
 * @crabpal/shared).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  Project,
  CreateProjectInput,
  UpdateProjectPatch,
} from '../types/project.ts';

// ============================================================
// Path helpers
// ============================================================

/** Filename for the projects manifest, relative to a workspace root. */
export const PROJECTS_FILE_NAME = 'projects.json';

/** Absolute path to a workspace's projects.json. */
export function getProjectsFilePath(workspaceRootPath: string): string {
  return join(workspaceRootPath, PROJECTS_FILE_NAME);
}

// ============================================================
// Slug generation
// ============================================================

/** Generate a URL-safe slug from a display name. Mirrors workspace slug rules. */
export function generateProjectSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  if (!slug) slug = 'project';
  return slug;
}

function uniqueSlug(base: string, existing: readonly Project[]): string {
  const taken = new Set(existing.map((p) => p.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// ============================================================
// Load / save
// ============================================================

function readProjectsFile(workspaceRootPath: string): Project[] {
  const filePath = getProjectsFilePath(workspaceRootPath);
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Project[];
  } catch {
    return [];
  }
}

function writeProjectsFile(workspaceRootPath: string, projects: Project[]): void {
  if (!existsSync(workspaceRootPath)) {
    mkdirSync(workspaceRootPath, { recursive: true });
  }
  const filePath = getProjectsFilePath(workspaceRootPath);
  writeFileSync(filePath, JSON.stringify(projects, null, 2));
}

// ============================================================
// CRUD
// ============================================================

/**
 * List all projects in a workspace (sorted by lastUsedAt desc).
 */
export function listProjects(workspaceRootPath: string): Project[] {
  const projects = readProjectsFile(workspaceRootPath);
  return [...projects].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

/**
 * Get a single project by id.
 */
export function getProject(workspaceRootPath: string, id: string): Project | null {
  return readProjectsFile(workspaceRootPath).find((p) => p.id === id) ?? null;
}

/**
 * Add a new project. Fills in id/slug/createdAt/lastUsedAt.
 * Throws if rootPath is empty. Does NOT validate the folder exists on disk
 * (caller should do that earlier, typically via dialog picker).
 */
export function addProject(
  workspaceRootPath: string,
  input: CreateProjectInput,
): Project {
  const name = input.name.trim();
  if (!name) throw new Error('Project name is required');
  const rootPath = input.rootPath.trim();
  if (!rootPath) throw new Error('Project rootPath is required');

  const existing = readProjectsFile(workspaceRootPath);
  const slug = uniqueSlug(generateProjectSlug(name), existing);
  const now = new Date().toISOString();

  const project: Project = {
    id: `proj_${randomUUID().slice(0, 8)}`,
    workspaceId: input.workspaceId,
    name,
    slug,
    rootPath,
    ...(input.color !== undefined && { color: input.color }),
    createdAt: now,
    lastUsedAt: now,
  };

  writeProjectsFile(workspaceRootPath, [...existing, project]);
  return project;
}

/**
 * Update a project in-place. Returns the updated project, or null if not found.
 */
export function updateProject(
  workspaceRootPath: string,
  id: string,
  patch: UpdateProjectPatch,
): Project | null {
  const projects = readProjectsFile(workspaceRootPath);
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const current = projects[idx]!;
  const next: Project = {
    ...current,
    ...(patch.name !== undefined && { name: patch.name.trim() || current.name }),
    ...(patch.rootPath !== undefined && { rootPath: patch.rootPath }),
    ...(patch.color !== undefined && { color: patch.color }),
    lastUsedAt: patch.lastUsedAt ?? new Date().toISOString(),
  };

  // Re-slug if the name changed (keep stable otherwise).
  if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== current.name) {
    const base = generateProjectSlug(next.name);
    const others = projects.filter((p) => p.id !== id);
    next.slug = uniqueSlug(base, others);
  }

  const updated = [...projects];
  updated[idx] = next;
  writeProjectsFile(workspaceRootPath, updated);
  return next;
}

/**
 * Delete a project and cascade-delete its sessions.
 *
 * Cascading is delegated to the caller via `onDeleteSessions(projectId)` so that
 * @crabpal/core does not depend on session-storage code in @crabpal/shared.
 * Callers should pass a function that removes every session whose projectId
 * matches the deleted project.
 *
 * Returns true if a project was removed.
 */
export async function deleteProject(
  workspaceRootPath: string,
  id: string,
  onDeleteSessions: (projectId: string) => void | Promise<void>,
): Promise<boolean> {
  const projects = readProjectsFile(workspaceRootPath);
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  // Cascade first — if this throws we leave the project record in place.
  await onDeleteSessions(id);

  const remaining = projects.filter((p) => p.id !== id);
  writeProjectsFile(workspaceRootPath, remaining);
  return true;
}

// ============================================================
// Seeding
// ============================================================

/**
 * Ensure a workspace has at least one project.
 *
 * If the workspace has no projects on disk, create a single "Default"
 * project whose rootPath equals the workspace rootPath, and return it.
 * Otherwise return null (seeding not needed).
 *
 * @param workspaceRootPath - Absolute path to the workspace folder.
 * @param workspaceId - ID of the owning workspace.
 */
export function seedDefaultProjectIfNeeded(
  workspaceRootPath: string,
  workspaceId: string,
): Project | null {
  const existing = readProjectsFile(workspaceRootPath);
  if (existing.length > 0) return null;

  return addProject(workspaceRootPath, {
    workspaceId,
    name: 'Default',
    rootPath: workspaceRootPath,
  });
}
