'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'

import { cn } from '@editor/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-normal transition-timing-out-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        /* 主按钮 - P5 红渐变 */
        default:
          'bg-gradient-to-r from-primary to-gold-400 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:brightness-110 border border-primary/30',
        /* 次要按钮 */
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 border border-border',
        /* 危险按钮 */
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        /* 描边按钮 */
        outline:
          'border-2 border-primary/60 bg-transparent text-primary hover:bg-primary/10 hover:border-primary',
        /* 幽灵按钮 */
        ghost: 'hover:bg-accent hover:text-accent-foreground text-foreground',
        /* 链接按钮 */
        link: 'text-primary underline-offset-4 hover:underline',
        /* 硅基科技风 */
        silicon:
          'bg-gradient-to-r from-silver-600 to-silver-500 text-foreground shadow-md hover:shadow-lg hover:brightness-110 border border-silver-400/30',
        /* 艺术家手绘风 */
        artist:
          'bg-gradient-to-br from-gold-500 to-gold-400 text-white shadow-md hover:shadow-lg hover:brightness-105 border border-gold-400/30',
        /* P5 纸板剪贴风：右上角斜切 + 硬阴影 + 红边框 */
        'p5-clipped':
          'relative bg-card text-foreground border-2 border-primary shadow-[4px_4px_0_hsl(var(--primary)/0.3)] hover:shadow-[6px_6px_0_hsl(var(--primary)/0.35)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-[2px_2px_0_hsl(var(--primary)/0.3)] active:translate-x-0 active:translate-y-0',
        /* 霓虹青：赛博朋克风 */
        'cyber-cyan':
          'bg-cyber-cyan-500/15 text-cyber-cyan-500 border border-cyber-cyan-500/50 hover:bg-cyber-cyan-500/25 hover:border-cyber-cyan-500 shadow-[0_0_0_1px_hsl(var(--cyber-cyan-500)/0.15),0_0_16px_hsl(var(--cyber-cyan-500)/0.2)] hover:shadow-[0_0_0_1px_hsl(var(--cyber-cyan-500)/0.25),0_0_24px_hsl(var(--cyber-cyan-500)/0.35)]',
        /* 霓虹洋红：赛博朋克风 */
        'cyber-magenta':
          'bg-cyber-magenta-500/15 text-cyber-magenta-500 border border-cyber-magenta-500/50 hover:bg-cyber-magenta-500/25 hover:border-cyber-magenta-500 shadow-[0_0_0_1px_hsl(var(--cyber-magenta-500)/0.15),0_0_16px_hsl(var(--cyber-magenta-500)/0.2)] hover:shadow-[0_0_0_1px_hsl(var(--cyber-magenta-500)/0.25),0_0_24px_hsl(var(--cyber-magenta-500)/0.35)]',
        /* 金印章风：强对比金色按钮 */
        'stamp-gold':
          'bg-gold-400/10 text-gold-400 border-2 border-gold-400 hover:bg-gold-400/20 hover:text-gold-300 font-bold tracking-wide shadow-[inset_0_0_0_1px_hsl(var(--gold)/0.25)]',
        /* 红印章风：斜切 + 旋转小角度 */
        'stamp-red':
          'bg-primary/10 text-primary border-2 border-primary hover:bg-primary/18 hover:text-primary-foreground font-bold tracking-wide shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]',
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
