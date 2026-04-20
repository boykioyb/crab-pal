/**
 * Context window breakdown handler.
 *
 * Returns per-category estimated token usage for the /context modal.
 * See: packages/shared/src/agent/core/context-breakdown.ts
 */

import { join } from 'node:path'
import { RPC_CHANNELS } from '@crabpal/shared/protocol'
import { getWorkspaceByNameOrId } from '@crabpal/shared/config'
import { buildContextBreakdown, type ContextBreakdown } from '@crabpal/shared/agent'
import type { RpcServer } from '@crabpal/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.context.GET_BREAKDOWN,
] as const

export function registerContextHandlers(server: RpcServer, deps: HandlerDeps): void {
  const { sessionManager } = deps

  server.handle(RPC_CHANNELS.context.GET_BREAKDOWN, async (_ctx, sessionId: string): Promise<ContextBreakdown | null> => {
    const session = await sessionManager.getSession(sessionId)
    if (!session) return null

    const workspace = getWorkspaceByNameOrId(session.workspaceId)
    const workspaceRootPath = workspace?.rootPath
    const sourcesDir = workspaceRootPath ? join(workspaceRootPath, 'sources') : undefined

    // Prefer a non-zero "actual" over 0/undefined — 0 means no API call yet, not "empty context".
    const rawActual = session.tokenUsage?.contextTokens || session.tokenUsage?.inputTokens
    const totalActual = rawActual && rawActual > 0 ? rawActual : undefined

    return buildContextBreakdown({
      workingDirectory: session.workingDirectory,
      workspaceRootPath,
      enabledSourceSlugs: session.enabledSourceSlugs ?? [],
      sourcesDir,
      messages: session.messages,
      totalActual,
      contextWindow: session.tokenUsage?.contextWindow,
      model: session.model,
    })
  })
}
