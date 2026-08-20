'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  /** 显示时长 ms；默认 3000，0 或负数 = 常驻不自动消失（需手动关闭） */
  duration?: number
}

const listeners = new Set<(toast: Toast) => void>()

export function showToast(type: Toast['type'], message: string, options?: { duration?: number }) {
  const toast: Toast = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    message,
    duration: options?.duration,
  }
  listeners.forEach(fn => fn(toast))
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    listeners.add(addToast)
    return () => {
      listeners.delete(addToast)
    }
  }, [addToast])

  return { toasts, removeToast }
}

export function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const duration = toast.duration ?? 3000
    // 常驻模式（0 或负数）不自动消失，由用户点关闭按钮手动关闭
    if (duration <= 0) return
    const timer = setTimeout(onRemove, duration)
    return () => clearTimeout(timer)
  }, [toast.duration, onRemove])

  const configs = {
    success: {
      icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,
      bg: 'bg-card border-border',
      text: 'text-white',
    },
    error: {
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      bg: 'bg-red-900/95 border-red-700',
      text: 'text-red-100',
    },
    info: {
      icon: <Info className="w-4 h-4 text-blue-400" />,
      bg: 'bg-card border-border',
      text: 'text-white',
    },
  }

  const config = configs[toast.type]

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-[2px] border shadow-lg shadow-[3px_3px_0_hsl(var(--gold)/0.15)] clip-path-polygon-[0_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%] animate-slide-in-toast ${config.bg}`}
    >
      {config.icon}
      <span className={`text-sm ${config.text}`}>{toast.message}</span>
      <button onClick={onRemove} className="ml-1 text-muted-foreground hover:text-white transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
