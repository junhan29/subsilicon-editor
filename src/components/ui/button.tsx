'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@editor/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-normal transition-timing-out-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        /* 主按钮 - 赭石渐变，创意工坊核心风格 */
        default:
          'bg-gradient-to-r from-ochre-500 to-terracotta text-primary-foreground shadow-soft-md shadow-ochre-500/20 hover:shadow-soft-lg hover:shadow-ochre-500/30 hover:brightness-110 border border-ochre-400/30 btn-stroke',
        /* 次要按钮 - 纸面效果 */
        secondary:
          'bg-ochre-50/80 text-ochre-900 shadow-soft-xs hover:bg-ochre-100 border border-ochre-200/50 paper-card',
        /* 危险按钮 */
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft-sm hover:bg-destructive/90',
        /* 描边按钮 - 手绘风格 */
        outline:
          'border-2 border-ochre-300/60 bg-transparent text-ochre-700 hover:bg-ochre-50 hover:border-ochre-400/80 sketch-border',
        /* 幽灵按钮 */
        ghost: 'hover:bg-ochre-50 hover:text-ochre-800 text-foreground',
        /* 链接按钮 */
        link: 'text-ochre-600 underline-offset-4 hover:underline',
        /* 硅基科技风 - 用于创境相关功能 */
        silicon:
          'bg-gradient-to-r from-silicon-600 to-silicon-500 text-white shadow-soft-md shadow-silicon-500/20 hover:shadow-soft-lg hover:shadow-silicon-500/30 hover:brightness-110 border border-silicon-400/30 btn-stroke',
        /* 艺术家手绘风 - 用于创作相关 */
        artist:
          'bg-gradient-to-br from-sage-500 to-ochre-400 text-white shadow-soft-md hover:shadow-soft-lg hover:brightness-105 border border-sage-400/30',
      },
      size: {
        default: 'h-10 px-5 py-2.5 rounded-lg',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
