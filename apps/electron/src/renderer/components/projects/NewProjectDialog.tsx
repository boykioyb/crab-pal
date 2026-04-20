/**
 * NewProjectDialog (Phase 4)
 *
 * Folder picker only. Project name is auto-derived from the folder basename.
 * On submit, calls addProjectAtom and sets the new project as active.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDirectoryPicker } from '@/hooks/useDirectoryPicker'
import { ServerDirectoryBrowser } from '@/components/ServerDirectoryBrowser'
import { useRegisterModal } from '@/context/ModalContext'
import {
  addProjectAtom,
  activeProjectIdAtom,
  projectsAtom,
} from '@/atoms/projects'

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

function folderBasename(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function NewProjectDialog({ open, onOpenChange, workspaceId }: NewProjectDialogProps) {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const addProject = useSetAtom(addProjectAtom)
  const setActiveProjectId = useSetAtom(activeProjectIdAtom)
  const projects = useAtomValue(projectsAtom)

  useRegisterModal(open, () => onOpenChange(false))

  useEffect(() => {
    if (open) {
      setRootPath(null)
      setSubmitting(false)
    }
  }, [open])

  const handleFolderSelected = useCallback((path: string) => {
    setRootPath(path)
  }, [])

  const {
    pickDirectory,
    showServerBrowser,
    serverBrowserMode,
    cancelServerBrowser,
    confirmServerBrowser,
  } = useDirectoryPicker(handleFolderSelected)

  const pathDuplicate = rootPath
    ? projects.some((p) => p.rootPath === rootPath)
    : false
  const validationError = rootPath && pathDuplicate
    ? 'Another project already uses this folder'
    : null
  const canSubmit = !!rootPath && !pathDuplicate && !submitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !rootPath) return
    const name = folderBasename(rootPath)
    setSubmitting(true)
    try {
      const created = await addProject({
        workspaceId,
        name,
        rootPath,
      })
      setActiveProjectId(created.id)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project'
      toast.error('Could not create project', { description: message })
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, rootPath, addProject, setActiveProjectId, workspaceId, onOpenChange])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Folder</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 text-xs text-muted-foreground truncate px-2 py-1.5 rounded-md bg-foreground/[0.03]">
                  {rootPath ?? 'No folder selected'}
                </div>
                <Button variant="outline" size="sm" onClick={() => pickDirectory()}>
                  Browse
                </Button>
              </div>
              {rootPath && (
                <p className="text-[11px] text-muted-foreground/80">
                  Name: <span className="text-foreground">{folderBasename(rootPath)}</span>
                </p>
              )}
              {validationError && (
                <p className="text-xs text-destructive">{validationError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ServerDirectoryBrowser
        open={showServerBrowser}
        mode={serverBrowserMode}
        onSelect={confirmServerBrowser}
        onCancel={cancelServerBrowser}
      />
    </>
  )
}
