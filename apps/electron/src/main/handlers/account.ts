import { RPC_CHANNELS } from '@crabpal/shared/protocol'
import type { RpcServer } from '@crabpal/server-core/transport'
import type { HandlerDeps } from './handler-deps'

export const GUI_HANDLED_CHANNELS = [
  RPC_CHANNELS.account.GET_INFO,
  RPC_CHANNELS.account.GET_RATE_LIMIT,
] as const

// The /api/oauth/usage endpoint is aggressively rate-limited by claude.ai.
// We cache successful responses for 60s so that frequent modal opens don't
// trigger 429s. The Account & Usage view is not real-time anyway — the data
// only changes when the user actually makes API calls.
const USAGE_CACHE_TTL_MS = 60_000
const usageCache = new Map<string, { fetchedAt: number; entries: unknown[] }>()

export function registerAccountHandlers(server: RpcServer, deps: HandlerDeps): void {
  // ============================================================
  // Account info — reflects the active CrabPal connection.
  // Priority: (1) connection.profile (stored after OAuth), (2) lazy-fetch
  // from claude.ai using the stored OAuth token if profile is missing,
  // (3) SDK's accountInfo() for tokenSource/apiProvider.
  // Deliberately avoids reading ~/.claude.json or the Claude CLI keychain
  // since those belong to the system Claude CLI, not this connection.
  // ============================================================
  server.handle(RPC_CHANNELS.account.GET_INFO, async (_ctx, opts?: { connectionSlug?: string }) => {
    const sessionManager = deps.sessionManager as import('@crabpal/server-core/sessions').SessionManager
    const sessions = (sessionManager as any).sessions as Map<string, { agent: import('@crabpal/shared/agent').ClaudeAgent | null }>

    // Pull tokenSource/apiProvider from SDK when a session is active
    let sdkInfo: {
      tokenSource?: string
      apiProvider?: string
    } | null = null

    for (const managed of sessions.values()) {
      const agent = managed.agent as import('@crabpal/shared/agent').ClaudeAgent | null
      if (!agent) continue
      if (typeof (agent as any).getAccountInfo !== 'function') continue
      try {
        const info = await (agent as any).getAccountInfo()
        if (info) {
          sdkInfo = { tokenSource: info.tokenSource, apiProvider: info.apiProvider }
          break
        }
      } catch {
        // try next
      }
    }

    let connection: Awaited<ReturnType<typeof import('@crabpal/shared/config/storage').getLlmConnection>> = null
    try {
      const { getDefaultLlmConnection, getLlmConnection } = await import('@crabpal/shared/config/storage')
      const slug = opts?.connectionSlug ?? getDefaultLlmConnection()
      connection = slug ? getLlmConnection(slug) : null
    } catch {
      // no connection available
    }

    if (!connection && !sdkInfo) return null

    // Lazy-fetch profile for OAuth connections that were set up before this
    // feature existed (no profile stored yet). Best-effort, non-blocking
    // persist — we return whatever arrives now.
    let profile = connection?.profile
    if (!profile && connection && connection.authType === 'oauth') {
      try {
        const [{ getCredentialManager }, { fetchClaudeProfile }, { updateLlmConnection }] = await Promise.all([
          import('@crabpal/shared/credentials'),
          import('@crabpal/shared/auth'),
          import('@crabpal/shared/config/storage'),
        ])
        const manager = getCredentialManager()
        const creds = await manager.getLlmOAuth(connection.slug)
        if (creds?.accessToken) {
          const fetched = await fetchClaudeProfile(creds.accessToken)
          if (fetched) {
            profile = fetched
            updateLlmConnection(connection.slug, { profile: fetched })
          }
        }
      } catch {
        // best effort — fall through without profile
      }
    }

    return {
      email: profile?.email,
      organization: profile?.organizationName,
      subscriptionType: profile?.subscriptionType,
      tokenSource: sdkInfo?.tokenSource ?? connection?.authType,
      apiProvider: sdkInfo?.apiProvider,
    }
  })

  // ============================================================
  // Rate limit info — fetches all buckets from /api/oauth/usage (primary)
  // and merges with any SDK rate_limit_event data captured during turns.
  // ============================================================
  server.handle(RPC_CHANNELS.account.GET_RATE_LIMIT, async (_ctx, opts?: { force?: boolean; connectionSlug?: string }) => {
    const sessionManager = deps.sessionManager as import('@crabpal/server-core/sessions').SessionManager
    const sessions = (sessionManager as any).sessions as Map<string, { agent: unknown }>
    const forceRefresh = opts?.force === true

    const merged = new Map<string, unknown>()

    // 1. Fetch fresh data from claude.ai for the active connection (with cache)
    try {
      const [{ getCredentialManager }, { fetchClaudeUsage }, { getDefaultLlmConnection, getLlmConnection }] = await Promise.all([
        import('@crabpal/shared/credentials'),
        import('@crabpal/shared/auth'),
        import('@crabpal/shared/config/storage'),
      ])
      const slug = opts?.connectionSlug ?? getDefaultLlmConnection()
      const connection = slug ? getLlmConnection(slug) : null
      if (connection && connection.authType === 'oauth') {
        const cached = usageCache.get(connection.slug)
        const isFresh = !forceRefresh && cached && Date.now() - cached.fetchedAt < USAGE_CACHE_TTL_MS
        if (isFresh) {
          for (const entry of cached.entries) {
            const e = entry as { rateLimitType?: string }
            if (e.rateLimitType) merged.set(e.rateLimitType, entry)
          }
        } else {
          const creds = await getCredentialManager().getLlmOAuth(connection.slug)
          if (creds?.accessToken) {
            const entries = await fetchClaudeUsage(creds.accessToken)
            if (entries.length > 0) {
              usageCache.set(connection.slug, { fetchedAt: Date.now(), entries })
            }
            for (const entry of entries) {
              merged.set(entry.rateLimitType, entry)
            }
          }
        }
      }
    } catch {
      // best-effort
    }

    // 2. Overlay SDK stream data (more recent since it comes from live turn)
    for (const managed of sessions.values()) {
      const agent = managed.agent
      if (!agent) continue
      if (typeof (agent as any).getRateLimitInfo !== 'function') continue
      const entries: unknown[] = (agent as any).getRateLimitInfo()
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        const e = entry as { rateLimitType?: string }
        if (e.rateLimitType) merged.set(e.rateLimitType, entry)
      }
    }

    return merged.size > 0 ? Array.from(merged.values()) : []
  })
}
