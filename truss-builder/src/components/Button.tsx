import type { ReactNode } from 'react'

export function Button(props: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  const { children, onClick, disabled, active, className } = props
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm',
        'transition-colors',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
        disabled ? 'opacity-50 pointer-events-none' : '',
        className || '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

