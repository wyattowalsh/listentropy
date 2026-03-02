import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={cn(
        'control-interactive h-10 w-full rounded-theme border border-border bg-surface px-control-x text-sm text-text placeholder:text-text-muted transition-[border-color,box-shadow,background-color,color,transform] duration-fast ease-standard hover:border-accent/30 hover:bg-surface-hover/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]',
        className,
      )}
      {...props}
    />
  )
}
