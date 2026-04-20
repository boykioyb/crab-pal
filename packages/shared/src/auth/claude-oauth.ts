/**
 * Native Claude OAuth with PKCE
 *
 * Implements browser-based OAuth using PKCE (Proof Key for Code Exchange) -
 * the standard secure flow for public clients (desktop/mobile apps) that
 * does not require a client secret.
 *
 * Based on: https://github.com/grll/claude-code-login
 */
import { randomBytes, createHash } from 'node:crypto'
import { CLAUDE_OAUTH_CONFIG } from './claude-oauth-config'
import { openUrl } from '../utils/open-url.ts'
import { APP_VERSION } from '../version/index.ts'

// OAuth configuration from shared config
const CLAUDE_CLIENT_ID = CLAUDE_OAUTH_CONFIG.CLIENT_ID
const CLAUDE_AUTH_URL = CLAUDE_OAUTH_CONFIG.AUTH_URL
const CLAUDE_TOKEN_URL = CLAUDE_OAUTH_CONFIG.TOKEN_URL
const REDIRECT_URI = CLAUDE_OAUTH_CONFIG.REDIRECT_URI
const OAUTH_SCOPES = CLAUDE_OAUTH_CONFIG.SCOPES
const STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Beta header required for claude.ai OAuth endpoints (profile, usage, etc.).
 * Mirrors what the Claude CLI sends — omitting it may result in 429s or
 * stricter rate limiting.
 */
const CLAUDE_OAUTH_BETA = 'oauth-2025-04-20'

export interface ClaudeTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scopes?: string[]
}

/**
 * User profile info returned by the /api/oauth/profile endpoint.
 * Populated after OAuth completes — stored on the LlmConnection so that
 * the Account modal can display email/org/plan for the active connection.
 */
export interface ClaudeProfile {
  email?: string
  displayName?: string
  accountUuid?: string
  organizationName?: string
  organizationUuid?: string
  /** normalized: 'max' | 'pro' | 'enterprise' | 'team' */
  subscriptionType?: string
  /** raw tier string from the API, e.g. 'default_claude_max_5x' */
  rateLimitTier?: string
  billingType?: string
  hasExtraUsageEnabled?: boolean
  /** ISO timestamp when the profile was fetched */
  fetchedAt?: string
}

/**
 * Fetch the authenticated user's profile from claude.ai.
 * Mirrors what the Claude CLI does on OAuth completion.
 * Returns null on any failure (expired token, network, etc.) — callers should
 * treat profile data as best-effort.
 */
export async function fetchClaudeProfile(accessToken: string): Promise<ClaudeProfile | null> {
  try {
    const response = await fetch('https://api.anthropic.com/api/oauth/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': `CrabPal/${APP_VERSION}`,
        'anthropic-beta': CLAUDE_OAUTH_BETA,
      },
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(
        `[claude-oauth] fetchClaudeProfile failed: ${response.status} ${response.statusText} — ${body.slice(0, 300)}`,
      )
      return null
    }

    const data = (await response.json()) as {
      account?: {
        email?: string
        display_name?: string
        full_name?: string
        uuid?: string
      }
      organization?: {
        uuid?: string
        name?: string
        organization_type?: string
        rate_limit_tier?: string
        billing_type?: string
        has_extra_usage_enabled?: boolean
      }
    }

    // Map organization_type → normalized subscription plan
    const subscriptionMap: Record<string, string> = {
      claude_max: 'max',
      claude_pro: 'pro',
      claude_enterprise: 'enterprise',
      claude_team: 'team',
    }
    const orgType = data.organization?.organization_type
    const subscriptionType = orgType ? subscriptionMap[orgType] ?? orgType : undefined

    return {
      email: data.account?.email,
      displayName: data.account?.display_name ?? data.account?.full_name,
      accountUuid: data.account?.uuid,
      organizationName: data.organization?.name,
      organizationUuid: data.organization?.uuid,
      subscriptionType,
      rateLimitTier: data.organization?.rate_limit_tier,
      billingType: data.organization?.billing_type,
      hasExtraUsageEnabled: data.organization?.has_extra_usage_enabled,
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn('[claude-oauth] fetchClaudeProfile threw:', err)
    return null
  }
}

/**
 * A single rate-limit entry from the /api/oauth/usage endpoint.
 * Matches the shape returned by the Account & Usage modal consumer.
 */
export interface ClaudeUsageEntry {
  /** normalized to SDK's rateLimitType union */
  rateLimitType: 'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet' | 'overage'
  /** 0..1 utilization (converted from percentage) */
  utilization: number
  /** milliseconds epoch when this window resets */
  resetsAt?: number
  status: 'allowed' | 'allowed_warning' | 'rejected'
}

/**
 * Fetch all rate-limit buckets (5hr session, 7-day weekly, Opus, Sonnet, overage)
 * from claude.ai in one call. The SDK emits `rate_limit_event` messages only
 * when thresholds are crossed during a turn, so this endpoint is what we use
 * to populate the Usage section up-front on modal open.
 *
 * Returns [] on failure.
 */
