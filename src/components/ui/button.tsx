import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'outline' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const styles: Record<ButtonVariant, string> = {
  default:
    'bg-accent text-black font-semibold hover:brightness-110 border border-accent',
  outline:
    'bg-transparent text-text border border-border hover:border-accent hover:text-accent',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-surface-hover border border-transparent',
}

export function Button({
  className,
  variant = 'default',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-theme px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}
