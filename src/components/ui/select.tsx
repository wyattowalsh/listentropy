import type { SelectHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      className={cn(
        'h-10 rounded-theme border border-border bg-surface px-3 text-sm text-text focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
        className,
      )}
      {...props}
    />
  )
}
