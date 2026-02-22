import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { useEffect, useRef } from 'react'

import type { GraphEdge, GraphNode } from '@/lib/types'
import { clamp } from '@/lib/utils'

interface Universe2DProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId?: string | null
}

interface ForceNode extends GraphNode, SimulationNodeDatum {
  x: number
  y: number
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string | ForceNode
  target: string | ForceNode
  weight: number
}

function clampCoordinate(value: number | undefined, max: number): number {
  if (!Number.isFinite(value)) {
    return max / 2
  }
  return clamp(value as number, 0, max)
}

function clampRadius(playCount: number): number {
  const value = Math.log10(Math.max(1, playCount) + 1) * 2.4
  if (!Number.isFinite(value)) {
    return 2
  }
  return clamp(value, 2, 18)
}

function resolveNode(
  value: string | ForceNode,
  nodesById: Map<string, ForceNode>,
): ForceNode | undefined {
  if (typeof value === 'string') {
    return nodesById.get(value)
  }
  return value
}

export function Universe2D({ nodes, edges, selectedNodeId }: Universe2DProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const width = canvas.width
    const height = canvas.height
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const mutableNodes: ForceNode[] = nodes.map((node) => ({
      ...node,
      x: node.layout ? ((node.layout.x + 1) / 2) * width : width / 2,
      y: node.layout ? ((node.layout.y + 1) / 2) * height : height / 2,
    }))
    const nodesById = new Map(mutableNodes.map((node) => [node.id, node]))
    const simulationLinks: ForceLink[] = edges
      .filter((edge) => nodesById.has(edge.source) && nodesById.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
      }))

    const simulation = forceSimulation<ForceNode>(mutableNodes)
      .force('charge', forceManyBody().strength(-20))
      .force(
        'link',
        forceLink<ForceNode, ForceLink>(simulationLinks)
          .id((node) => node.id)
          .distance((edge) => clamp(160 / Math.max(1, edge.weight), 25, 90)),
      )
      .force('center', forceCenter(width / 2, height / 2))
      .on('tick', () => {
        context.clearRect(0, 0, width, height)
        context.strokeStyle = 'rgba(148, 163, 184, 0.18)'
        for (const edge of simulationLinks) {
          const source = resolveNode(edge.source, nodesById)
          const target = resolveNode(edge.target, nodesById)
          if (!source || !target) {
            continue
          }
          const sourceX = clampCoordinate(source.x, width)
          const sourceY = clampCoordinate(source.y, height)
          const targetX = clampCoordinate(target.x, width)
          const targetY = clampCoordinate(target.y, height)
          context.beginPath()
          context.moveTo(sourceX, sourceY)
          context.lineTo(targetX, targetY)
          context.stroke()
        }
        for (const node of mutableNodes) {
          const radius = clampRadius(node.playCount)
          const x = clampCoordinate(node.x, width)
          const y = clampCoordinate(node.y, height)
          const isSelected = node.id === selectedNodeId
          context.fillStyle = node.type === 'artist' ? 'rgba(29, 185, 84, 0.9)' : 'rgba(96, 165, 250, 0.8)'
          context.beginPath()
          context.arc(x, y, radius, 0, Math.PI * 2)
          context.fill()
          if (isSelected) {
            context.strokeStyle = 'rgba(245, 158, 11, 0.95)'
            context.lineWidth = 2
            context.beginPath()
            context.arc(x, y, radius + 4, 0, Math.PI * 2)
            context.stroke()
            context.fillStyle = 'rgba(15, 23, 42, 0.88)'
            context.fillRect(x + 8, y - 18, Math.min(240, node.label.length * 7 + 12), 20)
            context.fillStyle = 'rgba(241, 245, 249, 1)'
            context.font = '12px ui-sans-serif, system-ui, sans-serif'
            context.fillText(node.label, x + 14, y - 4)
          }
        }
      })

    return () => {
      simulation.stop()
    }
  }, [edges, nodes, selectedNodeId])

  return (
    <div className="overflow-hidden rounded-theme border border-border bg-surface">
      <canvas ref={canvasRef} width={1000} height={640} className="h-auto w-full" />
    </div>
  )
}
