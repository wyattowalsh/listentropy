import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'outline' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const styles: Record<ButtonVariant, string> = {
  default:
    'border border-accent bg-accent text-accent-contrast font-semibold shadow-interactive hover:brightness-105 hover:shadow-card focus-visible:shadow-card',
  outline:
    'border border-border bg-surface text-text hover:border-accent hover:bg-surface-hover/60 hover:text-accent hover:shadow-interactive focus-visible:shadow-interactive',
  ghost:
    'border border-transparent bg-transparent text-text-muted hover:bg-surface-hover hover:text-text hover:shadow-interactive focus-visible:text-text focus-visible:shadow-interactive',
}

export function Button({
  className,
  variant = 'default',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        'control-interactive inline-flex items-center justify-center gap-2 rounded-theme px-control-x py-control-y text-sm leading-tight transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] disabled:cursor-not-allowed disabled:opacity-50',
        'motion-safe:focus-visible:-translate-y-px motion-reduce:focus-visible:translate-y-0',
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}
