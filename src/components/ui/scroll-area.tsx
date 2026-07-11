'use client'

import * as React from 'react'
import { cn } from '@editor/lib/utils'

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        {...props}
      >
        <div
          className={cn(
            'h-full w-full overflow-y-auto overflow-x-hidden',
            'scrollbar-thin scrollbar-thumb-ochre-300 scrollbar-track-transparent scrollbar-thumb-rounded-full hover:scrollbar-thumb-ochre-400',
            viewportClassName
          )}
        >
          {children}
        </div>
      </div>
    )
  }
)
ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }
