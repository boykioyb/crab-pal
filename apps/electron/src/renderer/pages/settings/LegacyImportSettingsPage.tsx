import { useState, useEffect, useCallback, useMemo } from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import { Spinner } from '@crabpal/ui'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import {
  SettingsSection,
  SettingsCard,
  SettingsToggle,
  SettingsRadioGroup,
  SettingsRadioCard,
} from '@/components/settings'
import type {
  LegacyPresence,
  LegacyCategory,
  PreviewResult,
  ImportResult,
  ImportProgressEvent,
  ImportStrategy,
} from '@crabpal/shared/config'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'legacy-import',
}

interface CategoryDef {
  id: LegacyCategory
  label: string
  description: string
}

const CATEGORY_DEFS: CategoryDef[] = [
  { id: 'config', label: 'LLM connections & app config', description: 'config.json — provider/model setup' },
  { id: 'preferences', label: 'User preferences', description: 'preferences.json' },
  { id: 'credentials', label: 'Saved credentials', description: 'Encrypted credentials blob (copy only if missing)' },
  { id: 'drafts', label: 'Message drafts', description: 'Unsent message drafts per session' },
  { id: 'sessions', label: 'Chat sessions', description: 'All workspace sessions and their events' },
  { id: 'sources', label: 'MCP / API sources', description: 'Source definitions per workspace' },
  { id: 'skills', label: 'Custom skills', description: 'Workspace skill definitions' },
  { id: 'automations', label: 'Automations', description: 'Non-duplicate automation rules (append)' },
  { id: 'labels-statuses', label: 'Labels & statuses', description: 'Workspace labels and statuses' },
  { id: 'permissions', label: 'Permission configs', description: 'Default + workspace permissions' },
  { id: 'themes', label: 'Themes & tool icons', description: 'Custom themes and tool-icon mappings' },
  { id: 'window-state', label: 'Window layout', description: 'Last window position/size' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function LegacyImportSettingsPage() {
  const [presence, setPresence] = useState<LegacyPresence | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<LegacyCategory>>(new Set())
  const [strategy, setStrategy] = useState<ImportStrategy>('merge')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [running, setRunning] = useState(false)
  const [progressLog, setProgressLog] = useState<ImportProgressEvent[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await window.electronAPI.legacyImportDetect()
        if (cancelled) return
        setPresence(p)
        setSelected(new Set(p.categoriesAvailable))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const off = window.electronAPI.onLegacyImportProgress(event => {
      setProgressLog(prev => [...prev, event])
    })
    return () => off()
  }, [])

  const availableSet = useMemo(
    () => new Set(presence?.categoriesAvailable ?? []),
    [presence?.categoriesAvailable],
  )

  const toggleCategory = useCallback((id: LegacyCategory, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handlePreview = useCallback(async () => {
    setPreviewing(true)
    setError(null)
    setResult(null)
    try {
      const cats = Array.from(selected)
      const p = await window.electronAPI.legacyImportPreview(cats)
      setPreview(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreviewing(false)
    }
  }, [selected])

  const handleRun = useCallback(async () => {
    setRunning(true)
    setError(null)
    setProgressLog([])
    setResult(null)
    try {
      const cats = Array.from(selected)
      const r = await window.electronAPI.legacyImportRun({
        categories: cats,
        strategy,
        dryRun: false,
      })
      setResult(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [selected, strategy])

  const handleOpenLegacy = useCallback(() => {
    if (!presence) return
    window.electronAPI.openFile(presence.path)
  }, [presence])

  const handleOpenCrabpal = useCallback(async () => {
    const home = await window.electronAPI.getHomeDir()
    window.electronAPI.openFile(`${home}/.crabpal`)
  }, [])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title="Import from craft-agent"
        actions={
          <HeaderMenu route={routes.view.settings('legacy-import')} />
        }
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <div className="space-y-8">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> Detecting legacy data…
                </div>
              ) : !presence?.exists ? (
                <SettingsSection title="Legacy data">
                  <SettingsCard>
                    <div className="px-4 py-3.5 text-sm text-muted-foreground">
                      No craft-agent data found at <code>{presence?.path ?? '~/.craft-agent'}</code>. Nothing to import.
                    </div>
                  </SettingsCard>
                </SettingsSection>
              ) : (
                <>
                  <SettingsSection title="Source">
                    <SettingsCard>
                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{presence.path}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(presence.sizeBytes)} — {presence.categoriesAvailable.length} categories available
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button variant="outline" size="sm" onClick={handleOpenLegacy}>
                            Open legacy folder
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleOpenCrabpal}>
                            Open crabpal folder
                          </Button>
                        </div>
                      </div>
                    </SettingsCard>
                  </SettingsSection>

                  <SettingsSection
                    title="What to import"
                    description="Unavailable categories are disabled."
                  >
                    <SettingsCard>
                      {CATEGORY_DEFS.map(def => {
                        const available = availableSet.has(def.id)
                        return (
                          <SettingsToggle
                            key={def.id}
                            label={def.label}
                            description={def.description}
                            checked={selected.has(def.id) && available}
                            onCheckedChange={checked => toggleCategory(def.id, checked)}
                            disabled={!available}
                          />
                        )
                      })}
                    </SettingsCard>
                  </SettingsSection>

                  <SettingsSection
                    title="Conflict strategy"
                    description="Applies when the target already has data for an item."
                  >
                    <SettingsCard>
                      <div className="px-4 py-3.5">
                        <SettingsRadioGroup<ImportStrategy>
                          value={strategy}
                          onValueChange={setStrategy}
                        >
                          <SettingsRadioCard
                            value="merge"
                            label="Merge (skip existing)"
                            description="Never clobber existing data. Safe default."
                          />
                          <SettingsRadioCard
                            value="overwrite"
                            label="Overwrite"
                            description="Replace any conflicting entries with the legacy copy."
                          />
                        </SettingsRadioGroup>
                      </div>
                    </SettingsCard>
                  </SettingsSection>

                  <SettingsSection title="Run">
                    <SettingsCard>
                      <div className="px-4 py-3.5 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={handlePreview}
                          disabled={previewing || running || selected.size === 0}
                        >
                          {previewing ? 'Previewing…' : 'Preview'}
                        </Button>
                        <Button
                          onClick={handleRun}
                          disabled={previewing || running || selected.size === 0}
                        >
                          {running ? 'Importing…' : 'Start Import'}
                        </Button>
                      </div>
                    </SettingsCard>
                  </SettingsSection>

                  {error && (
                    <SettingsSection title="Error">
                      <SettingsCard>
                        <div className="px-4 py-3.5 text-sm text-destructive">{error}</div>
                      </SettingsCard>
                    </SettingsSection>
                  )}

                  {preview && (
                    <SettingsSection title="Preview">
                      <SettingsCard>
                        <div className="px-4 py-3.5 text-sm space-y-2">
                          {preview.categories.map(cat => (
                            <div key={cat.category}>
                              <div className="font-medium">{cat.category}</div>
                              <div className="text-xs text-muted-foreground">
                                {cat.willCopy.length} to copy · {cat.willSkip.length} to skip
                              </div>
                            </div>
                          ))}
                        </div>
                      </SettingsCard>
                    </SettingsSection>
                  )}

                  {(running || progressLog.length > 0) && (
                    <SettingsSection title="Progress">
                      <SettingsCard>
                        <div className="px-4 py-3.5 text-xs font-mono max-h-64 overflow-auto space-y-0.5">
                          {progressLog.map((evt, i) => (
                            <div
                              key={i}
                              className={
                                evt.action === 'error'
                                  ? 'text-destructive'
                                  : evt.action === 'skipped'
                                  ? 'text-muted-foreground'
                                  : ''
                              }
                            >
                              [{evt.category}] {evt.phase}
                              {evt.action ? ` · ${evt.action}` : ''}
                              {evt.path ? ` · ${evt.path}` : ''}
                              {evt.reason ? ` (${evt.reason})` : ''}
                              {evt.message ? ` — ${evt.message}` : ''}
                            </div>
                          ))}
                        </div>
                      </SettingsCard>
                    </SettingsSection>
                  )}

                  {result && (
                    <SettingsSection title="Result">
                      <SettingsCard>
                        <div className="px-4 py-3.5 text-sm">
                          Copied {result.copied.length} · Skipped {result.skipped.length} · Errors {result.errors.length} · {result.durationMs}ms
                        </div>
                      </SettingsCard>
                    </SettingsSection>
                  )}
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
