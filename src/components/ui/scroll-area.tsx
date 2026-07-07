'use client'

import * as React from 'react'

export function ScrollArea({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`overflow-y-auto ${className || ''}`}
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-accent) transparent' }}
    >
      {children}
    </div>
  )
}
