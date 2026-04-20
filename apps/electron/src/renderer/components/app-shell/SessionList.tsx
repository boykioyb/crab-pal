import { useState, useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react"
import { useSetAtom, useAtomValue } from "jotai"
import { projectsAtom } from "@/atoms/projects"
import { createSessionAtom } from "@/atoms/sessions"
import { Plus, MoreHorizontal, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ProjectSettingsDialog } from "@/components/projects/ProjectSettingsDialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { isToday, isYesterday, format, startOfDay } from "date-fns"
import { useAction } from "@/actions"
import { Inbox, Archive } from "lucide-react"

import { getSessionStatus } from "@/utils/session"
import * as storage from "@/lib/local-storage"
import { KEYS } from "@/lib/local-storage"
import type { LabelConfig } from "@crabpal/shared/labels"
import { flattenLabels } from "@crabpal/shared/labels"
import * as MultiSelect from "@/hooks/useMultiSelect"
import { Spinner } from "@crabpal/ui"
import { EntityListEmptyScreen } from "@/components/ui/entity-list-empty"
import { EntityList, type EntityListGroup } from "@/components/ui/entity-list"
import { RenameDialog } from "@/components/ui/rename-dialog"
import { SessionSearchHeader } from "./SessionSearchHeader"
import { SessionItem } from "./SessionItem"
import { SessionListProvider, type SessionListContextValue } from "@/context/SessionListContext"
import { useSessionSelection, useSessionSelectionStore } from "@/hooks/useSession"
import { useSessionSearch, type FilterMode } from "@/hooks/useSessionSearch"
import { useSessionActions } from "@/hooks/useSessionActions"
import { useEntityListInteractions } from "@/hooks/useEntityListInteractions"
import { useFocusZone } from "@/hooks/keyboard"
import { useEscapeInterrupt } from "@/context/EscapeInterruptContext"
import { useNavigation, useNavigationState, routes, isSessionsNavigation } from "@/contexts/NavigationContext"
import { useFocusContext } from "@/context/FocusContext"
import { sendToWorkspaceAtom, type SessionMeta } from "@/atoms/sessions"
import type { ViewConfig } from "@crabpal/shared/views"
import type { SessionStatusId, SessionStatus } from "@/config/session-status-config"
import { buildCollapsedGroupsScopeSuffix } from "@/utils/session-list-collapse"

export interface SessionListRow {
  item: SessionMeta
}

/** Imperative handle exposed to parent components (e.g. the Chats section header
 * in the sidebar) so they can drive SessionList's collapse/expand state and
 * focus its internal search input. */
export interface SessionListHandle {
  collapseAll: () => void
  expandAll: () => void
  /** Focuses the search input if search is already active. Does NOT activate
   * search — call setSearchActive(true) at the parent level first. */
  focusSearchInput: () => void
}

/** Grouping mode for chat list */
export type ChatGroupingMode = 'date' | 'status' | 'byProject'

interface SessionListProps {
  items: SessionMeta[]
  onDelete: (sessionId: string, skipConfirmation?: boolean) => Promise<boolean>
  onFlag?: (sessionId: string) => void
  onUnflag?: (sessionId: string) => void
  onArchive?: (sessionId: string) => void
  onUnarchive?: (sessionId: string) => void
  onMarkUnread: (sessionId: string) => void
  onSessionStatusChange: (sessionId: string, state: SessionStatusId) => void
  onRename: (sessionId: string, name: string) => void
  /** Called when Enter is pressed to focus chat input for a specific session */
  onFocusChatInput?: (sessionId?: string) => void
  /** Called when a session is selected */
  onSessionSelect?: (session: SessionMeta) => void
  /** Called when user wants to open a session in a new window */
  onOpenInNewWindow?: (session: SessionMeta) => void
  /** Called to navigate to a specific view (e.g., 'allSessions', 'flagged') */
  onNavigateToView?: (view: 'allSessions' | 'flagged') => void
  /** Unified session options per session (real-time state) */
  sessionOptions?: Map<string, import('../../hooks/useSessionOptions').SessionOptions>
  /** Whether search mode is active */
  searchActive?: boolean
  /** Current search query */
  searchQuery?: string
  /** Called when search query changes */
  onSearchChange?: (query: string) => void
  /** Called when search is closed */
  onSearchClose?: () => void
  /** Dynamic todo states from workspace config */
  sessionStatuses?: SessionStatus[]
  /** View evaluator — evaluates a session and returns matching view configs */
  evaluateViews?: (meta: SessionMeta) => ViewConfig[]
  /** Label configs for resolving session label IDs to display info */
  labels?: LabelConfig[]
  /** Callback when session labels are toggled (for labels submenu in SessionMenu) */
  onLabelsChange?: (sessionId: string, labels: string[]) => void
  /** How to group sessions: 'date' (default) or 'status' */
  groupingMode?: ChatGroupingMode
  /** Workspace ID for content search (optional - if not provided, content search is disabled) */
  workspaceId?: string
  /** Secondary status filter (status chips in "All Sessions" view) - for search result grouping */
  statusFilter?: Map<string, FilterMode>
  /** Secondary label filter (label chips) - for search result grouping */
  labelFilterMap?: Map<string, FilterMode>
  /** Override which session is highlighted (for multi-panel focused panel tracking) */
  focusedSessionId?: string | null
  /** Override navigation target (for multi-panel: focuses existing panel or navigates focused panel) */
  onNavigateToSession?: (sessionId: string) => void
  /** Session-level pending prompt marker (permission/admin approval) */
  hasPendingPrompt?: (sessionId: string) => boolean
  /** DOM-verified match info for the active session (from ChatDisplay) */
  activeChatMatchInfo?: { sessionId: string | null; count: number; isHighlighting?: boolean }
}

// Re-export SessionStatusId for use by parent components
export type { SessionStatusId }

/** Default number of sessions shown per project before "Show more" is required.
 *  Matches the Codex sidebar cap. */
const PROJECT_ITEM_CAP = 6

function formatDateGroupLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d')
}

