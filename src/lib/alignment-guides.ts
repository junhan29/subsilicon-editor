import type { Node } from '@xyflow/react'

export const ALIGNMENT_THRESHOLD = 8

export interface AlignmentGuide {
  type: 'horizontal' | 'vertical'
  position: number
  orientation: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

export interface NodeBounds {
  id: string
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
  width: number
  height: number
}

export function getNodeBounds(node: Node): NodeBounds {
  const width = node.width ?? 200
  const height = node.height ?? 80
  const left = node.position.x
  const top = node.position.y
  const right = left + width
  const bottom = top + height
  const centerX = left + width / 2
  const centerY = top + height / 2

  return { id: node.id, left, right, top, bottom, centerX, centerY, width, height }
}

export function getSelectionBounds(nodes: NodeBounds[]): NodeBounds {
  if (nodes.length === 0) {
    return { id: 'selection', left: 0, right: 0, top: 0, bottom: 0, centerX: 0, centerY: 0, width: 0, height: 0 }
  }

  const left = Math.min(...nodes.map((n) => n.left))
  const right = Math.max(...nodes.map((n) => n.right))
  const top = Math.min(...nodes.map((n) => n.top))
  const bottom = Math.max(...nodes.map((n) => n.bottom))
  const width = right - left
  const height = bottom - top
  const centerX = left + width / 2
  const centerY = top + height / 2

  return { id: 'selection', left, right, top, bottom, centerX, centerY, width, height }
}

export interface AlignmentResult {
  guides: AlignmentGuide[]
  snapOffsetX: number
  snapOffsetY: number
}

export function calculateAlignment(
  draggingNodes: NodeBounds[],
  otherNodes: NodeBounds[],
  threshold: number = ALIGNMENT_THRESHOLD
): AlignmentResult {
  const guides: AlignmentGuide[] = []
  let snapOffsetX = 0
  let snapOffsetY = 0

  if (draggingNodes.length === 0 || otherNodes.length === 0) {
    return { guides, snapOffsetX, snapOffsetY }
  }

  const selectionBounds = getSelectionBounds(draggingNodes)

  const refLefts = otherNodes.map((n) => n.left)
  const refRights = otherNodes.map((n) => n.right)
  const refCentersX = otherNodes.map((n) => n.centerX)
  const refTops = otherNodes.map((n) => n.top)
  const refBottoms = otherNodes.map((n) => n.bottom)
  const refCentersY = otherNodes.map((n) => n.centerY)

  const alignmentsX: Array<{ ref: number; sel: number; orientation: 'left' | 'right' | 'center' }> = [
    { ref: 0, sel: selectionBounds.left, orientation: 'left' },
    { ref: 0, sel: selectionBounds.right, orientation: 'right' },
    { ref: 0, sel: selectionBounds.centerX, orientation: 'center' },
  ]

  let bestOffsetX = 0
  let bestDistanceX = Infinity
  let bestOrientationX: 'left' | 'right' | 'center' | null = null

  for (const refLeft of refLefts) {
    for (const align of alignmentsX) {
      const distance = Math.abs(refLeft - align.sel)
      if (distance < threshold && distance < bestDistanceX) {
        bestDistanceX = distance
        bestOffsetX = refLeft - align.sel
        bestOrientationX = align.orientation
      }
    }
  }

  for (const refRight of refRights) {
    for (const align of alignmentsX) {
      const distance = Math.abs(refRight - align.sel)
      if (distance < threshold && distance < bestDistanceX) {
        bestDistanceX = distance
        bestOffsetX = refRight - align.sel
        bestOrientationX = align.orientation
      }
    }
  }

  for (const refCenter of refCentersX) {
    for (const align of alignmentsX) {
      const distance = Math.abs(refCenter - align.sel)
      if (distance < threshold && distance < bestDistanceX) {
        bestDistanceX = distance
        bestOffsetX = refCenter - align.sel
        bestOrientationX = align.orientation
      }
    }
  }

  if (bestOrientationX && bestDistanceX < Infinity) {
    snapOffsetX = bestOffsetX
    const guidePosition = selectionBounds.centerX + bestOffsetX
    guides.push({
      type: 'vertical',
      position: guidePosition,
      orientation: bestOrientationX,
    })
  }

  const alignmentsY: Array<{ ref: number; sel: number; orientation: 'top' | 'bottom' | 'center' }> = [
    { ref: 0, sel: selectionBounds.top, orientation: 'top' },
    { ref: 0, sel: selectionBounds.bottom, orientation: 'bottom' },
    { ref: 0, sel: selectionBounds.centerY, orientation: 'center' },
  ]

  let bestOffsetY = 0
  let bestDistanceY = Infinity
  let bestOrientationY: 'top' | 'bottom' | 'center' | null = null

  for (const refTop of refTops) {
    for (const align of alignmentsY) {
      const distance = Math.abs(refTop - align.sel)
      if (distance < threshold && distance < bestDistanceY) {
        bestDistanceY = distance
        bestOffsetY = refTop - align.sel
        bestOrientationY = align.orientation
      }
    }
  }

  for (const refBottom of refBottoms) {
    for (const align of alignmentsY) {
      const distance = Math.abs(refBottom - align.sel)
      if (distance < threshold && distance < bestDistanceY) {
        bestDistanceY = distance
        bestOffsetY = refBottom - align.sel
        bestOrientationY = align.orientation
      }
    }
  }

  for (const refCenter of refCentersY) {
    for (const align of alignmentsY) {
      const distance = Math.abs(refCenter - align.sel)
      if (distance < threshold && distance < bestDistanceY) {
        bestDistanceY = distance
        bestOffsetY = refCenter - align.sel
        bestOrientationY = align.orientation
      }
    }
  }

  if (bestOrientationY && bestDistanceY < Infinity) {
    snapOffsetY = bestOffsetY
    const guidePosition = selectionBounds.centerY + bestOffsetY
    guides.push({
      type: 'horizontal',
      position: guidePosition,
      orientation: bestOrientationY,
    })
  }

  return { guides, snapOffsetX, snapOffsetY }
}
