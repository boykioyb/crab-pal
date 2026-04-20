import * as React from 'react'
import { X, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AccountInfo {
  email?: string
  organization?: string
  subscriptionType?: string
  tokenSource?: string
  apiProvider?: string
}

interface RateLimitEntry {
  label: string
  rateLimitType: string
  utilization: number
  resetsAt?: number
  status: string
}

interface AccountUsageModalProps {
  open: boolean
  onClose: () => void
  connectionSlug?: string
}

function formatResetTime(resetsAt?: number): string {
  if (!resetsAt) return ''
  const now = Date.now()
  const diffMs = resetsAt - now
  if (diffMs <= 0) return 'Resetting now'

  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) return `Resets in ${hours}h ${minutes}m`
  if (hours > 0) return `Resets in ${hours}h`
  if (minutes > 0) return `Resets in ${minutes}m`
  return 'Resets in <1m'
}

function formatAuthMethod(tokenSource?: string, apiProvider?: string): string {
  if (apiProvider === 'bedrock') return 'AWS Bedrock'
  if (apiProvider === 'vertex') return 'Google Vertex'
  if (apiProvider === 'foundry') return 'Azure Foundry'
  switch (tokenSource) {
    case 'oauth':
    case 'claudeAiOauth':
    case 'CLAUDE_CODE_OAUTH_TOKEN':
    case 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR':
      return 'Claude.ai OAuth'
    case 'api-key':
    case 'ANTHROPIC_API_KEY':
      return 'API Key'
    case 'bedrock':
    case 'CLAUDE_CODE_USE_BEDROCK':
      return 'AWS Bedrock'
    case 'vertex':
    case 'CLAUDE_CODE_USE_VERTEX':
      return 'Google Vertex'
    default:
      return tokenSource ?? 'Unknown'
  }
}

function formatPlan(subscriptionType?: string): string {
  if (!subscriptionType) return 'Unknown'
  const map: Record<string, string> = {
    free: 'Free',
    pro: 'Pro',
    max: 'Max',
    'claude-pro': 'Claude Pro',
    'claude-max': 'Claude Max',
    team: 'Team',
    enterprise: 'Enterprise',
  }
  return map[subscriptionType.toLowerCase()] ?? subscriptionType
}

function getRateLimitLabel(rateLimitType: string): string {
  switch (rateLimitType) {
    case 'five_hour': return 'Session (5hr)'
    case 'seven_day': return 'Weekly (7 day)'
    case 'seven_day_sonnet': return 'Weekly Sonnet'
    case 'seven_day_opus': return 'Weekly Opus'
    case 'overage': return 'Overage'
    default: return rateLimitType
  }
}

export function AccountUsageModal({ open, onClose, connectionSlug }: AccountUsageModalProps) {
  const [accountInfo, setAccountInfo] = React.useState<AccountInfo | null>(null)
  const [rateLimitEntries, setRateLimitEntries] = React.useState<RateLimitEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadData = React.useCallback(async (force: boolean) => {
    const setBusy = force ? setRefreshing : setLoading
    setBusy(true)
    setError(null)
    try {
      const infoOpts = connectionSlug ? { connectionSlug } : undefined
      const rateOpts = force || connectionSlug ? { ...(force ? { force: true } : {}), ...(connectionSlug ? { connectionSlug } : {}) } : undefined
      const [info, rateLimits] = await Promise.all([
        window.electronAPI?.getAccountInfo?.(infoOpts).catch(() => null),
        window.electronAPI?.getRateLimitInfo?.(rateOpts).catch(() => null),
      ])
      setAccountInfo(info ?? null)

      const raw = Array.isArray(rateLimits) ? rateLimits : rateLimits ? [rateLimits] : []
      const entries: RateLimitEntry[] = raw
        .filter((r): r is (typeof r & { rateLimitType: string }) => !!r?.rateLimitType)
        .map((r) => ({
          label: getRateLimitLabel(r.rateLimitType),
          rateLimitType: r.rateLimitType,
          utilization: r.utilization ?? 0,
          resetsAt: r.resetsAt,
          status: r.status,
        }))
      setRateLimitEntries(entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account info')
    } finally {
      setBusy(false)
    }
  }, [connectionSlug])

  React.useEffect(() => {
    if (!open) return
    loadData(false)
  }, [open, loadData])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="max-w-sm p-0 gap-0 bg-background border border-border/30 rounded-lg shadow-lg overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-semibold text-foreground">Account &amp; Usage</DialogTitle>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { if (!refreshing) loadData(true) }}
              disabled={refreshing || loading}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5">
          {loading && (
            <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
          )}

          {error && (
            <div className="text-xs text-destructive text-center py-2">{error}</div>
          )}

          {!loading && (
            <>
              {/* Account Section */}
              <div className="space-y-2">
                <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Account
                </div>
                <div className="space-y-1.5">
                  <AccountRow
                    label="Auth method"
                    value={formatAuthMethod(accountInfo?.tokenSource, accountInfo?.apiProvider)}
                  />
                  <AccountRow
                    label="Email"
                    value={accountInfo?.email ?? '—'}
                  />
                  <AccountRow
                    label="Organization"
                    value={accountInfo?.organization ?? '—'}
                  />
                  <AccountRow
                    label="Plan"
                    value={formatPlan(accountInfo?.subscriptionType)}
                  />
                </div>
              </div>

              {/* Usage Section */}
              {rateLimitEntries.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Usage
                  </div>
                  <div className="space-y-3">
                    {rateLimitEntries.map((entry) => (
                      <UsageRow key={entry.rateLimitType} entry={entry} />
                    ))}
                  </div>
                </div>
              )}

              {/* Manage link */}
              <div className="pt-1 pb-1">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  onClick={() => {
                    window.electronAPI?.openUrl?.('https://claude.ai/settings/billing')
                  }}
                >
                  Manage usage on claude.ai
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground font-medium text-right truncate">{value}</span>
    </div>
  )
}

function UsageRow({ entry }: { entry: RateLimitEntry }) {
  const pct = Math.min(100, Math.max(0, Math.round((entry.utilization ?? 0) * 100)))
  // Hide reset label when utilization is 0 — API can return a stale/past
  // resets_at for an empty window, which would misleadingly show "Resetting now".
  const resetText = pct > 0 ? formatResetTime(entry.resetsAt) : ''
  const isWarning = entry.status === 'allowed_warning'
  const isRejected = entry.status === 'rejected'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">{entry.label}</span>
        <div className="flex items-center gap-2">
          {resetText && (
            <span className="text-xs text-muted-foreground">{resetText}</span>
          )}
          <span className={cn(
            'text-sm font-medium',
            isRejected ? 'text-destructive' : isWarning ? 'text-amber-500' : 'text-foreground'
          )}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isRejected ? 'bg-destructive' : isWarning ? 'bg-amber-500' : 'bg-accent'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
