import { cloneElement, useId, useState } from 'react'
import type {
  FocusEvent,
  FocusEventHandler,
  MouseEvent,
  MouseEventHandler,
  ReactElement,
  ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

interface TooltipProps {
  content: ReactNode
  children: ReactElement
  className?: string
  contentClassName?: string
}

type TriggerProps = {
  onFocus?: FocusEventHandler<HTMLElement>
  onBlur?: FocusEventHandler<HTMLElement>
  onMouseEnter?: MouseEventHandler<HTMLElement>
  onMouseLeave?: MouseEventHandler<HTMLElement>
  'aria-describedby'?: string
}

export function Tooltip({ content, children, className, contentClassName }: TooltipProps): JSX.Element {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const triggerProps = children.props as TriggerProps
  const describedBy = triggerProps['aria-describedby']
    ? `${triggerProps['aria-describedby']} ${tooltipId}`
    : tooltipId

  return (
    <span className={cn('relative inline-flex', className)}>
      {cloneElement(children, {
        onFocus: (event: FocusEvent<HTMLElement>) => {
          triggerProps.onFocus?.(event)
          setOpen(true)
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
          triggerProps.onBlur?.(event)
          setOpen(false)
        },
        onMouseEnter: (event: MouseEvent<HTMLElement>) => {
          triggerProps.onMouseEnter?.(event)
          setOpen(true)
        },
        onMouseLeave: (event: MouseEvent<HTMLElement>) => {
          triggerProps.onMouseLeave?.(event)
          setOpen(false)
        },
        'aria-describedby': describedBy,
      })}
      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!open}
        className={cn(
          'pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-[18rem] -translate-x-1/2 rounded-theme border border-border bg-surface-elevated px-2.5 py-1.5 text-[11px] leading-tight text-text shadow-surface motion-safe:transition motion-safe:duration-fast motion-safe:ease-standard',
          open ? 'opacity-100 motion-safe:translate-y-0' : 'opacity-0 motion-safe:translate-y-1',
          contentClassName,
        )}
      >
        {content}
      </span>
    </span>
  )
}
