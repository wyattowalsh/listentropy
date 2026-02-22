import { useEffect, useRef } from 'react'

interface CalendarHeatmapProps {
  data: Array<{ date: string; plays: number }>
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    return [29, 185, 84]
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

export function CalendarHeatmap({ data }: CalendarHeatmapProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'transparent'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const max = Math.max(...data.map((item) => item.plays), 1)
    const chartColor =
      getComputedStyle(document.documentElement).getPropertyValue('--color-chart-0').trim() ||
      '#1DB954'
    const [r, g, b] = hexToRgb(chartColor)
    const cell = 10
    data.slice(-364).forEach((item, index) => {
      const row = index % 7
      const col = Math.floor(index / 7)
      const intensity = item.plays / max
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.1 + intensity * 0.9})`
      context.fillRect(col * (cell + 2), row * (cell + 2), cell, cell)
    })
  }, [data])

  return (
    <div className="overflow-x-auto rounded-theme border border-border bg-surface p-4">
      <canvas
        ref={canvasRef}
        width={860}
        height={90}
        role="img"
        aria-label="Calendar heatmap of listening activity by day"
      />
    </div>
  )
}
