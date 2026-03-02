import { useEffect, useRef, useState } from 'react'

import { projectNodeLayoutToViewport } from '@/lib/graph-layout'
import type { GraphEdge, GraphNode } from '@/lib/types'
import { clamp } from '@/lib/utils'

interface Universe2DProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId?: string | null
}

function clampRadius(playCount: number): number {
  const value = Math.log10(Math.max(1, playCount) + 1) * 2.4
  if (!Number.isFinite(value)) {
    return 2
  }
  return clamp(value, 2, 18)
}

function edgeStroke(edge: GraphEdge, selectedNodeId?: string | null): { color: string; width: number } {
  const isSelectedEdge = Boolean(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId))

  if (edge.type === 'contains') {
    return {
      color: isSelectedEdge ? 'rgba(148, 163, 184, 0.55)' : 'rgba(148, 163, 184, 0.16)',
      width: isSelectedEdge ? 1.4 : 0.8,
    }
  }

  if (edge.communityBridge) {
    return {
      color: isSelectedEdge ? 'rgba(245, 158, 11, 0.95)' : 'rgba(245, 158, 11, 0.42)',
      width: isSelectedEdge ? 2.2 : 1.35,
    }
  }

  return {
    color: isSelectedEdge ? 'rgba(34, 197, 94, 0.9)' : 'rgba(34, 197, 94, 0.28)',
    width: isSelectedEdge ? 1.8 : 1.1,
  }
}

function nodeFill(node: GraphNode): string {
  if (node.type === 'artist') {
    return 'rgba(29, 185, 84, 0.92)'
  }
  if (node.type === 'album') {
    return 'rgba(96, 165, 250, 0.84)'
  }
  return 'rgba(165, 180, 252, 0.82)'
}

export function Universe2D({ nodes, edges, selectedNodeId }: Universe2DProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [viewport, setViewport] = useState({ width: 1000, height: 640 })

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const updateSize = () => {
      const width = Math.max(1, Math.round(element.clientWidth))
      const height = Math.max(1, Math.round(element.clientHeight))
      setViewport((current) => (current.width === width && current.height === height ? current : { width, height }))
    }
    updateSize()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize)
      observer.observe(element)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const cssWidth = Math.max(1, Math.round(viewport.width))
    const cssHeight = Math.max(1, Math.round(viewport.height))
    const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)

    canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    canvas.height = Math.max(1, Math.round(cssHeight * dpr))
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, cssWidth, cssHeight)
    context.lineCap = 'round'
    context.lineJoin = 'round'

    const positions = new Map(
      nodes.map((node) => [
        node.id,
        projectNodeLayoutToViewport(node, {
          width: cssWidth,
          height: cssHeight,
          padding: 18,
        }),
      ]),
    )

    const orderedEdges = [...edges].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'contains' ? -1 : 1
      }
      return a.weight - b.weight
    })

    for (const edge of orderedEdges) {
      const source = positions.get(edge.source)
      const target = positions.get(edge.target)
      if (!source || !target) {
        continue
      }
      const stroke = edgeStroke(edge, selectedNodeId)
      context.strokeStyle = stroke.color
      context.lineWidth = stroke.width
      context.beginPath()
      context.moveTo(source.x, source.y)
      context.lineTo(target.x, target.y)
      context.stroke()
    }

    const orderedNodes = [...nodes].sort((a, b) => {
      if (a.id === selectedNodeId) {
        return 1
      }
      if (b.id === selectedNodeId) {
        return -1
      }
      return clampRadius(a.playCount) - clampRadius(b.playCount)
    })

    for (const node of orderedNodes) {
      const point = positions.get(node.id)
      if (!point) {
        continue
      }
      const radius = clampRadius(node.playCount)
      const isSelected = node.id === selectedNodeId

      context.fillStyle = nodeFill(node)
      context.beginPath()
      context.arc(point.x, point.y, radius, 0, Math.PI * 2)
      context.fill()

      if (isSelected) {
        context.strokeStyle = 'rgba(245, 158, 11, 0.95)'
        context.lineWidth = 2
        context.beginPath()
        context.arc(point.x, point.y, radius + 4, 0, Math.PI * 2)
        context.stroke()

        context.font = '12px ui-sans-serif, system-ui, sans-serif'
        const textWidth = Math.min(260, context.measureText(node.label).width + 12)
        const labelX = clamp(point.x + 10, 4, Math.max(4, cssWidth - textWidth - 4))
        const labelY = clamp(point.y - 22, 4, Math.max(4, cssHeight - 24))

        context.fillStyle = 'rgba(15, 23, 42, 0.9)'
        context.fillRect(labelX, labelY, textWidth, 20)
        context.fillStyle = 'rgba(241, 245, 249, 1)'
        context.fillText(node.label, labelX + 6, labelY + 14)
      }
    }
  }, [edges, nodes, selectedNodeId, viewport.height, viewport.width])

  return (
    <div className="overflow-hidden rounded-theme border border-border bg-surface">
      <div
        ref={containerRef}
        className="relative h-[360px] sm:h-[520px] lg:h-[640px]"
        role="img"
        aria-label="2D music universe graph"
      >
        <p className="sr-only">
          2D music universe graph canvas. Use the graph keyboard navigator controls to inspect nodes without pointer interaction.
        </p>
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
      </div>
    </div>
  )
}