export async function fetchClaudeUsage(accessToken: string): Promise<ClaudeUsageEntry[]> {
  try {
    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': `CrabPal/${APP_VERSION}`,
        'anthropic-beta': CLAUDE_OAUTH_BETA,
      },
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(
        `[claude-oauth] fetchClaudeUsage failed: ${response.status} ${response.statusText} — ${body.slice(0, 300)}`,
      )
      return []
    }

    const data = (await response.json()) as Partial<Record<ClaudeUsageEntry['rateLimitType'], {
      utilization?: number
      resets_at?: string | null
    } | null>>

    const types: ClaudeUsageEntry['rateLimitType'][] = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet', 'overage']
    const out: ClaudeUsageEntry[] = []
    for (const rateLimitType of types) {
      const bucket = data[rateLimitType]
      if (!bucket) continue
      // API returns utilization as a percentage (e.g. 23.0 = 23%).
      // Our consumer expects 0..1, so divide when the value exceeds 1.
      const raw = typeof bucket.utilization === 'number' ? bucket.utilization : 0
      const utilization = raw > 1 ? raw / 100 : raw
      const status: ClaudeUsageEntry['status'] = utilization >= 1 ? 'rejected' : utilization >= 0.9 ? 'allowed_warning' : 'allowed'
      // resets_at is an ISO 8601 string (e.g. "2026-04-18T11:59:59.970949+00:00")
      const resetsAt = bucket.resets_at ? new Date(bucket.resets_at).getTime() : undefined
      out.push({ rateLimitType, utilization, resetsAt, status })
    }
    return out
  } catch (err) {
    console.warn('[claude-oauth] fetchClaudeUsage threw:', err)
    return []
  }
}

export interface ClaudeOAuthState {
  state: string
  codeVerifier: string
  timestamp: number
  expiresAt: number
}

// In-memory state storage for the current OAuth flow
let currentOAuthState: ClaudeOAuthState | null = null

/**
 * Generate a secure random state parameter
 */
function generateState(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  return { codeVerifier, codeChallenge }
}

/**
 * Prepare the OAuth flow by generating PKCE, state, and the auth URL.
 * Does NOT open the browser — the caller is responsible for that.
 *
 * Returns the authorization URL. The caller should open it on the user's
 * machine (client-side), not on the server.
 */
export function prepareClaudeOAuth(): string {
  const state = generateState()
  const { codeVerifier, codeChallenge } = generatePKCE()

  const now = Date.now()
  currentOAuthState = {
    state,
    codeVerifier,
    timestamp: now,
    expiresAt: now + STATE_EXPIRY_MS,
  }

  const params = new URLSearchParams({
    code: 'true',
    client_id: CLAUDE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: OAUTH_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  return `${CLAUDE_AUTH_URL}?${params.toString()}`
}

/**
 * Start the OAuth flow by generating the login URL and opening the browser.
 *
 * @deprecated Use prepareClaudeOAuth() + open browser on the client instead.
 * This function opens the browser on the server host, which fails in remote mode.
 */
export async function startClaudeOAuth(
  onStatus?: (message: string) => void
): Promise<string> {
  onStatus?.('Generating authentication URL...')

  const authUrl = prepareClaudeOAuth()

  // Open browser (server-side — broken in remote mode)
  onStatus?.('Opening browser for authentication...')
  await openUrl(authUrl)

  onStatus?.('Waiting for you to copy the authorization code...')

  return authUrl
}

/**
 * Check if there is a valid OAuth state in progress
 */
export function hasValidOAuthState(): boolean {
  if (!currentOAuthState) return false
  return Date.now() < currentOAuthState.expiresAt
}

/**
 * Get the current OAuth state (for debugging/display)
 */
export function getCurrentOAuthState(): ClaudeOAuthState | null {
  return currentOAuthState
}

/**
 * Clear the current OAuth state
 */
export function clearOAuthState(): void {
  currentOAuthState = null
}

/**
 * Exchange an authorization code for tokens
 *
 * Call this after the user has authenticated and copied the authorization code
 * from the callback page.
 */
export async function exchangeClaudeCode(
  authorizationCode: string,
  onStatus?: (message: string) => void
): Promise<ClaudeTokens> {
  // Verify we have valid state
  if (!currentOAuthState) {
    throw new Error('No OAuth state found. Please start the authentication flow again.')
  }

  if (Date.now() > currentOAuthState.expiresAt) {
    clearOAuthState()
    throw new Error('OAuth state expired (older than 10 minutes). Please try again.')
  }

  // Clean up the authorization code in case it has URL fragments
  const cleanedCode = authorizationCode.split('#')[0]?.split('&')[0] ?? authorizationCode

  onStatus?.('Exchanging authorization code for tokens...')

  const params = {
    grant_type: 'authorization_code',
    client_id: CLAUDE_CLIENT_ID,
    code: cleanedCode,
    redirect_uri: REDIRECT_URI,
    code_verifier: currentOAuthState.codeVerifier,
    state: currentOAuthState.state,
  }

  try {
    const response = await fetch(CLAUDE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `CrabPal/${APP_VERSION}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage: string
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error_description || errorJson.error || errorText
      } catch {
        errorMessage = errorText
      }
      throw new Error(`Token exchange failed: ${response.status} - ${errorMessage}`)
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }

    // Clear state after successful exchange
    clearOAuthState()

    onStatus?.('Authentication successful!')

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      scopes: data.scope ? data.scope.split(' ') : ['user:inference', 'user:profile'],
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Token exchange failed: ${String(error)}`)
  }
}

/**
 * Convenience function that combines startClaudeOAuth and exchangeClaudeCode
 * for use cases where the code is provided via a callback
 *
 * @deprecated Use startClaudeOAuth and exchangeClaudeCode separately
 */
export async function authenticateWithClaude(options?: {
  onStatus?: (message: string) => void
  getAuthorizationCode: () => Promise<string>
}): Promise<ClaudeTokens> {
  const onStatus = options?.onStatus
  const getAuthorizationCode = options?.getAuthorizationCode

  if (!getAuthorizationCode) {
    throw new Error('getAuthorizationCode callback is required')
  }

  await startClaudeOAuth(onStatus)
  const code = await getAuthorizationCode()
  return exchangeClaudeCode(code, onStatus)
}
