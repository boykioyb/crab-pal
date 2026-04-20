interface CrabPalLogoProps {
  className?: string
}

/**
 * CrabPal pixel art logo - uses accent color from theme
 * Apply text-accent class to get the brand purple color
 */
export function CrabPalLogo({ className }: CrabPalLogoProps) {
  return (
    <svg
      viewBox="0 0 220 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0 4)">
        <path d="M18 7 11.2 1.5 6 5.7l5.2 7.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 7 36.8 1.5 42 5.7l-5.2 7.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 18c0-5 3.6-8 8-8s8 3 8 8v3c0 5-3.6 9-8 9s-8-4-8-9v-3Z" fill="currentColor" />
        <circle cx="20.5" cy="9.5" r="1.7" fill="currentColor" />
        <circle cx="27.5" cy="9.5" r="1.7" fill="currentColor" />
        <path d="M14 31 10 36M20 33l-2 5M28 33l2 5M34 31l4 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </g>
      <text x="58" y="30" fill="currentColor" fontFamily="Inter, system-ui, sans-serif" fontSize="22" fontWeight="700" letterSpacing="0.2">CrabPal</text>
    </svg>
  )
}
