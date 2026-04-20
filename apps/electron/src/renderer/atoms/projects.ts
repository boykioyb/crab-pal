/**
 * Project Atoms (Phase 3)
 *
 * Renderer state for the Workspace → Project → Session hierarchy.
 *
 * Responsibilities:
 *  - Hold the list of projects for the active workspace.
 *  - Track which project is active (persisted per-workspace to localStorage
 *    so reload restores the user's selection).
 *  - Expose action atoms that call the `window.electronAPI.projects.*` IPC
 *    surface and keep local state in sync via the `onProjectsChanged` event.
 *
 * This file deliberately does NOT wire the subscription itself — the App
 * bootstrap code is expected to read `loadProjectsAtom` on workspace change
 * and subscribe to `onProjectsChanged` once. See `subscribeProjectsChanged`
 * below for the helper.
 */

import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import type { Project, CreateProjectInput, UpdateProjectPatch } from '@crabpal/core/types'
import * as storage from '../lib/local-storage'
import { KEYS } from '../lib/local-storage'

// ---------------------------------------------------------------------------
// Persistence helpers for activeProjectId
// ---------------------------------------------------------------------------
//
// Stored per-workspace under key:  `${PREFIX}active-project-id:${workspaceId}`
// via lib/local-storage so it lives alongside other renderer prefs.

function readStoredActiveProjectId(workspaceId: string | null): string | null {
  if (!workspaceId) return null
  return storage.get<string | null>(KEYS.activeProjectId, null, workspaceId)
}

function writeStoredActiveProjectId(workspaceId: string | null, projectId: string | null): void {
  if (!workspaceId) return
  if (projectId === null) {
    storage.remove(KEYS.activeProjectId, workspaceId)
  } else {
    storage.set<string>(KEYS.activeProjectId, projectId, workspaceId)
  }
}

// ---------------------------------------------------------------------------
// Core atoms
// ---------------------------------------------------------------------------

/** Workspace whose projects are currently loaded into `projectsAtom`. */
export const projectsWorkspaceIdAtom = atom<string | null>(null)

/** List of Project for the active workspace. Sorted by the server (lastUsedAt desc). */
export const projectsAtom = atom<Project[]>([])

/**
 * Active project ID for the current workspace. Persisted to localStorage per
 * workspace so reload restores the selection. Writes go through this atom so
 * both the in-memory value and the localStorage mirror stay in sync.
 */
const activeProjectIdBaseAtom = atom<string | null>(null)

export const activeProjectIdAtom = atom(
  (get) => get(activeProjectIdBaseAtom),
  (get, set, next: string | null) => {
    const workspaceId = get(projectsWorkspaceIdAtom)
    writeStoredActiveProjectId(workspaceId, next)
    set(activeProjectIdBaseAtom, next)
  },
)

/**
 * Per-id Project lookup. Returns null if the id isn't in `projectsAtom`.
 * Components that need a single project should subscribe here rather than
 * re-running through the full list on each render.
 */
export const projectByIdAtom = atomFamily((projectId: string) =>
  atom((get) => get(projectsAtom).find((p) => p.id === projectId) ?? null),
)

// ---------------------------------------------------------------------------
// Action atoms — wrap window.electronAPI.projects.*
// ---------------------------------------------------------------------------

/**
 * Load projects for a workspace. Also:
 *  - Updates `projectsWorkspaceIdAtom` so persistence is scoped correctly.
 *  - Restores `activeProjectIdAtom` from localStorage, falling back to the
 *    first project in the list if the stored id is stale (e.g. the project
 *    was deleted in another window).
 */
export const loadProjectsAtom = atom(
  null,
  async (get, set, workspaceId: string): Promise<Project[]> => {
    const projects = await window.electronAPI.projects.list(workspaceId)
    set(projectsAtom, projects)
    set(projectsWorkspaceIdAtom, workspaceId)

    // Reconcile active project selection with what just loaded.
    const storedId = readStoredActiveProjectId(workspaceId)
    const storedStillValid = storedId && projects.some((p) => p.id === storedId)
    const current = get(activeProjectIdBaseAtom)
    const currentStillValid = current && projects.some((p) => p.id === current)

    let nextActive: string | null
    if (currentStillValid) {
      nextActive = current
    } else if (storedStillValid) {
      nextActive = storedId
    } else {
      nextActive = projects[0]?.id ?? null
    }

    if (nextActive !== current) {
      set(activeProjectIdBaseAtom, nextActive)
    }
    writeStoredActiveProjectId(workspaceId, nextActive)

    return projects
  },
)

/**
 * Create a project and optimistically append to `projectsAtom`. The server
 * also emits `projects:changed`, which will trigger a full reload via
 * `subscribeProjectsChanged`. The optimistic update just keeps the UI
 * responsive in the gap.
 */
export const addProjectAtom = atom(
  null,
  async (get, set, input: CreateProjectInput): Promise<Project> => {
    const created = await window.electronAPI.projects.create(input)
    const current = get(projectsAtom)
    // Avoid duplicates if the changed-event reload already raced us.
    if (!current.some((p) => p.id === created.id)) {
      set(projectsAtom, [created, ...current])
    }
    return created
  },
)

export const updateProjectAtom = atom(
  null,
  async (
    get,
    set,
    args: { workspaceId: string; projectId: string; patch: UpdateProjectPatch },
  ): Promise<Project | null> => {
    const updated = await window.electronAPI.projects.update(
      args.workspaceId,
      args.projectId,
      args.patch,
    )
    if (updated) {
      const current = get(projectsAtom)
      set(
        projectsAtom,
        current.map((p) => (p.id === updated.id ? updated : p)),
      )
    }
    return updated
  },
)

export const deleteProjectAtom = atom(
  null,
  async (
    get,
    set,
    args: { workspaceId: string; projectId: string },
  ): Promise<boolean> => {
    const removed = await window.electronAPI.projects.delete(args.workspaceId, args.projectId)
    if (removed) {
      const current = get(projectsAtom)
      const next = current.filter((p) => p.id !== args.projectId)
      set(projectsAtom, next)

      // If the deleted project was active, fall back to the first remaining.
      const active = get(activeProjectIdBaseAtom)
      if (active === args.projectId) {
        const fallback = next[0]?.id ?? null
        set(activeProjectIdBaseAtom, fallback)
        writeStoredActiveProjectId(args.workspaceId, fallback)
      }
      // Also clean up the atomFamily entry for the deleted project.
      projectByIdAtom.remove(args.projectId)
    }
    return removed
  },
)

// ---------------------------------------------------------------------------
// Subscription helper
// ---------------------------------------------------------------------------

/**
 * Subscribe to `projects:changed` for a specific workspace and reload the
 * project list when a change is announced. Returns the cleanup function.
 *
 * Intended for use in App bootstrap (useEffect) — the atom module itself
 * stays side-effect-free.
 */
export function subscribeProjectsChanged(
  workspaceId: string,
  reload: () => void,
): () => void {
  return window.electronAPI.onProjectsChanged((changedWorkspaceId) => {
    if (changedWorkspaceId === workspaceId) {
      reload()
    }
  })
}
