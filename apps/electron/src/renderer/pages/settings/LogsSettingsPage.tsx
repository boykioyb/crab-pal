/**
 * LogsSettingsPage
 *
 * In-app log viewer. Reads the main-process log file (JSON lines written by
 * electron-log) via IPC, tails it for new lines, and provides client-side
 * filtering by level/scope/text.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'logs',
}

const MAX_LINES = 500

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'verbose' | 'silly'

interface LogEntry {
  id: number
  timestamp?: string
  level: string
  scope?: string
  message: string
  raw: string
}

let nextId = 1

function parseLine(raw: string): LogEntry {
  try {
    const parsed = JSON.parse(raw) as {
      timestamp?: string
      level?: string
      scope?: string
      message?: unknown
    }
    const message = Array.isArray(parsed.message)
      ? parsed.message.map(m => (typeof m === 'string' ? m : JSON.stringify(m))).join(' ')
      : typeof parsed.message === 'string' ? parsed.message : JSON.stringify(parsed.message ?? '')
    return {
      id: nextId++,
      timestamp: parsed.timestamp,
      level: (parsed.level ?? 'info').toLowerCase(),
      scope: parsed.scope,
      message,
      raw,
    }
  } catch {
    return { id: nextId++, level: 'info', message: raw, raw }
  }
}

const LEVEL_FILTERS: Array<{ value: 'all' | LogLevel; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
]

function levelClass(level: string): string {
  switch (level) {
    case 'error': return 'text-red-500'
    case 'warn': return 'text-amber-500'
    case 'info': return 'text-blue-500'
    case 'debug': return 'text-muted-foreground'
    default: return 'text-foreground/70'
  }
}

function formatTimestamp(ts?: string): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, { hour12: false }) + '.'
      + String(d.getMilliseconds()).padStart(3, '0')
  } catch {
    return ts
  }
}

export default function LogsSettingsPage() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filePath, setFilePath] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<'all' | LogLevel>('all')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [loading, setLoading] = useState(true)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!window.electronAPI?.readLogs) {
        setLoading(false)
        return
      }
      try {
        const result = await window.electronAPI.readLogs({ tail: MAX_LINES })
        if (cancelled) return
        setFilePath(result.path)
        setEntries(result.lines.map(parseLine))
      } catch (err) {
        console.error('Failed to load logs:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.startLogsTail || !window.electronAPI?.onLogsNewLines) return
    let cleanup: (() => void) | undefined
    let stopped = false
    const run = async () => {
      cleanup = window.electronAPI.onLogsNewLines((lines: string[]) => {
        setEntries(prev => {
          const next = prev.concat(lines.map(parseLine))
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
        })
      })
      try {
        await window.electronAPI.startLogsTail()
      } catch (err) {
        console.error('Failed to start logs tail:', err)
      }
    }
    void run()
    return () => {
      stopped = true
      cleanup?.()
      window.electronAPI?.stopLogsTail?.().catch(() => { /* noop */ })
      void stopped
    }
  }, [])

  const scopes = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) if (e.scope) set.add(e.scope)
    return Array.from(set).sort()
  }, [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (levelFilter !== 'all' && e.level !== levelFilter) return false
      if (scopeFilter !== 'all' && e.scope !== scopeFilter) return false
      if (q && !e.message.toLowerCase().includes(q) && !(e.scope?.toLowerCase().includes(q))) return false
      return true
    })
  }, [entries, levelFilter, scopeFilter, search])

  useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [filtered, autoScroll])

  const handleOpenInFinder = useCallback(() => {
    if (filePath) void window.electronAPI?.showInFolder?.(filePath)
  }, [filePath])

  const handleClearView = useCallback(() => {
    setEntries([])
  }, [])

  const handleRefresh = useCallback(async () => {
    if (!window.electronAPI?.readLogs) return
    setLoading(true)
    try {
      const result = await window.electronAPI.readLogs({ tail: MAX_LINES })
      setFilePath(result.path)
      setEntries(result.lines.map(parseLine))
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="Logs" actions={<HeaderMenu route={routes.view.settings('logs')} />} />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-border/50 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {LEVEL_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setLevelFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition-colors',
                  levelFilter === f.value
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-foreground/15 text-foreground/70 hover:bg-foreground/5',
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-1" />
            <select
              value={scopeFilter}
              onChange={e => setScopeFilter(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-foreground/15 bg-background"
            >
              <option value="all">All scopes</option>
              {scopes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search log text…"
              className="h-7 text-xs max-w-xs"
            />
            <label className="flex items-center gap-1.5 text-xs text-foreground/70 ml-auto select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate flex-1">{filePath ?? 'Log file unavailable (packaged build)'}</span>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>Refresh</Button>
            <Button size="sm" variant="outline" onClick={handleClearView}>Clear view</Button>
            <Button size="sm" variant="outline" onClick={handleOpenInFinder} disabled={!filePath}>Open in Finder</Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Showing {filtered.length} of {entries.length} lines (cap {MAX_LINES}).
          </div>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-auto font-mono text-[11px] leading-[1.5] px-4 py-3 bg-background"
        >
          {filtered.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              {loading ? 'Loading…' : entries.length === 0 ? 'No log entries yet.' : 'No entries match the current filters.'}
            </div>
          ) : (
            filtered.map(e => (
              <div key={e.id} className="flex gap-2 whitespace-pre-wrap break-all py-[1px]">
                <span className="text-muted-foreground shrink-0 tabular-nums">{formatTimestamp(e.timestamp)}</span>
                <span className={cn('shrink-0 uppercase w-10', levelClass(e.level))}>{e.level}</span>
                {e.scope && <span className="text-muted-foreground shrink-0">[{e.scope}]</span>}
                <span className="flex-1">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
