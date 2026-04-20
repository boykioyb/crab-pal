import * as React from 'react'
import { X, RefreshCw, ChevronRight, ChevronDown, Layers, FileText, Wrench, Plug, MessageSquare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ContextBreakdown, ContextBucket, ContextBucketId } from '@crabpal/shared/agent'

interface ContextBreakdownModalProps {
  open: boolean
  onClose: () => void
  sessionId?: string
  /**
   * Live input tokens from the running agent's UsageTracker (matches the token pill).
   * Preferred over the persisted `totalActual` from session storage, which can be stale.
   */
  liveInputTokens?: number
  liveContextWindow?: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function bucketIcon(id: ContextBucketId) {
  switch (id) {
    case 'system':
      return FileText
    case 'tools':
      return Wrench
    case 'mcp':
      return Plug
    case 'memory':
      return FileText
    case 'messages':
      return MessageSquare
    default:
      return Layers
  }
}

export function ContextBreakdownModal({ open, onClose, sessionId, liveInputTokens, liveContextWindow }: ContextBreakdownModalProps) {
  const [data, setData] = React.useState<ContextBreakdown | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Set<ContextBucketId>>(new Set())

  const loadData = React.useCallback(async (force: boolean) => {
    if (!sessionId) return
    const setBusy = force ? setRefreshing : setLoading
    setBusy(true)
    setError(null)
    try {
      const result = await window.electronAPI?.getContextBreakdown?.(sessionId)
      setData(result ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load context')
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  React.useEffect(() => {
    if (!open) return
    setExpanded(new Set())
    loadData(false)
  }, [open, loadData])

  const toggleExpand = (id: ContextBucketId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Prefer the live UsageTracker value (drives the token pill in the input bar)
  // over the persisted `totalActual`, which lags behind until a turn completes.
  const effectiveActual =
    (liveInputTokens && liveInputTokens > 0 ? liveInputTokens : undefined) ??
    data?.totalActual
  const effectiveWindow =
    (liveContextWindow && liveContextWindow > 0 ? liveContextWindow : undefined) ??
    data?.contextWindow

  // The SDK auto-compacts at ~77.5% of the raw window — the pill in the input bar
  // shows `used / threshold`, not `used / window`. Match that so 80% in the pill == 80% here.
  const compactionThreshold = effectiveWindow ? Math.round(effectiveWindow * 0.775) : undefined

  const usedForHeader = effectiveActual ?? data?.totalEstimated ?? 0
  const totalForBars = compactionThreshold ?? effectiveWindow ?? Math.max(1, usedForHeader)

  const headerPct =
    compactionThreshold && compactionThreshold > 0
      ? Math.min(100, Math.round((usedForHeader / compactionThreshold) * 100))
      : null

  const effectiveFreeSpace =
    compactionThreshold !== undefined
      ? Math.max(0, compactionThreshold - usedForHeader)
      : undefined

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="max-w-md p-0 gap-0 bg-background border border-border/30 rounded-lg shadow-lg overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-sm font-semibold text-foreground">Context Window</DialogTitle>
            {data?.model && (
              <span className="text-[11px] text-muted-foreground">
                {data.model}
                {effectiveWindow ? ` · ${effectiveWindow.toLocaleString()} window` : ''}
                {compactionThreshold ? ` · auto-compacts at ${compactionThreshold.toLocaleString()}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { if (!refreshing && !loading) loadData(true) }}
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

        <div className="px-5 py-4 space-y-4">
          {loading && (
            <div className="text-xs text-muted-foreground text-center py-4">Loading…</div>
          )}

          {error && (
            <div className="text-xs text-destructive text-center py-2">{error}</div>
          )}

          {!loading && !error && data && (
            <>
              {/* Overall usage bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Total
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {usedForHeader.toLocaleString()}
                    {compactionThreshold ? ` / ${compactionThreshold.toLocaleString()}` : ''}
                    {headerPct !== null ? ` (${headerPct}%)` : ''}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${headerPct ?? Math.min(100, Math.round((usedForHeader / Math.max(1, totalForBars)) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Buckets */}
              <div className="space-y-2">
                <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Breakdown
                </div>
                <div className="space-y-2">
                  {data.buckets.map((bucket) => (
                    <BucketRow
                      key={bucket.id}
                      bucket={bucket}
                      total={totalForBars}
                      expanded={expanded.has(bucket.id)}
                      onToggle={() => toggleExpand(bucket.id)}
                    />
                  ))}

                  {effectiveFreeSpace !== undefined && compactionThreshold ? (
                    <FreeSpaceRow freeSpace={effectiveFreeSpace} total={compactionThreshold} />
                  ) : null}
                </div>
              </div>

              <div className="pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                {effectiveActual !== undefined
                  ? `Actual: ${effectiveActual.toLocaleString()} tokens (from live usage). `
                  : 'No API call yet — showing estimate only. '}
                Estimated: {data.totalEstimated.toLocaleString()} (heuristic).
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BucketRow({
  bucket,
  total,
  expanded,
  onToggle,
}: {
  bucket: ContextBucket
  total: number
  expanded: boolean
  onToggle: () => void
}) {
  const Icon = bucketIcon(bucket.id)
  const pct = total > 0 ? (bucket.tokens / total) * 100 : 0
  const hasSubItems = bucket.subItems && bucket.subItems.length > 0
  const topSubItems = hasSubItems ? bucket.subItems!.slice(0, 10) : []

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={hasSubItems ? onToggle : undefined}
        disabled={!hasSubItems}
        className={cn(
          'w-full flex items-center gap-2 py-0.5 text-left',
          hasSubItems && 'hover:bg-foreground/5 rounded-md px-1 -mx-1 cursor-pointer',
          !hasSubItems && 'cursor-default',
        )}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground flex-1 truncate">
          {bucket.label}
          {bucket.items !== undefined && bucket.items > 0 ? (
            <span className="text-muted-foreground"> ({bucket.items})</span>
          ) : null}
        </span>
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatTokens(bucket.tokens)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
          {pct >= 0.1 ? `${pct.toFixed(1)}%` : '—'}
        </span>
        {hasSubItems ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}
      </button>
      <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent/70 transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {expanded && hasSubItems && (
        <div className="pl-5 pt-1 space-y-0.5">
          {topSubItems.map((sub, idx) => (
            <div key={`${sub.label}-${idx}`} className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">{sub.label}</span>
              <span className="tabular-nums">{formatTokens(sub.tokens)}</span>
            </div>
          ))}
          {bucket.subItems!.length > topSubItems.length && (
            <div className="text-[11px] text-muted-foreground italic">
              …and {bucket.subItems!.length - topSubItems.length} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FreeSpaceRow({ freeSpace, total }: { freeSpace: number; total: number }) {
  const pct = total > 0 ? (freeSpace / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="w-full flex items-center gap-2 py-0.5">
        <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-40" />
        <span className="text-sm text-muted-foreground flex-1">Free space</span>
        <span className="text-sm font-medium text-muted-foreground tabular-nums">
          {formatTokens(freeSpace)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
          {pct.toFixed(1)}%
        </span>
        <span className="w-3" />
      </div>
      <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground/20 transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}
