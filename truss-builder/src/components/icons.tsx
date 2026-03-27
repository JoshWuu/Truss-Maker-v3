type IconProps = { className?: string }

const props = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconCursor({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <path d="M5 3l14 9-6.5 1.5-2 5.5z" />
    </svg>
  )
}

export function IconCircleDot({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconLine({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <circle cx="5" cy="19" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="2.5" fill="currentColor" stroke="none" />
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  )
}

export function IconTriangleSupport({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <path d="M12 4L20 17H4z" />
      <line x1="2" y1="17" x2="22" y2="17" strokeWidth="2.5" />
      <line x1="5" y1="17" x2="4" y2="21" strokeWidth="1.5" />
      <line x1="9.5" y1="17" x2="8.5" y2="21" strokeWidth="1.5" />
      <line x1="14.5" y1="17" x2="15.5" y2="21" strokeWidth="1.5" />
      <line x1="19" y1="17" x2="20" y2="21" strokeWidth="1.5" />
    </svg>
  )
}

export function IconArrowDown({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="5 12 12 19 19 12" />
    </svg>
  )
}

export function IconUndo({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  )
}

export function IconRedo({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-.49-4.95" />
    </svg>
  )
}

export function IconWand({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <path d="M15 4l5 5L8 21l-5-1-1-5z" />
      <path d="M20 7l1-2.5 2.5-1-2.5-1L20 0l-1 2.5-2.5 1 2.5 1z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

export function IconX({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconBarChart({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  )
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconGrid({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...props} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
