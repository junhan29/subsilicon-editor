'use client'

import * as React from 'react'

interface SliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  className?: string
  onPointerDown?: () => void
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  onPointerDown,
}: SliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const currentValue = value[0] ?? min
  const percentage = ((currentValue - min) / (max - min)) * 100

  const updateValue = (clientX: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const rawValue = ratio * (max - min) + min
    const steppedValue = Math.round(rawValue / step) * step
    const clampedValue = Math.max(min, Math.min(max, steppedValue))
    onValueChange([clampedValue])
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    onPointerDown?.()
    updateValue(e.clientX)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    updateValue(e.clientX)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  return (
    <div
      ref={trackRef}
      className={`relative h-2 rounded-full bg-muted cursor-pointer touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-primary"
        style={{ width: `${percentage}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-sm cursor-grab active:cursor-grabbing"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  )
}