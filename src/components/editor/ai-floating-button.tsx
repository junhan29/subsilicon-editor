'use client'

import { MessageSquare } from 'lucide-react'
import { useAssistantName } from '@editor/lib/assistant-name'

interface AiFloatingButtonProps {
  onClick: () => void
  isOpen: boolean
}

export function AiFloatingButton({ onClick, isOpen }: AiFloatingButtonProps) {
  const assistantName = useAssistantName()
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
      title={`AI ${assistantName} (Ctrl+K)`}
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  )
}
