import * as React from 'react'
import { cn } from '@/lib/utils'
import { CHAT_LAYOUT } from '@/config/layout'
import { flattenLabels, type LabelConfig } from '@crabpal/shared/labels'
import type { PermissionMode } from '@crabpal/shared/agent/modes'
import type { SessionStatus } from '@/config/session-status-config'
import type { BackgroundTask } from '../ActiveTasksBar'
import { ActiveOptionBadges } from '../ActiveOptionBadges'
import { InputContainer } from './InputContainer'
import { CrabWalker } from './CrabWalker'

interface ChatInputZoneProps {
  compactMode?: boolean
  showOptionBadges?: boolean
  permissionMode?: PermissionMode
  onPermissionModeChange?: (mode: PermissionMode) => void
  tasks?: BackgroundTask[]
  sessionId: string
  sessionFolderPath?: string
  onKillTask?: (taskId: string) => void
  onInsertMessage?: (text: string) => void
  sessionLabels?: string[]
  labels?: LabelConfig[]
  onLabelsChange?: (labels: string[]) => void
  sessionStatuses?: SessionStatus[]
  currentSessionStatus?: string
  onSessionStatusChange?: (stateId: string) => void
  className?: string
  inputProps: React.ComponentProps<typeof InputContainer>
}

export function ChatInputZone({
  compactMode = false,
  showOptionBadges,
  permissionMode = 'ask',
  onPermissionModeChange,
  tasks = [],
  sessionId,
  sessionFolderPath,
  onKillTask,
  onInsertMessage,
  sessionLabels = [],
  labels = [],
  onLabelsChange,
  sessionStatuses = [],
  currentSessionStatus = 'todo',
  onSessionStatusChange,
  className,
  inputProps,
}: ChatInputZoneProps) {
  const [autoOpenLabelId, setAutoOpenLabelId] = React.useState<string | null>(null)
  const shouldShowOptionBadges = showOptionBadges ?? !compactMode

  const handleLabelAdd = React.useCallback((labelId: string) => {
    const current = sessionLabels || []
    if (current.includes(labelId)) return

    onLabelsChange?.([...current, labelId])

    const config = flattenLabels(labels || []).find(label => label.id === labelId)
    if (config?.valueType) {
      setAutoOpenLabelId(labelId)
    }
  }, [labels, onLabelsChange, sessionLabels])

  return (
    <div className={cn(
      CHAT_LAYOUT.maxWidth,
      'mx-auto w-full mt-1',
      compactMode ? 'px-2 pb-3' : 'px-4 @xs/panel:px-5 pb-5',
      className,
    )}>
      <CrabWalker className="mb-1" />
      <InputContainer
        {...inputProps}
        compactMode={compactMode}
        permissionMode={permissionMode}
        onPermissionModeChange={onPermissionModeChange}
        labels={labels}
        sessionLabels={sessionLabels}
        onLabelAdd={handleLabelAdd}
        sessionFolderPath={sessionFolderPath}
        sessionId={sessionId}
        currentSessionStatus={currentSessionStatus}
        headerSlot={shouldShowOptionBadges ? (
          <ActiveOptionBadges
            permissionMode={permissionMode}
            onPermissionModeChange={onPermissionModeChange}
            tasks={tasks}
            sessionId={sessionId}
            sessionFolderPath={sessionFolderPath}
            onKillTask={onKillTask}
            onInsertMessage={onInsertMessage ?? inputProps.onInputChange}
            sessionLabels={sessionLabels}
            labels={labels}
            onLabelsChange={onLabelsChange}
            onRemoveLabel={(labelId) => {
              const next = (sessionLabels || []).filter(entry => entry !== labelId && !entry.startsWith(`${labelId}::`))
              onLabelsChange?.(next)
            }}
            autoOpenLabelId={autoOpenLabelId}
            onAutoOpenConsumed={() => setAutoOpenLabelId(null)}
            sessionStatuses={sessionStatuses}
            currentSessionStatus={currentSessionStatus}
            onSessionStatusChange={onSessionStatusChange}
          />
        ) : undefined}
      />
    </div>
  )
}
