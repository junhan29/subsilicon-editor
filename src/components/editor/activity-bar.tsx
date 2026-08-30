'use client'

import { useCallback } from 'react'
import clsx from 'clsx'

export interface ActivityBarItem {
  id: string
  icon: React.ReactNode
  label: string
}

interface ActivityBarProps {
  side: 'left' | 'right'
  items: ActivityBarItem[]
  activeItem: string | null
  onItemClick: (id: string | null) => void
  bottomItems?: ActivityBarItem[]
}

export function ActivityBar({
  side,
  items,
  activeItem,
  onItemClick,
  bottomItems,
}: ActivityBarProps) {
  const handleClick = useCallback(
    (id: string) => {
      if (activeItem === id) {
        onItemClick(null) // toggle off
      } else {
        onItemClick(id)
      }
    },
    [activeItem, onItemClick]
  )

  return (
    <div
      className={clsx(
        'flex w-11 flex-col items-center border-border bg-muted/50 py-1 shrink-0',
        side === 'left' ? 'border-r' : 'border-l'
      )}
      role="tablist"
      aria-orientation="vertical"
    >
      <div className="flex flex-col items-center gap-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            className={clsx(
              'relative flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors',
              activeItem === item.id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
            title={item.label}
            role="tab"
            aria-selected={activeItem === item.id}
            aria-label={item.label}
          >
            {activeItem === item.id && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
            )}
            {item.icon}
          </button>
        ))}
      </div>
      {bottomItems && bottomItems.length > 0 && (
        <>
          <div className="my-1 h-px w-5 bg-border" />
          <div className="flex flex-col items-center gap-0.5 mt-auto">
            {bottomItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={clsx(
                  'relative flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors',
                  activeItem === item.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
                title={item.label}
                role="tab"
                aria-selected={activeItem === item.id}
                aria-label={item.label}
              >
                {activeItem === item.id && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
                )}
                {item.icon}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
