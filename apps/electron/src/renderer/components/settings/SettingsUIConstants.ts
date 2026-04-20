/**
 * SettingsUIConstants
 *
 * Centralized style definitions for consistent settings UI appearance.
 */

export const settingsUI = {
  /** Label style for setting titles */
  label: 'text-sm font-semibold tracking-[-0.005em]',

  /** Description style for setting subtitles */
  description: 'text-sm text-muted-foreground/80',

  /** Smaller description for compact contexts (e.g., menu options) */
  descriptionSmall: 'text-xs text-muted-foreground/75',

  /** Gap between label and description (applied to description as margin-top) */
  labelDescriptionGap: 'mt-1',

  /** Gap for label group containers (applied as space-y) */
  labelGroup: 'space-y-1',
}
