import type { SelectHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      className={cn(
        'control-interactive h-10 rounded-theme border border-border bg-surface px-control-x text-sm text-text transition-[border-color,box-shadow,background-color,color,transform] duration-fast ease-standard hover:border-accent/30 hover:bg-surface-hover/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]',
        className,
      )}
      {...props}
    />
  )
}
