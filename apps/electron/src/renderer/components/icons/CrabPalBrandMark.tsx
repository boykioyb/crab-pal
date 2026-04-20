import { cn } from "@/lib/utils"
import crabLogo from "@/assets/crab_logo.svg"

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl"
export type BrandMarkVariant = "plain" | "soft" | "hero"

interface CrabPalBrandMarkProps {
  size?: BrandMarkSize
  variant?: BrandMarkVariant
  className?: string
}

const SIZE: Record<BrandMarkSize, string> = {
  xs: "size-5",
  sm: "size-7",
  md: "size-10",
  lg: "size-16",
  xl: "size-20",
}

const VARIANT: Record<BrandMarkVariant, string> = {
  plain: "",
  soft: "drop-shadow-sm",
  hero: "shadow-tinted",
}

/**
 * CrabPalBrandMark — single source of truth for the CrabPal logo in the UI.
 * Uses an SVG (vector) so it stays crisp at any size. Swap the SVG asset or
 * tweak variant classes here once and the change propagates to every call-site.
 */
export function CrabPalBrandMark({
  size = "md",
  variant = "soft",
  className,
}: CrabPalBrandMarkProps) {
  return (
    <img
      src={crabLogo}
      alt="CrabPal"
      draggable={false}
      className={cn(
        "select-none object-contain",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
    />
  )
}
