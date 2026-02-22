import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

interface ChartContainerProps {
  height: number
  ariaLabel: string
  className?: string
  children: ReactNode
}

interface ChartDimensions {
  width: number
  height: number
}

export function ChartContainer({ height, ariaLabel, className, children }: ChartContainerProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState<ChartDimensions>({ width: 0, height })

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const measure = (): void => {
      const rect = root.getBoundingClientRect()
      setDimensions({ width: Math.max(0, Math.floor(rect.width)), height })
    }

    measure()

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null
    observer?.observe(root)
    window.addEventListener('resize', measure)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [height])

  const renderedChart =
    dimensions.width > 0 && isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          width: dimensions.width,
          height,
        })
      : <div className="h-full w-full" />

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel}
      className={className ? `w-full min-w-0 ${className}` : 'w-full min-w-0'}
      style={{ height }}
    >
      {renderedChart}
    </div>
  )
}
