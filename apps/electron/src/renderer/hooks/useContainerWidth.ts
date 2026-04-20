import { useState, useEffect, type RefObject } from 'react'

/**
 * Tracks the inline-size (width) of a DOM element using ResizeObserver.
 *
 * Used by AppShell to derive `isAutoCompact` — when the shell container
 * is narrower than the mobile threshold, sidebar/navigator auto-collapse
 * and panels switch to single-panel mode.
 *
 * Throttled via requestAnimationFrame and rounded to a 10px bucket so that
 * sub-pixel/scroll-driven ResizeObserver firings don't cascade rerenders
 * through the AppShell context.
 *
 * Returns 0 until the element is first measured.
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let rafId: number | null = null
    let pendingWidth = 0

    const ro = new ResizeObserver(([entry]) => {
      pendingWidth = entry.contentBoxSize[0].inlineSize
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const bucketed = Math.round(pendingWidth / 10) * 10
        setWidth(prev => (prev === bucketed ? prev : bucketed))
      })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [ref])

  return width
}
