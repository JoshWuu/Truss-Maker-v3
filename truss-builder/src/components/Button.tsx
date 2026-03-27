import type { ReactNode } from 'react'

export function Button(props: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  variant?: 'default' | 'ghost' | 'danger'
  className?: string
}) {
  const { children, onClick, disabled, active, variant = 'default', className } = props

  let variantClasses: string
  if (variant === 'danger') {
    variantClasses = active
      ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
      : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300'
  } else if (variant === 'ghost') {
    variantClasses =
      'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  } else {
    variantClasses = active
      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-lg border',
        'px-3 py-2.5 text-sm font-medium min-h-10 [touch-action:manipulation]',
        'transition-colors select-none',
        variantClasses,
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
