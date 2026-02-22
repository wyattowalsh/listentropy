import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-theme border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}
