'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'

export interface ResizableSplitterProps {
  /** 拖拽时触发，delta 为本次移动的水平像素（右为正） */
  onResize: (delta: number) => void
  /** 开始拖拽 */
  onDragStart?: () => void
  /** 结束拖拽 */
  onDragEnd?: () => void
  /** 向左/向右甩过阈值时触发（用于右栏全屏吸附） */
  onSnap?: (direction: 'left' | 'right') => void
  /** 吸附阈值（像素），不传则不触发吸附 */
  snapThreshold?: number
  className?: string
  'aria-label'?: string
}

export function ResizableSplitter({
  onResize,
  onDragStart,
  onDragEnd,
  onSnap,
  snapThreshold,
  className,
  'aria-label': ariaLabel = '调整面板宽度',
}: ResizableSplitterProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const lastXRef = useRef(0)
  const snapTriggeredRef = useRef(false)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      startXRef.current = e.clientX
      lastXRef.current = e.clientX
      snapTriggeredRef.current = false
      setIsDragging(true)
      onDragStart?.()
    },
    [onDragStart]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      const delta = e.clientX - lastXRef.current
      lastXRef.current = e.clientX
      onResize(delta)

      if (snapThreshold && !snapTriggeredRef.current && onSnap) {
        const totalDelta = e.clientX - startXRef.current
        if (totalDelta <= -snapThreshold) {
          snapTriggeredRef.current = true
          onSnap('left')
        } else if (totalDelta >= snapThreshold) {
          snapTriggeredRef.current = true
          onSnap('right')
        }
      }
    },
    [isDragging, onResize, onSnap, snapThreshold]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      ;(e.target as Element).releasePointerCapture?.(e.pointerId)
      setIsDragging(false)
      onDragEnd?.()
    },
    [isDragging, onDragEnd]
  )

  // 防止拖拽时选择文本
  useEffect(() => {
    if (!isDragging) return
    const body = document.body
    const prevUserSelect = body.style.userSelect
    body.style.userSelect = 'none'
    return () => {
      body.style.userSelect = prevUserSelect
    }
  }, [isDragging])

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={clsx(
        'group relative z-20 flex w-1 shrink-0 cursor-col-resize items-center justify-center transition-colors',
        className
      )}
    >
      <div
        className={clsx(
          'h-full w-px transition-colors',
          isDragging
            ? 'bg-amber-500'
            : 'bg-slate-800 group-hover:bg-slate-600'
        )}
      />
      <div
        className={clsx(
          'absolute h-8 w-1 rounded-full transition-colors',
          isDragging
            ? 'bg-amber-500'
            : 'bg-slate-700 group-hover:bg-slate-500'
        )}
      />
    </div>
  )
}
