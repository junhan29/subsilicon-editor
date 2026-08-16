'use client'

import { MessageSquare } from 'lucide-react'

interface AiFloatingButtonProps {
  onClick: () => void
  isOpen: boolean
}

export function AiFloatingButton({ onClick, isOpen }: AiFloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center
        rounded-xl shadow-lg transition-all duration-200
        ${isOpen
          ? 'bg-accent text-foreground ring-1 ring-border'
          : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl hover:scale-105'
        }
      `}
      title="AI 亚硅 (Ctrl+K)"
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  )
}
