/**
 * Settings Registry - Single Source of Truth
 *
 * This file defines all settings pages in one place. All other files that need
 * settings page information should import from here.
 *
 * To add a new settings page:
 * 1. Add an entry to SETTINGS_PAGES below
 * 2. Create the page component in renderer/pages/settings/
 * 3. Add to SETTINGS_PAGE_COMPONENTS in renderer/pages/settings/settings-pages.ts
 * 4. Add icon to SETTINGS_ICONS in renderer/components/icons/SettingsIcons.tsx
 *
 * That's it - types, routes, and validation are derived automatically.
 */

/**
 * Settings category definition for grouping pages in the navigator
 */
export interface SettingsCategoryDefinition {
  /** Unique category identifier */
  id: string
  /** Display label (shown as uppercase group header) */
  label: string
}

/**
 * Settings page definition
 */
export interface SettingsPageDefinition {
  /** Unique identifier used in routes and navigation */
  id: string
  /** Display label in settings navigator */
  label: string
  /** Short description shown in settings navigator */
  description: string
  /** Category this page belongs to */
  category: string
}

/**
 * The canonical list of settings categories.
 * Order here determines display order in the settings navigator.
 */
export const SETTINGS_CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'ai-model', label: 'AI & Model' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'advanced', label: 'Advanced' },
] as const satisfies readonly SettingsCategoryDefinition[]

/**
 * Settings category ID type - derived from SETTINGS_CATEGORIES
 */
export type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]['id']

/**
 * The canonical list of all settings pages.
 * Order here determines display order in the settings navigator.
 *
 * ADD NEW PAGES HERE - everything else derives from this list.
 */
export const SETTINGS_PAGES = [
  { id: 'app', label: 'App', description: 'Notifications and updates', category: 'general' },
  { id: 'appearance', label: 'Appearance', description: 'Theme, font, tool icons', category: 'general' },
  { id: 'input', label: 'Input', description: 'Send key, spell check', category: 'general' },
  { id: 'shortcuts', label: 'Shortcuts', description: 'Keyboard shortcuts', category: 'general' },
  { id: 'ai', label: 'AI', description: 'Model, thinking, connections', category: 'ai-model' },
  { id: 'workspace', label: 'Workspace', description: 'Name, icon, working directory', category: 'workspace' },
  { id: 'permissions', label: 'Permissions', description: 'Explore mode rules', category: 'workspace' },
  { id: 'labels', label: 'Labels', description: 'Manage session labels', category: 'workspace' },
  { id: 'server', label: 'Server', description: 'Remote server access', category: 'advanced' },
  { id: 'legacy-import', label: 'Import from craft-agent', description: 'Sync sessions, sources and more from the old app', category: 'advanced' },
  { id: 'preferences', label: 'Preferences', description: 'User preferences', category: 'advanced' },
  { id: 'logs', label: 'Logs', description: 'Application log viewer', category: 'advanced' },
  { id: 'about', label: 'About', description: 'Version, updates, and acknowledgements', category: 'general' },
] as const satisfies readonly SettingsPageDefinition[]

/**
 * Settings subpage type - derived from SETTINGS_PAGES
 * This replaces the manual union type in types.ts
 */
export type SettingsSubpage = (typeof SETTINGS_PAGES)[number]['id']

/**
 * Array of valid settings subpage IDs - for runtime validation
 */
export const VALID_SETTINGS_SUBPAGES: readonly SettingsSubpage[] = SETTINGS_PAGES.map(p => p.id)

/**
 * Type guard to check if a string is a valid settings subpage
 */
export function isValidSettingsSubpage(value: string): value is SettingsSubpage {
  return VALID_SETTINGS_SUBPAGES.includes(value as SettingsSubpage)
}

/**
 * Get settings page definition by ID
 */
export function getSettingsPage(id: SettingsSubpage): SettingsPageDefinition {
  const page = SETTINGS_PAGES.find(p => p.id === id)
  if (!page) throw new Error(`Unknown settings page: ${id}`)
  return page
}

/**
 * Get settings pages grouped by category, preserving category order.
 * Returns an array of { category, pages } objects.
 */
export function getSettingsPagesByCategory(): Array<{
  category: SettingsCategoryDefinition
  pages: SettingsPageDefinition[]
}> {
  return SETTINGS_CATEGORIES.map(category => ({
    category,
    pages: SETTINGS_PAGES.filter(p => p.category === category.id),
  })).filter(group => group.pages.length > 0)
}
