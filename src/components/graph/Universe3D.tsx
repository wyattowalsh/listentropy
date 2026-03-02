import { Line, OrbitControls, Stars } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Camera } from 'three'
import * as THREE from 'three'

import type { GraphEdge, GraphNode } from '@/lib/types'

interface Universe3DProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string | null) => void
  onHoverNodeChange?: (nodeId: string | null) => void
  onRendererInitError?: (error: unknown) => void
  onRendererInitSuccess?: () => void
  focusTargetId?: string | null
  focusToken?: number
  resetCameraToken?: number
}

const POSITION_SCALE = 18
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0, 26]

function nodePosition(node: GraphNode): [number, number, number] {
  const x = (node.layout?.x ?? 0) * POSITION_SCALE
  const y = (node.layout?.y ?? 0) * POSITION_SCALE
  const z = (node.layout?.z ?? 0) * POSITION_SCALE * 0.65
  return [x, y, z]
}

function nodeColor(node: GraphNode): string {
  if (node.type === 'artist') {
    return '#1DB954'
  }
  if (node.type === 'album') {
    return '#60A5FA'
  }
  return '#A5B4FC'
}

function NodeMesh({
  node,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  node: GraphNode
  selected: boolean
  hovered: boolean
  onSelect: () => void
  onHover: (hovering: boolean) => void
}): JSX.Element {
  const position = useMemo(() => nodePosition(node), [node])
  const baseRadius = Math.max(0.08, Math.log10(node.playCount + 1) * 0.16)
  const radius = selected ? baseRadius * 1.45 : hovered ? baseRadius * 1.22 : baseRadius
  const color = nodeColor(node)
  const emissiveIntensity = selected ? 0.5 : hovered ? 0.3 : Math.min(0.28, ((node.weightedDegree ?? 0) / 100) * 0.12 + 0.1)

  return (
    <mesh
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation()
        onHover(true)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        onHover(false)
      }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      <sphereGeometry args={[radius, 14, 14]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} />
    </mesh>
  )
}

function EdgeLines({
  nodes,
  edges,
  selectedNodeId,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId?: string | null
}): JSX.Element {
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])

  return (
    <>
      {edges.map((edge) => {
        const source = nodeById.get(edge.source)
        const target = nodeById.get(edge.target)
        if (!source || !target) {
          return null
        }
        const selected = selectedNodeId === source.id || selectedNodeId === target.id
        const color = edge.type === 'co-listened' ? (edge.communityBridge ? '#f59e0b' : '#22c55e') : '#64748b'
        const opacity = selected ? 0.9 : edge.type === 'co-listened' ? 0.35 : 0.16
        const width = selected ? 1.8 : edge.type === 'co-listened' ? 1.2 : 0.8
        return (
          <Line
            key={`${edge.source}-${edge.target}-${edge.type}`}
            points={[nodePosition(source), nodePosition(target)]}
            color={color}
            transparent
            opacity={opacity}
            lineWidth={width}
          />
        )
      })}
    </>
  )
}

export function Universe3D({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onHoverNodeChange,
  onRendererInitError,
  onRendererInitSuccess,
  focusTargetId,
  focusToken,
  resetCameraToken,
}: Universe3DProps): JSX.Element {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const controlsRef = useRef<any>(null)
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])

  useEffect(() => {
    onHoverNodeChange?.(hoveredNodeId)
  }, [hoveredNodeId, onHoverNodeChange])

  useEffect(() => {
    if (!focusTargetId || !focusToken) {
      return
    }
    const camera = cameraRef.current
    const controls = controlsRef.current
    const node = nodeById.get(focusTargetId)
    if (!camera || !controls || !node) {
      return
    }
    const [x, y, z] = nodePosition(node)
    controls.target.set(x, y, z)
    camera.position.set(x + 8, y + 5, z + 10)
    controls.update()
  }, [focusTargetId, focusToken, nodeById])

  useEffect(() => {
    if (!resetCameraToken) {
      return
    }
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) {
      return
    }
    controls.target.set(0, 0, 0)
    camera.position.set(...DEFAULT_CAMERA_POSITION)
    controls.update()
  }, [resetCameraToken])

  return (
    <div
      className="h-[360px] overflow-hidden rounded-theme border border-border bg-surface sm:h-[520px] lg:h-[640px]"
      role="img"
      aria-label="3D music universe graph"
    >
      <p className="sr-only">
        Interactive 3D music universe graph. Use the graph keyboard navigator controls to inspect nodes without pointer interaction.
      </p>
      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: 55 }}
        onCreated={({ camera }) => {
          cameraRef.current = camera
          onRendererInitSuccess?.()
        }}
        gl={(defaults) => {
          try {
            return new THREE.WebGLRenderer({
              ...defaults,
              antialias: true,
            })
          } catch (error) {
            onRendererInitError?.(error)
            throw error
          }
        }}
      >
        <color attach="background" args={['#0b1220']} />
        <ambientLight intensity={0.35} />
        <pointLight position={[10, 10, 14]} intensity={1} />
        <pointLight position={[-12, -8, -10]} intensity={0.4} color="#93c5fd" />
        <Stars radius={120} depth={60} count={3500} factor={4} saturation={0} fade />
        <EdgeLines nodes={nodes} edges={edges} selectedNodeId={selectedNodeId} />
        {nodes.map((node) => (
          <NodeMesh
            key={node.id}
            node={node}
            selected={selectedNodeId === node.id}
            hovered={hoveredNodeId === node.id}
            onSelect={() => onSelectNode?.(selectedNodeId === node.id ? null : node.id)}
            onHover={(hovering) => setHoveredNodeId(hovering ? node.id : null)}
          />
        ))}
        <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  )
}
