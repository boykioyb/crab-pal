/**
 * ProjectSettingsDialog (Phase 4)
 *
 * Edit name, rootPath, color; delete with cascade confirm.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDirectoryPicker } from '@/hooks/useDirectoryPicker'
import { ServerDirectoryBrowser } from '@/components/ServerDirectoryBrowser'
import { useRegisterModal } from '@/context/ModalContext'
import {
  updateProjectAtom,
  deleteProjectAtom,
  projectByIdAtom,
} from '@/atoms/projects'
import { sessionsByProjectAtom } from '@/atoms/sessions'

interface ProjectSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectId: string
  /** When true, open directly on the delete-confirm view. */
  initialConfirmDelete?: boolean
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  initialConfirmDelete = false,
}: ProjectSettingsDialogProps) {
  const project = useAtomValue(projectByIdAtom(projectId))
  const sessionsByProject = useAtomValue(sessionsByProjectAtom)
  const sessionCount = sessionsByProject.get(projectId)?.length ?? 0

  const [name, setName] = useState('')
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [color, setColor] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const updateProject = useSetAtom(updateProjectAtom)
  const deleteProject = useSetAtom(deleteProjectAtom)

  useRegisterModal(open, () => onOpenChange(false))

  useEffect(() => {
    if (open && project) {
      setName(project.name)
      setRootPath(project.rootPath)
      setColor(project.color ?? '')
      setSubmitting(false)
      setConfirmingDelete(initialConfirmDelete)
      if (!initialConfirmDelete) {
        const t = setTimeout(() => nameInputRef.current?.focus(), 0)
        return () => clearTimeout(t)
      }
    }
  }, [open, project, initialConfirmDelete])

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

  const trimmedName = name.trim()
  const canSubmit = !!project && !!trimmedName && !!rootPath && !submitting

  const handleSave = useCallback(async () => {
    if (!canSubmit || !project || !rootPath) return
    setSubmitting(true)
    try {
      await updateProject({
        workspaceId,
        projectId: project.id,
        patch: {
          name: trimmedName,
          rootPath,
          color: color || undefined,
        },
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast.error('Could not save project', { description: message })
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, project, rootPath, trimmedName, color, updateProject, workspaceId, onOpenChange])

  const handleDelete = useCallback(async () => {
    if (!project) return
    setSubmitting(true)
    try {
      await deleteProject({ workspaceId, projectId: project.id })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast.error('Could not delete project', { description: message })
    } finally {
      setSubmitting(false)
    }
  }, [project, deleteProject, workspaceId, onOpenChange])

  if (!project) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{confirmingDelete ? 'Delete Project' : 'Project Settings'}</DialogTitle>
          </DialogHeader>
          {!confirmingDelete ? (
            <>
              <div className="py-2 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Name</label>
                  <Input
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Project"
                  />
                </div>
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
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Color (optional)</label>
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#8B5CF6 or theme key"
                  />
                </div>
              </div>
              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={submitting}
                  className="text-destructive hover:text-destructive"
                >
                  Delete…
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={!canSubmit}>
                    {submitting ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="py-3 text-sm text-foreground/80">
                This will delete <strong>{sessionCount}</strong>{' '}
                {sessionCount === 1 ? 'session' : 'sessions'} in this project. This cannot be undone.
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmingDelete(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {submitting ? 'Deleting…' : 'Delete Project'}
                </Button>
              </DialogFooter>
            </>
          )}
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
