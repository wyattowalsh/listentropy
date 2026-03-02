import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'surface-interactive rounded-theme border border-border bg-surface p-panel shadow-card transition-[background-color,border-color,box-shadow,transform] duration-normal ease-standard',
        className,
      )}
      {...props}
    />
  )
}

type CardTitleTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: CardTitleTag
}

export function CardTitle({
  className,
  as: Component = 'h3',
  ...props
}: CardTitleProps): JSX.Element {
  return (
    <Component
      className={cn('font-heading text-base font-semibold tracking-tight text-text', className)}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return (
    <p className={cn('text-sm text-text-muted', className)} {...props} />
  )
}
