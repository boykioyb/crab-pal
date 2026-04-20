interface CrabPalSymbolProps {
  className?: string
}

/**
 * CrabPal brand mark icon.
 */
export function CrabPalSymbol({ className }: CrabPalSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 7 5.2 4.5 3 6.2 5.1 9.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7 18.8 4.5 21 6.2 18.9 9.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 12.5c0-2 2-3.5 4.5-3.5s4.5 1.5 4.5 3.5V14c0 2.2-2 4-4.5 4s-4.5-1.8-4.5-4v-1.5Z" fill="currentColor" />
      <circle cx="10.25" cy="8.75" r="1.1" fill="currentColor" />
      <circle cx="13.75" cy="8.75" r="1.1" fill="currentColor" />
      <path d="M7 18.2 5.5 20M10 18.6 9 20.2M14 18.6 15 20.2M17 18.2 18.5 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