/**
 * SessionList - Scrollable list of session cards with keyboard navigation
 *
 * Keyboard shortcuts:
 * - Arrow Up/Down: Navigate and select sessions (immediate selection)
 * - Arrow Left/Right: Navigate between zones
 * - Enter: Focus chat input
 * - Home/End: Jump to first/last session
 */
export const SessionList = forwardRef<SessionListHandle, SessionListProps>(function SessionList({
  items,
  onDelete,
  onFlag,
  onUnflag,
  onArchive,
  onUnarchive,
  onMarkUnread,
  onSessionStatusChange,
  onRename,
  onFocusChatInput,
  onOpenInNewWindow,
  sessionOptions,
  searchActive,
  searchQuery = '',
  onSearchChange,
  onSearchClose,
  sessionStatuses = [],
  evaluateViews,
  labels = [],
  onLabelsChange,
  groupingMode = 'date',
  workspaceId,
  statusFilter,
  labelFilterMap,
  focusedSessionId,
  onNavigateToSession,
  hasPendingPrompt,
  activeChatMatchInfo,
}, forwardedHandleRef) {
  const setSendToWorkspace = useSetAtom(sendToWorkspaceAtom)
  const projects = useAtomValue(projectsAtom)
  const createSession = useSetAtom(createSessionAtom)
  // State for the ProjectSettingsDialog opened from a project header's ⋯ menu.
  const [projectSettingsTargetId, setProjectSettingsTargetId] = useState<string | null>(null)
  const [projectSettingsConfirmDelete, setProjectSettingsConfirmDelete] = useState(false)

  // --- Selection (atom-backed, shared with ChatDisplay + BatchActionPanel) ---
  const {
    select: selectSession,
    toggle: toggleSession,
    selectRange,
    isMultiSelectActive,
  } = useSessionSelection()
  const selectionStore = useSessionSelectionStore()

  const { navigate, navigateToSession: navigateToSessionPrimary } = useNavigation()
  const navigateToSession = onNavigateToSession ?? navigateToSessionPrimary
  const navState = useNavigationState()
  const { showEscapeOverlay } = useEscapeInterrupt()

  // Pre-flatten label tree once for efficient ID lookups in each SessionItem
  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  // Get current filter from navigation state (for preserving context in tab routes)
  const currentFilter = isSessionsNavigation(navState) ? navState.filter : undefined

  // Per-project "show all" state for byProject grouping mode.
  // Initial cap = PROJECT_ITEM_CAP; rows beyond the cap are hidden behind a
  // "Show more" affordance until the user expands that specific project.
  const [expandedProjectsShowAll, setExpandedProjectsShowAll] = useState<Set<string>>(new Set())
  const toggleProjectShowAll = useCallback((projectKey: string) => {
    setExpandedProjectsShowAll(prev => {
      const next = new Set(prev)
      if (next.has(projectKey)) next.delete(projectKey)
      else next.add(projectKey)
      return next
    })
  }, [])

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState("")
  // Track if search input has actual DOM focus (for proper keyboard navigation gating)
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false)

  // Collapsed group keys (for collapsible group headers) — persisted per workspace/filter/grouping context
  const collapseScopeSuffix = useMemo(() => {
    return buildCollapsedGroupsScopeSuffix({
      workspaceId,
      currentFilter,
      groupingMode,
    })
  }, [
    workspaceId,
    groupingMode,
    currentFilter?.kind,
    currentFilter && 'stateId' in currentFilter ? currentFilter.stateId : undefined,
    currentFilter && 'labelId' in currentFilter ? currentFilter.labelId : undefined,
    currentFilter && 'viewId' in currentFilter ? currentFilter.viewId : undefined,
  ])

  const readCollapsedGroupsForScope = useCallback((scopeSuffix: string): Set<string> => {
    const scopedRaw = storage.getRaw(KEYS.collapsedSessionGroups, scopeSuffix)
    if (scopedRaw !== null) {
      try {
        const parsed = JSON.parse(scopedRaw)
        return new Set(Array.isArray(parsed) ? parsed : [])
      } catch {
        return new Set()
      }
    }

    // Legacy fallback: previous versions used a single global key with no scope suffix.
    // Use as migration source only when this scope has never been written.
    const legacy = storage.get<string[]>(KEYS.collapsedSessionGroups, [])
    return new Set(legacy)
  }, [])

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => readCollapsedGroupsForScope(collapseScopeSuffix))
  const collapseScopeRef = useRef(collapseScopeSuffix)

  useEffect(() => {
    if (collapseScopeRef.current === collapseScopeSuffix) return
    setCollapsedGroups(readCollapsedGroupsForScope(collapseScopeSuffix))
    collapseScopeRef.current = collapseScopeSuffix
  }, [collapseScopeSuffix, readCollapsedGroupsForScope])

  useEffect(() => {
    // Avoid writing stale groups from a previous scope during context switches.
    if (collapseScopeRef.current !== collapseScopeSuffix) return
    storage.set(KEYS.collapsedSessionGroups, Array.from(collapsedGroups), collapseScopeSuffix)
  }, [collapsedGroups, collapseScopeSuffix])

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }, [])

  // --- Data pipeline (search, filtering, pagination, grouping) ---
  const scrollViewportRef = useRef<HTMLDivElement>(null)

  const {
    isSearchMode,
    highlightQuery,
    isSearchingContent,
    isSearchUnavailable,
    contentSearchResults,
    matchingFilterItems,
    otherResultItems,
    exceededSearchLimit,
    flatItems,
    hasMore,
    collapsedGroupsMeta,
    searchInputRef,
  } = useSessionSearch({
    items,
    searchActive: searchActive ?? false,
    searchQuery,
    workspaceId,
    currentFilter,
    evaluateViews,
    statusFilter,
    labelFilterMap,
    collapsedGroups,
    groupingMode,
    scrollViewportRef,
  })

  const rowData = useMemo(() => {
    if (isSearchMode) {
      const matchingRows: SessionListRow[] = matchingFilterItems.map(item => ({ item }))
      const otherRows: SessionListRow[] = otherResultItems.map(item => ({ item }))

      const groups: EntityListGroup<SessionListRow>[] = []
      if (matchingRows.length > 0) {
        groups.push({ key: 'matching', label: 'In Current View', items: matchingRows })
      }
      if (otherRows.length > 0) {
        groups.push({ key: 'other', label: 'Other Conversations', items: otherRows })
      }

      return {
        rows: [...matchingRows, ...otherRows],
        groups,
        hiddenRemainderByKey: new Map<string, number>(),
      }
    }

    // flatItems only contains visible (expanded + paginated) items.
    // collapsedGroupsMeta provides key + count for collapsed groups so we
    // can insert header-only placeholder groups in the correct position.
    const rows: SessionListRow[] = flatItems.map(item => ({ item }))

    if (groupingMode === 'byProject') {
      // Bucket visible rows by projectId
      const groupsByKey = new Map<string, { rows: SessionListRow[]; projectId: string }>()
      const hiddenRemainderByKey = new Map<string, number>()
      for (const row of rows) {
        const pid = row.item.projectId ?? '__unassigned__'
        const key = `project-${pid}`
        if (!groupsByKey.has(key)) groupsByKey.set(key, { rows: [], projectId: pid })
        groupsByKey.get(key)!.rows.push(row)
      }
      for (const meta of collapsedGroupsMeta) {
        if (!groupsByKey.has(meta.key)) {
          const pid = meta.key.replace('project-', '')
          groupsByKey.set(meta.key, { rows: [], projectId: pid })
        }
      }

      const orderedGroups: EntityListGroup<SessionListRow>[] = []
      const seenKeys = new Set<string>()

      // Always render one group per known project, even when it has zero sessions,
      // so newly-created empty projects show up in the sidebar immediately.
      for (const project of projects) {
        const key = `project-${project.id}`
        const bucket = groupsByKey.get(key)
        const groupRows = bucket?.rows ?? []
        groupRows.sort((a, b) => (b.item.lastMessageAt || 0) - (a.item.lastMessageAt || 0))
        const collapsedMeta = collapsedGroupsMeta.find((m) => m.key === key)
        // Apply "Show more" cap unless this project has been expanded.
        const showAll = expandedProjectsShowAll.has(key)
        const remainder = !showAll && groupRows.length > PROJECT_ITEM_CAP
          ? groupRows.length - PROJECT_ITEM_CAP
          : 0
        const visibleRows = remainder > 0 ? groupRows.slice(0, PROJECT_ITEM_CAP) : groupRows
        if (remainder > 0) hiddenRemainderByKey.set(key, remainder)
        orderedGroups.push({
          key,
          label: project.name,
          items: visibleRows,
          collapsible: true,
          ...(collapsedMeta ? { collapsedCount: collapsedMeta.count } : {}),
        })
        seenKeys.add(key)
      }

      // Unassigned bucket — only when it has sessions.
      const unassignedKey = 'project-__unassigned__'
      const unassignedBucket = groupsByKey.get(unassignedKey)
      if (unassignedBucket && (unassignedBucket.rows.length > 0
        || collapsedGroupsMeta.some((m) => m.key === unassignedKey))) {
        unassignedBucket.rows.sort((a, b) => (b.item.lastMessageAt || 0) - (a.item.lastMessageAt || 0))
        const collapsedMeta = collapsedGroupsMeta.find((m) => m.key === unassignedKey)
        const showAll = expandedProjectsShowAll.has(unassignedKey)
        const remainder = !showAll && unassignedBucket.rows.length > PROJECT_ITEM_CAP
          ? unassignedBucket.rows.length - PROJECT_ITEM_CAP
          : 0
        const visibleRows = remainder > 0 ? unassignedBucket.rows.slice(0, PROJECT_ITEM_CAP) : unassignedBucket.rows
        if (remainder > 0) hiddenRemainderByKey.set(unassignedKey, remainder)
        orderedGroups.push({
          key: unassignedKey,
          label: 'Unassigned',
          items: visibleRows,
          collapsible: true,
          ...(collapsedMeta ? { collapsedCount: collapsedMeta.count } : {}),
        })
        seenKeys.add(unassignedKey)
      }

      // Any remaining buckets (sessions referencing a project not in projectsAtom) — append.
      for (const [key, { rows: groupRows, projectId: pid }] of groupsByKey) {
        if (seenKeys.has(key)) continue
        groupRows.sort((a, b) => (b.item.lastMessageAt || 0) - (a.item.lastMessageAt || 0))
        const collapsedMeta = collapsedGroupsMeta.find((m) => m.key === key)
        const showAll = expandedProjectsShowAll.has(key)
        const remainder = !showAll && groupRows.length > PROJECT_ITEM_CAP
          ? groupRows.length - PROJECT_ITEM_CAP
          : 0
        const visibleRows = remainder > 0 ? groupRows.slice(0, PROJECT_ITEM_CAP) : groupRows
        if (remainder > 0) hiddenRemainderByKey.set(key, remainder)
        orderedGroups.push({
          key,
          label: pid,
          items: visibleRows,
          collapsible: true,
          ...(collapsedMeta ? { collapsedCount: collapsedMeta.count } : {}),
        })
      }

      if (orderedGroups.length === 1) orderedGroups[0].collapsible = false
      return {
        rows: orderedGroups.flatMap((g) => g.items),
        groups: orderedGroups,
        hiddenRemainderByKey,
      }
    }

    if (groupingMode === 'status') {
      const statusOrder = new Map<string, number>()
      sessionStatuses.forEach((state, index) => statusOrder.set(state.id, index))

      // Build groups from visible items
      const groupsByKey = new Map<string, { rows: SessionListRow[], statusId: string }>()
      for (const row of rows) {
        const statusId = getSessionStatus(row.item)
        const key = `status-${statusId}`
        if (!groupsByKey.has(key)) groupsByKey.set(key, { rows: [], statusId })
        groupsByKey.get(key)!.rows.push(row)
      }

      // Insert collapsed placeholder groups
      for (const meta of collapsedGroupsMeta) {
        if (!groupsByKey.has(meta.key)) {
          const statusId = meta.key.replace('status-', '')
          groupsByKey.set(meta.key, { rows: [], statusId })
        }
      }

      const orderedGroups: EntityListGroup<SessionListRow>[] = []
      for (const [key, { rows: groupRows, statusId }] of groupsByKey) {
        const state = sessionStatuses.find(s => s.id === statusId)
        if (!state) continue
        groupRows.sort((a, b) => (b.item.lastMessageAt || 0) - (a.item.lastMessageAt || 0))
        const collapsedMeta = collapsedGroupsMeta.find(m => m.key === key)
        orderedGroups.push({
          key,
          label: state.label,
          items: groupRows,
          collapsible: true,
          ...(collapsedMeta ? { collapsedCount: collapsedMeta.count } : {}),
        })
      }
      orderedGroups.sort((a, b) => {
        const aOrder = statusOrder.get(a.key.replace('status-', '')) ?? 999
        const bOrder = statusOrder.get(b.key.replace('status-', '')) ?? 999
        return aOrder - bOrder
      })

      // If only one group exists, disable collapsing — there's nothing to collapse into
      if (orderedGroups.length === 1) {
        orderedGroups[0].collapsible = false
      }

      return {
        rows: orderedGroups.flatMap(g => g.items),
        groups: orderedGroups,
        hiddenRemainderByKey: new Map<string, number>(),
      }
    }

    // Default: group by date
    const groupsByKey = new Map<string, EntityListGroup<SessionListRow>>()
    const groupDates = new Map<string, Date>()

    for (const row of rows) {
      const day = startOfDay(new Date(row.item.lastMessageAt || 0))
      const groupKey = day.toISOString()

      if (!groupsByKey.has(groupKey)) {
        groupsByKey.set(groupKey, {
          key: groupKey,
          label: formatDateGroupLabel(day),
          items: [],
          collapsible: true,
        })
        groupDates.set(groupKey, day)
      }
      groupsByKey.get(groupKey)!.items.push(row)
    }

    // Insert collapsed placeholder groups (header-only, items: [])
    for (const meta of collapsedGroupsMeta) {
      if (!groupsByKey.has(meta.key)) {
        const date = new Date(meta.key)
        groupsByKey.set(meta.key, {
          key: meta.key,
          label: formatDateGroupLabel(date),
          items: [],
          collapsible: true,
          collapsedCount: meta.count,
        })
        groupDates.set(meta.key, date)
      }
    }

    // Sort all groups by date descending
    const orderedKeys = Array.from(groupDates.entries())
      .sort(([, a], [, b]) => b.getTime() - a.getTime())
      .map(([key]) => key)

    const orderedGroups = orderedKeys.map(key => groupsByKey.get(key)!)

    // If only one group exists, disable collapsing — there's nothing to collapse into
    if (orderedGroups.length === 1) {
      orderedGroups[0].collapsible = false
    }

    return {
      rows,
      groups: orderedGroups,
      hiddenRemainderByKey: new Map<string, number>(),
    }
  }, [isSearchMode, matchingFilterItems, otherResultItems, flatItems, groupingMode, sessionStatuses, collapsedGroupsMeta, projects, expandedProjectsShowAll])

  const flatRows = rowData.rows

  const collapseAllGroups = useCallback(() => {
    if (groupingMode === 'status') {
      const allKeys = new Set(items.map(item => `status-${getSessionStatus(item)}`))
      setCollapsedGroups(allKeys)
    } else if (groupingMode === 'byProject') {
      const allKeys = new Set(items.map(item => `project-${item.projectId ?? '__unassigned__'}`))
      setCollapsedGroups(allKeys)
    } else {
      const allKeys = new Set(items.map(item =>
        startOfDay(new Date(item.lastMessageAt || 0)).toISOString()
      ))
      setCollapsedGroups(allKeys)
    }
  }, [items, groupingMode])
  const expandAllGroups = useCallback(() => {
    setCollapsedGroups(new Set())
  }, [])

  useImperativeHandle(forwardedHandleRef, () => ({
    collapseAll: () => collapseAllGroups(),
    expandAll: () => expandAllGroups(),
    focusSearchInput: () => {
      // Defer one frame so the input is mounted if search was just activated.
      requestAnimationFrame(() => searchInputRef.current?.focus())
    },
  }), [collapseAllGroups, expandAllGroups])

  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    flatRows.forEach((row, index) => {
      map.set(row.item.id, index)
    })
    return map
  }, [flatRows])

  // Map each session ID → list of session IDs in the same visible group.
  // Used by "Select all in group" in SessionMenu.
  const groupIdsByItemId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const group of rowData.groups) {
      const ids = group.items.map(r => r.item.id)
      for (const id of ids) map.set(id, ids)
    }
    return map
  }, [rowData.groups])

  // --- Action handlers with toast feedback ---
  const {
    handleFlagWithToast,
    handleUnflagWithToast,
    handleArchiveWithToast,
    handleUnarchiveWithToast,
    handleDeleteWithToast,
  } = useSessionActions({ onFlag, onUnflag, onArchive, onUnarchive, onDelete })

  // --- Focus zone ---
  const { focusZone } = useFocusContext()
  const { zoneRef, isFocused, shouldMoveDOMFocus } = useFocusZone({ zoneId: 'navigator' })

  // Keyboard eligibility: zone-focused OR search input focused (for arrow navigation)
  const isKeyboardEligible = isFocused || (searchActive && isSearchInputFocused)

  // --- Interactions (keyboard navigation + selection via shared atom) ---
  const interactions = useEntityListInteractions<SessionListRow>({
    items: flatRows,
    getId: (row) => row.item.id,
    keyboard: {
      onNavigate: useCallback((row: SessionListRow) => {
        navigateToSession(row.item.id)
      }, [navigateToSession]),
      onActivate: useCallback((row: SessionListRow) => {
        // Only navigate when not in multi-select (matches original behavior)
        if (!MultiSelect.isMultiSelectActive(selectionStore.state)) {
          navigateToSession(row.item.id)
        }
        onFocusChatInput?.(row.item.id)
      }, [selectionStore.state, navigateToSession, onFocusChatInput]),
      enabled: isKeyboardEligible,
      virtualFocus: searchActive ?? false,
    },
    multiSelect: true,
    selectionStore,
    selectedIdOverride: focusedSessionId,
  })

  // Sync activeIndex when selection changes externally (e.g. from ChatDisplay)
  useEffect(() => {
    const newIndex = flatRows.findIndex(row => row.item.id === selectionStore.state.selected)
    if (newIndex >= 0 && newIndex !== interactions.keyboard.activeIndex) {
      interactions.keyboard.setActiveIndex(newIndex)
    }
  }, [selectionStore.state.selected, flatRows, interactions.keyboard])

  // Focus active item when zone gains keyboard focus
  useEffect(() => {
    if (shouldMoveDOMFocus && flatRows.length > 0 && !(searchActive ?? false)) {
      interactions.keyboard.focusActiveItem()
    }
  }, [shouldMoveDOMFocus, flatRows.length, searchActive, interactions.keyboard])

  // --- Global keyboard shortcuts ---
  const isFocusWithinZone = () => zoneRef.current?.contains(document.activeElement) ?? false

  useAction('navigator.selectAll', () => {
    interactions.selection.selectAll()
  }, {
    enabled: isFocusWithinZone,
  }, [interactions.selection])

  useAction('navigator.clearSelection', () => {
    const selectedId = selectionStore.state.selected
    interactions.selection.clear()
    if (selectedId) navigateToSession(selectedId)
  }, {
    enabled: () => isMultiSelectActive && !showEscapeOverlay,
  }, [isMultiSelectActive, showEscapeOverlay, interactions.selection, selectionStore.state.selected, navigateToSession])

  // --- Click handlers ---
  const handleSelectSession = useCallback((row: SessionListRow, index: number) => {
    selectSession(row.item.id, index)
    navigateToSession(row.item.id)
  }, [selectSession, navigateToSession])

  const handleSelectSessionById = useCallback((sessionId: string) => {
    const index = rowIndexMap.get(sessionId) ?? -1
    if (index >= 0) {
      selectSession(sessionId, index)
    } else {
      selectSession(sessionId, 0)
    }
    navigateToSession(sessionId)
  }, [rowIndexMap, selectSession, navigateToSession])

  const handleToggleSelect = useCallback((row: SessionListRow, index: number) => {
    focusZone('navigator', { intent: 'click', moveFocus: false })
    toggleSession(row.item.id, index)
  }, [focusZone, toggleSession])

  const handleRangeSelect = useCallback((toIndex: number) => {
    focusZone('navigator', { intent: 'click', moveFocus: false })
    const allIds = flatRows.map(row => row.item.id)
    selectRange(toIndex, allIds)
  }, [focusZone, flatRows, selectRange])

  const handleSelectGroupForItem = useCallback((sessionId: string) => {
    const ids = groupIdsByItemId.get(sessionId)
    if (!ids || ids.length === 0) return
    focusZone('navigator', { intent: 'click', moveFocus: false })
    selectionStore.setState(MultiSelect.selectAll(ids))
  }, [groupIdsByItemId, focusZone, selectionStore])

  // Arrow key shortcuts for zone navigation (left → sidebar, right → chat)
  const handleKeyDown = useCallback((e: React.KeyboardEvent, _item: SessionMeta) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusZone('sidebar', { intent: 'keyboard' })
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusZone('chat', { intent: 'keyboard' })
      return
    }
  }, [focusZone])

  // --- Rename dialog ---
  const handleRenameClick = useCallback((sessionId: string, currentName: string) => {
    setRenameSessionId(sessionId)
    setRenameName(currentName)
    requestAnimationFrame(() => {
      setRenameDialogOpen(true)
    })
  }, [])

  const handleRenameSubmit = () => {
    if (renameSessionId && renameName.trim()) {
      onRename(renameSessionId, renameName.trim())
    }
    setRenameDialogOpen(false)
    setRenameSessionId(null)
    setRenameName("")
  }

  // --- Project-group handlers (byProject mode) ---
  const handleCreateSessionInProject = useCallback(async (projectId: string) => {
    if (!workspaceId) return
    try {
      const session = await createSession({ workspaceId, projectId })
      navigateToSession(session.id)
    } catch (err) {
      toast.error('Could not create session', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [workspaceId, createSession, navigateToSession])

  // --- Search input key handler ---
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      searchInputRef.current?.blur()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      onFocusChatInput?.(selectionStore.state.selected ?? undefined)
      return
    }
    // Forward arrow keys via interactions
    interactions.searchInputProps.onKeyDown(e)
  }, [searchInputRef, onFocusChatInput, interactions.searchInputProps, selectionStore.state.selected])

  // --- Context value (shared across all SessionItems) ---
  const handleFocusZone = useCallback(() => focusZone('navigator', { intent: 'click', moveFocus: false }), [focusZone])
  const handleOpenInNewWindow = useCallback((item: SessionMeta) => onOpenInNewWindow?.(item), [onOpenInNewWindow])
  const resolvedSearchQuery = isSearchMode ? highlightQuery : searchQuery

  const listContext = useMemo((): SessionListContextValue => ({
    onRenameClick: handleRenameClick,
    onSessionStatusChange,
    onFlag: onFlag ? handleFlagWithToast : undefined,
    onUnflag: onUnflag ? handleUnflagWithToast : undefined,
    onArchive: onArchive ? handleArchiveWithToast : undefined,
    onUnarchive: onUnarchive ? handleUnarchiveWithToast : undefined,
    onMarkUnread,
    onDelete: handleDeleteWithToast,
    onLabelsChange,
    onSelectSessionById: handleSelectSessionById,
    onSelectGroupForItem: handleSelectGroupForItem,
    onOpenInNewWindow: handleOpenInNewWindow,
    onSendToWorkspace: (ids: string[]) => setSendToWorkspace(ids),
    onFocusZone: handleFocusZone,
    onKeyDown: handleKeyDown,
    sessionStatuses,
    flatLabels,
    labels,
    searchQuery: resolvedSearchQuery,
    selectedSessionId: focusedSessionId !== undefined ? focusedSessionId : selectionStore.state.selected,
    isMultiSelectActive,
    sessionOptions,
    contentSearchResults,
    activeChatMatchInfo,
    hasPendingPrompt,
  }), [
    handleRenameClick, onSessionStatusChange,
    onFlag, handleFlagWithToast, onUnflag, handleUnflagWithToast,
    onArchive, handleArchiveWithToast, onUnarchive, handleUnarchiveWithToast,
    onMarkUnread, handleDeleteWithToast, onLabelsChange,
    handleSelectSessionById, handleSelectGroupForItem, handleOpenInNewWindow, setSendToWorkspace, handleFocusZone, handleKeyDown,
    sessionStatuses, flatLabels, labels, resolvedSearchQuery,
    focusedSessionId, selectionStore.state.selected, isMultiSelectActive,
    sessionOptions, contentSearchResults, activeChatMatchInfo, hasPendingPrompt,
  ])

  // --- Empty state (non-search) — render before EntityList ---
  // Don't show empty state when there are collapsed groups with content
  if (flatRows.length === 0 && rowData.groups.length === 0 && !searchActive) {
    if (currentFilter?.kind === 'archived') {
      return (
        <EntityListEmptyScreen
          icon={<Archive />}
          title="No archived sessions"
          description="Sessions you archive will appear here. Archive sessions to keep your list tidy while preserving conversations."
          className="h-full"
        />
      )
    }

    return (
      <EntityListEmptyScreen
        icon={<Inbox />}
        title="No sessions yet"
        description="Sessions with your agent appear here. Start one to get going."
        className="h-full"
      >
        <button
          onClick={() => {
            const params: { status?: string; label?: string } = {}
            if (currentFilter?.kind === 'state') params.status = currentFilter.stateId
            else if (currentFilter?.kind === 'label') params.label = currentFilter.labelId
            navigate(routes.action.newSession(Object.keys(params).length > 0 ? params : undefined))
          }}
          className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors"
        >
          New Session
        </button>
      </EntityListEmptyScreen>
    )
  }

  // --- Render ---
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <SessionListProvider value={listContext}>
      <EntityList<SessionListRow>
        groups={rowData.groups}
        getKey={(row) => row.item.id}
        renderItem={(row, _indexInGroup, isFirstInGroup) => {
          const flatIndex = rowIndexMap.get(row.item.id) ?? 0
          const rowProps = interactions.getRowProps(row, flatIndex)
          return (
            <SessionItem
              item={row.item}
              index={flatIndex}
              itemProps={rowProps.buttonProps as Record<string, unknown>}
              isSelected={rowProps.isSelected}
              isFirstInGroup={isFirstInGroup}
              isInMultiSelect={rowProps.isInMultiSelect ?? false}
              onSelect={() => handleSelectSession(row, flatIndex)}
              onToggleSelect={() => handleToggleSelect(row, flatIndex)}
              onRangeSelect={() => handleRangeSelect(flatIndex)}
            />
          )
        }}
        header={
          <>
            {searchActive && (
              <SessionSearchHeader
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                onSearchClose={onSearchClose}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setIsSearchInputFocused(true)}
                onBlur={() => setIsSearchInputFocused(false)}
                isSearching={isSearchingContent}
                isUnavailable={isSearchUnavailable}
                resultCount={matchingFilterItems.length + otherResultItems.length}
                exceededLimit={exceededSearchLimit}
                inputRef={searchInputRef}
              />
            )}
            {isSearchMode && matchingFilterItems.length === 0 && otherResultItems.length > 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No results in current filter
              </div>
            )}
          </>
        }
        emptyState={
          isSearchMode && !isSearchingContent ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-sm text-muted-foreground">No sessions found</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Searched titles and message content
              </p>
              <button
                onClick={() => onSearchChange?.('')}
                className="text-xs text-foreground hover:underline mt-2"
              >
                Clear search
              </button>
            </div>
          ) : undefined
        }
        footer={
          hasMore ? (
            <div className="flex justify-center py-4">
              <Spinner className="text-muted-foreground" />
            </div>
          ) : undefined
        }
        viewportRef={scrollViewportRef}
        containerRef={zoneRef}
        containerProps={{
          'data-focus-zone': 'navigator',
          role: 'listbox',
          'aria-label': 'Sessions',
        }}
        scrollAreaClassName="select-none mask-fade-top-short"
        collapsedGroups={collapsedGroups}
        onToggleCollapse={toggleGroupCollapse}
        onCollapseAll={collapseAllGroups}
        onExpandAll={expandAllGroups}
        renderGroupFooter={
          groupingMode === 'byProject'
            ? (group) => {
                const remainder = rowData.hiddenRemainderByKey.get(group.key) ?? 0
                if (remainder <= 0) return null
                return (
                  <button
                    type="button"
                    onClick={() => toggleProjectShowAll(group.key)}
                    className="flex w-full items-center gap-1 px-5 py-1 text-[12px] text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] rounded transition-colors"
                  >
                    Show more
                  </button>
                )
              }
            : undefined
        }
        renderGroupHeader={
          groupingMode === 'byProject'
            ? (group, { isCollapsed, onToggle }) => {
                const pid = group.key.replace(/^project-/, '')
                const isUnassigned = pid === '__unassigned__'
                const project = projects.find((p) => p.id === pid) ?? null
                const itemCount = isCollapsed ? (group.collapsedCount ?? 0) : group.items.length
                return (
                  <div className="group/header flex w-full items-center gap-1 px-3 pt-4 pb-1.5">
                    <button
                      onClick={onToggle}
                      className="flex flex-1 min-w-0 items-center gap-1.5 cursor-pointer"
                    >
                      <ChevronRight
                        className={cn(
                          "h-2.5 w-2.5 text-muted-foreground/50 transition-transform",
                          !isCollapsed && "rotate-90"
                        )}
                      />
                      <span className="text-[11px] font-medium truncate tracking-[0.02em] text-foreground/80 transition-colors">
                        {group.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">· {itemCount}</span>
                    </button>
                    {project && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleCreateSessionInProject(project.id)
                          }}
                          aria-label={`New session in ${project.name}`}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-foreground/5 text-muted-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Project options for ${project.name}`}
                              className="opacity-0 group-hover/header:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-foreground/5 text-muted-foreground data-[state=open]:opacity-100"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setProjectSettingsConfirmDelete(false); setProjectSettingsTargetId(project.id) }}>
                              Rename…
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setProjectSettingsConfirmDelete(false); setProjectSettingsTargetId(project.id) }}>
                              Change folder…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { setProjectSettingsConfirmDelete(true); setProjectSettingsTargetId(project.id) }}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                    {isUnassigned && (
                      <span className="text-[10px] text-muted-foreground/40 italic">no project</span>
                    )}
                  </div>
                )
              }
            : undefined
        }
      />
      </SessionListProvider>
      {workspaceId && projectSettingsTargetId && (
        <ProjectSettingsDialog
          open={!!projectSettingsTargetId}
          onOpenChange={(open) => { if (!open) { setProjectSettingsTargetId(null); setProjectSettingsConfirmDelete(false) } }}
          workspaceId={workspaceId}
          projectId={projectSettingsTargetId}
          initialConfirmDelete={projectSettingsConfirmDelete}
        />
      )}

      {/* Rename Dialog */}
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        title="Rename Session"
        value={renameName}
        onValueChange={setRenameName}
        onSubmit={handleRenameSubmit}
        placeholder="Enter session name..."
      />
    </div>
  )
})
