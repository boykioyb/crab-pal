/**
 * Project RPC handlers (Phase 2).
 *
 * Projects are workspace-local groupings of sessions, persisted to
 *   {workspaceRootPath}/projects.json
 *
 * These handlers are LOCAL_ONLY (see protocol/routing.ts) — same treatment as
 * `workspaces:*` since the manifest lives on the local filesystem.
 *
 * Session cascade on delete: we filter `sessionManager.getSessions(workspaceId)`
 * by `projectId` and call `deleteSession(id)` for each match. Best-effort —
 * sessions that predate the Project hierarchy have no projectId and are left
 * untouched here; seed migration drops those separately.
 */
import { RPC_CHANNELS } from '@crabpal/shared/protocol'
import { getWorkspaceByNameOrId } from '@crabpal/shared/config'
import {
  listProjects,
  getProject,
  addProject,
  updateProject,
  deleteProject,
  seedDefaultProjectIfNeeded,
} from '@crabpal/core/storage'
import { backfillProjectIds } from '@crabpal/shared/sessions'
import type {
  CreateProjectInput,
  UpdateProjectPatch,
} from '@crabpal/core/types'
import { pushTyped, type RpcServer } from '@crabpal/server-core/transport'
import type { HandlerDeps } from './handler-deps'

export const GUI_HANDLED_CHANNELS = [
  RPC_CHANNELS.projects.LIST,
  RPC_CHANNELS.projects.GET,
  RPC_CHANNELS.projects.CREATE,
  RPC_CHANNELS.projects.UPDATE,
  RPC_CHANNELS.projects.DELETE,
] as const

/**
 * Resolve a workspaceId to its workspace rootPath (where projects.json lives).
 * Throws if the workspace is not found.
 */
function resolveWorkspaceRootPath(workspaceId: string): string {
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }
  return workspace.rootPath
}

function emitChanged(server: RpcServer, workspaceId: string): void {
  pushTyped(server, RPC_CHANNELS.projects.CHANGED, { to: 'all' }, workspaceId)
}

/**
 * Seed a Default project for every known workspace that has none.
 * Invoked at boot so the renderer always sees at least one project.
 */
export function seedDefaultProjectsOnBoot(deps: HandlerDeps): void {
  try {
    const workspaces = deps.sessionManager.getWorkspaces()
    for (const ws of workspaces) {
      try {
        const seeded = seedDefaultProjectIfNeeded(ws.rootPath, ws.id)
        if (seeded) {
          deps.platform.logger.info(
            `[projects] seeded Default project for workspace ${ws.id} at ${ws.rootPath}`,
          )
        }

        // Backfill: assign legacy sessions (no projectId) to the Default project
        // so they show up under a project header in the sidebar instead of in
        // the "Unassigned" bucket. Default = first project (lastUsedAt desc).
        const projectsForWs = listProjects(ws.rootPath)
        const defaultProject = projectsForWs[0]
        if (defaultProject) {
          void backfillProjectIds(ws.rootPath, defaultProject.id)
            .then((count) => {
              if (count > 0) {
                deps.platform.logger.info(
                  `[projects] backfilled projectId on ${count} legacy session(s) in workspace ${ws.id} -> ${defaultProject.id}`,
                )
              }
            })
            .catch((err) => {
              deps.platform.logger.warn(
                `[projects] backfill failed for workspace ${ws.id}: ${err}`,
              )
            })
        }
      } catch (err) {
        deps.platform.logger.warn(`[projects] failed to seed default project for ${ws.id}: ${err}`)
      }
    }
  } catch (err) {
    deps.platform.logger.warn(`[projects] seedDefaultProjectsOnBoot failed: ${err}`)
  }
}

export function registerProjectHandlers(server: RpcServer, deps: HandlerDeps): void {
  // ---------------------------------------------------------------------------
  // List projects in a workspace (sorted by lastUsedAt desc).
  // ---------------------------------------------------------------------------
  server.handle(RPC_CHANNELS.projects.LIST, async (_ctx, workspaceId: string) => {
    const rootPath = resolveWorkspaceRootPath(workspaceId)
    // Defensive: ensure at least one project exists. Safe to call every list.
    seedDefaultProjectIfNeeded(rootPath, workspaceId)
    return listProjects(rootPath)
  })

  // ---------------------------------------------------------------------------
  // Get a single project by id.
  // ---------------------------------------------------------------------------
  server.handle(RPC_CHANNELS.projects.GET, async (_ctx, workspaceId: string, projectId: string) => {
    const rootPath = resolveWorkspaceRootPath(workspaceId)
    return getProject(rootPath, projectId)
  })

  // ---------------------------------------------------------------------------
  // Create a project. workspaceId is taken from input.workspaceId; the handler
  // resolves the corresponding workspace rootPath to know where to write.
  // ---------------------------------------------------------------------------
  server.handle(RPC_CHANNELS.projects.CREATE, async (_ctx, input: CreateProjectInput) => {
    const rootPath = resolveWorkspaceRootPath(input.workspaceId)
    const project = addProject(rootPath, input)
    emitChanged(server, input.workspaceId)
    return project
  })

  // ---------------------------------------------------------------------------
  // Update a project. Returns the updated project or null if not found.
  // ---------------------------------------------------------------------------
  server.handle(
    RPC_CHANNELS.projects.UPDATE,
    async (_ctx, workspaceId: string, projectId: string, patch: UpdateProjectPatch) => {
      const rootPath = resolveWorkspaceRootPath(workspaceId)
      const updated = updateProject(rootPath, projectId, patch)
      if (updated) emitChanged(server, workspaceId)
      return updated
    },
  )

  // ---------------------------------------------------------------------------
  // Delete a project. Cascades to every session whose projectId matches.
  // Returns true if the project existed and was removed.
  // ---------------------------------------------------------------------------
  server.handle(
    RPC_CHANNELS.projects.DELETE,
    async (_ctx, workspaceId: string, projectId: string) => {
      const rootPath = resolveWorkspaceRootPath(workspaceId)
      const removed = await deleteProject(rootPath, projectId, async (pid) => {
        // Best-effort cascade: delete every session tagged with this projectId.
        const sessions = deps.sessionManager.getSessions(workspaceId)
        for (const s of sessions) {
          if (s.projectId === pid) {
            try {
              await deps.sessionManager.deleteSession(s.id)
            } catch (err) {
              deps.platform.logger.warn(
                `[projects] failed to delete session ${s.id} during cascade: ${err}`,
              )
            }
          }
        }
      })
      if (removed) emitChanged(server, workspaceId)
      return removed
    },
  )
}
