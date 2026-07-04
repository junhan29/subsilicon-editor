'use client'

import { memo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useReactFlow, type Node } from '@xyflow/react'
import {
  calculateAlignment,
  getNodeBounds,
  type AlignmentGuide,
  type NodeBounds,
  ALIGNMENT_THRESHOLD,
} from '@editor/lib/alignment-guides'

export interface AlignmentLinesRef {
  handleNodeDrag: (event: MouseEvent | TouchEvent, node: Node, nodes: Node[]) => void
  handleNodeDragStop: () => void
}

interface AlignmentLinesProps {
  enabled: boolean
}

const AlignmentLinesComponent = forwardRef<AlignmentLinesRef, AlignmentLinesProps>(
  function AlignmentLinesComponent({ enabled }, ref) {
    const { getNodes, getViewport, setNodes } = useReactFlow()
    const svgRef = useRef<SVGSVGElement>(null)
    const guidesRef = useRef<AlignmentGuide[]>([])
    const isDraggingRef = useRef(false)
    const draggingNodeIdsRef = useRef<Set<string>>(new Set())
    const originalPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
    const lastSnapOffsetRef = useRef({ x: 0, y: 0 })
    const enabledRef = useRef(enabled)

    useEffect(() => {
      enabledRef.current = enabled
    }, [enabled])

    const updateGuidesDisplay = () => {
      if (!svgRef.current) return

      const svg = svgRef.current
      const { zoom } = getViewport()

      while (svg.firstChild) {
        svg.removeChild(svg.firstChild)
      }

      for (const guide of guidesRef.current) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        // 使用品牌 cyan 系低调色，与编辑器主题协调，避免刺眼的粉色
        line.setAttribute('stroke', '#22D3EE')
        line.setAttribute('stroke-opacity', '0.55')
        line.setAttribute('stroke-width', `${1.5 / zoom}`)
        line.setAttribute('stroke-dasharray', `${4 / zoom},${4 / zoom}`)
        line.setAttribute('pointer-events', 'none')

        if (guide.type === 'vertical') {
          line.setAttribute('x1', `${guide.position}`)
          line.setAttribute('y1', '-10000')
          line.setAttribute('x2', `${guide.position}`)
          line.setAttribute('y2', '10000')
        } else {
          line.setAttribute('x1', '-10000')
          line.setAttribute('y1', `${guide.position}`)
          line.setAttribute('x2', '10000')
          line.setAttribute('y2', `${guide.position}`)
        }

        svg.appendChild(line)
      }
    }

    const handleNodeDrag = (_: MouseEvent | TouchEvent, node: Node, nodes: Node[]) => {
      if (!enabledRef.current) return

      const draggingIds = new Set(nodes.map((n) => n.id))

      if (!isDraggingRef.current) {
        isDraggingRef.current = true
        draggingNodeIdsRef.current = draggingIds
        lastSnapOffsetRef.current = { x: 0, y: 0 }
        originalPositionsRef.current.clear()

        for (const n of nodes) {
          originalPositionsRef.current.set(n.id, { ...n.position })
        }
      }

      const allNodes = getNodes()
      const draggingNodes: NodeBounds[] = []
      const otherNodes: NodeBounds[] = []

      for (const n of allNodes) {
        const bounds = getNodeBounds(n)
        if (draggingIds.has(n.id)) {
          draggingNodes.push(bounds)
        } else {
          otherNodes.push(bounds)
        }
      }

      if (draggingNodes.length === 0 || otherNodes.length === 0) {
        if (guidesRef.current.length > 0) {
          guidesRef.current = []
          updateGuidesDisplay()
        }
        lastSnapOffsetRef.current = { x: 0, y: 0 }
        return
      }

      const result = calculateAlignment(draggingNodes, otherNodes, ALIGNMENT_THRESHOLD)

      const guidesChanged =
        result.guides.length !== guidesRef.current.length ||
        result.guides.some((g, i) => {
          const prev = guidesRef.current[i]
          return !prev || g.type !== prev.type || Math.abs(g.position - prev.position) > 0.1
        })

      if (guidesChanged) {
        guidesRef.current = result.guides
        updateGuidesDisplay()
      }

      lastSnapOffsetRef.current = { x: result.snapOffsetX, y: result.snapOffsetY }
    }

    const handleNodeDragStop = () => {
      const snapOffset = lastSnapOffsetRef.current
      const hasSnap = Math.abs(snapOffset.x) > 0.1 || Math.abs(snapOffset.y) > 0.1
      const draggingIds = draggingNodeIdsRef.current

      isDraggingRef.current = false
      draggingNodeIdsRef.current.clear()
      originalPositionsRef.current.clear()
      lastSnapOffsetRef.current = { x: 0, y: 0 }

      if (guidesRef.current.length > 0) {
        guidesRef.current = []
        updateGuidesDisplay()
      }

      if (hasSnap && draggingIds.size > 0) {
        setNodes((nds) =>
          nds.map((nd) => {
            if (!draggingIds.has(nd.id)) return nd
            return {
              ...nd,
              position: {
                x: nd.position.x + snapOffset.x,
                y: nd.position.y + snapOffset.y,
              },
            }
          })
        )
      }
    }

    useImperativeHandle(ref, () => ({
      handleNodeDrag,
      handleNodeDragStop,
    }))

    return (
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{ overflow: 'visible' }}
      />
    )
  }
)

export const AlignmentLines = memo(AlignmentLinesComponent)
