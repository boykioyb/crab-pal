/**
 * SettingsTextarea
 *
 * Multiline text input with label and optional character count.
 */

import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { settingsUI } from './SettingsUIConstants'

export interface SettingsTextareaProps {
  /** Textarea label */
  label?: string
  /** Optional description below label */
  description?: string
  /** Current value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Maximum character length */
  maxLength?: number
  /** Number of visible rows */
  rows?: number
  /** Disabled state */
  disabled?: boolean
  /** Error message */
  error?: string
  /** Additional className */
  className?: string
  /** Whether inside a card */
  inCard?: boolean
}

/**
 * SettingsTextarea - Multiline text input with character count
 *
 * @example
 * <SettingsTextarea
 *   label="Notes"
 *   description="Additional context for the AI assistant"
 *   value={notes}
 *   onChange={setNotes}
 *   maxLength={2000}
 *   rows={4}
 * />
 */
export function SettingsTextarea({
  label,
  description,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
  disabled,
  error,
  className,
  inCard = false,
}: SettingsTextareaProps) {
  const id = React.useId()
  const charCount = value.length
  const isOverLimit = maxLength !== undefined && charCount > maxLength

  return (
    <div
      className={cn(
        'space-y-2',
        inCard && 'px-4 py-4',
        className
      )}
    >
      {label && (
        <div className={settingsUI.labelGroup}>
          <Label htmlFor={id} className={settingsUI.label}>
            {label}
          </Label>
          {description && (
            <p className={cn(settingsUI.description, settingsUI.labelDescriptionGap)}>{description}</p>
          )}
        </div>
      )}
      <div className={cn(
        'relative rounded-md transition-all duration-150',
        'has-[:focus-visible]:bg-background has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring/50',
        (error || isOverLimit) && 'ring-1 ring-destructive bg-destructive/5'
      )}>
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn(
            'bg-muted/40 border border-border/40 shadow-none resize-y min-h-[120px] focus-visible:ring-0 focus-visible:outline-none focus-visible:border-ring/50 focus-visible:bg-background transition-all duration-150',
            maxLength && 'pb-6',
            disabled && 'bg-muted/20 cursor-not-allowed'
          )}
        />
        {maxLength !== undefined && (
          <div
            className={cn(
              'absolute bottom-2 right-3 text-xs font-medium',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground/70'
            )}
          >
            {charCount}/{maxLength}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive font-medium mt-1">{error}</p>}
    </div>
  )
}
