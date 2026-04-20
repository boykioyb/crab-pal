/**
 * SettingsNavigator
 *
 * Navigator panel content for settings. Displays settings pages organized into
 * category groups (General, AI & Model, Workspace, Advanced) with minimal,
 * clean row styling.
 */

import { cn } from '@/lib/utils'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { SettingsSubpage } from '../../../shared/types'
import { SETTINGS_ITEMS } from '../../../shared/menu-schema'
import { SETTINGS_CATEGORIES } from '../../../shared/settings-registry'
import { SETTINGS_ICONS } from '@/components/icons/SettingsIcons'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'navigator',
}

interface SettingsNavigatorProps {
  /** Currently selected settings subpage */
  selectedSubpage: SettingsSubpage
  /** Called when a subpage is selected */
  onSelectSubpage: (subpage: SettingsSubpage) => void
}

interface SettingsItem {
  id: SettingsSubpage
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  category: string
}

// Derive settings items from shared schema, using shared custom SVG icons
const settingsItems: SettingsItem[] = SETTINGS_ITEMS.map((item) => ({
  id: item.id,
  label: item.label,
  icon: SETTINGS_ICONS[item.id],
  description: item.description,
  category: item.category,
}))

// Group items by category, preserving category order from the registry
const settingsGroups = SETTINGS_CATEGORIES
  .map(category => ({
    category,
    items: settingsItems.filter(item => item.category === category.id),
  }))
  .filter(group => group.items.length > 0)

interface SettingsItemRowProps {
  item: SettingsItem
  isSelected: boolean
  onSelect: () => void
}

/**
 * SettingsItemRow - Minimal settings item row with icon + label only.
 * Active state uses a left accent bar and pill background.
 */
function SettingsItemRow({ item, isSelected, onSelect }: SettingsItemRowProps) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm outline-none rounded-md',
        'transition-all duration-100',
        isSelected
          ? 'bg-primary/10 text-foreground font-semibold'
          : 'text-foreground/65 hover:bg-foreground/5 hover:text-foreground/85'
      )}
    >
      {/* Left accent bar for active state */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-primary" />
      )}
      <Icon
        className={cn(
          'w-4 h-4 shrink-0 flex-none',
          isSelected ? 'text-primary' : 'text-muted-foreground'
        )}
      />
      <span className={cn('font-medium truncate')}>
        {item.label}
      </span>
    </button>
  )
}

export default function SettingsNavigator({
  selectedSubpage,
  onSelectSubpage,
}: SettingsNavigatorProps) {
  return (
    <div className="flex flex-col h-full bg-background/50">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-2 pt-3 pb-4 space-y-6">
          {settingsGroups.map((group) => (
            <div key={group.category.id}>
              {/* Category group header */}
              <div className="px-3 pb-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider select-none">
                {group.category.label}
              </div>
              {/* Category items */}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SettingsItemRow
                    key={item.id}
                    item={item}
                    isSelected={selectedSubpage === item.id}
                    onSelect={() => onSelectSubpage(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
