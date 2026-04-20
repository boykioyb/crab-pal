import { CrabPalBrandMark } from "./CrabPalBrandMark"

interface CrabPalAppIconProps {
  className?: string
}

/**
 * Backward-compat wrapper. Prefer importing `CrabPalBrandMark` directly.
 */
export function CrabPalAppIcon({ className }: CrabPalAppIconProps) {
  return <CrabPalBrandMark size="xl" variant="hero" className={className} />
}
