'use client'

import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { shallowEqual } from '@editor/lib/utils'

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const displayLabel = (data?.label as string) || (typeof label === 'string' ? label : undefined)

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#8B5CF6' : style.stroke || '#94a3b8',
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nopan"
          >
            <div
              className={`
                px-2 py-1 text-[10px] rounded-md whitespace-nowrap
                border backdrop-blur-sm
                ${selected
                  ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                  : 'bg-card/90 border-border text-muted-foreground'
                }
              `}
            >
              {displayLabel}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

function areEdgesEqual(prevProps: EdgeProps, nextProps: EdgeProps): boolean {
  if (prevProps.sourceX !== nextProps.sourceX) return false
  if (prevProps.sourceY !== nextProps.sourceY) return false
  if (prevProps.targetX !== nextProps.targetX) return false
  if (prevProps.targetY !== nextProps.targetY) return false
  if (prevProps.selected !== nextProps.selected) return false
  if (prevProps.label !== nextProps.label) return false
  if (prevProps.markerEnd !== nextProps.markerEnd) return false
  if (!shallowEqual(prevProps.style, nextProps.style)) return false
  if (prevProps.data?.label !== nextProps.data?.label) return false
  return true
}

export default memo(CustomEdge, areEdgesEqual)
