'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

const listeners = new Set<(toast: Toast) => void>()

export function showToast(type: Toast['type'], message: string) {
  const toast: Toast = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    message,
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
    const timer = setTimeout(onRemove, 3000)
    return () => clearTimeout(timer)
  }, [onRemove])

  const configs = {
    success: {
      icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,
      bg: 'bg-slate-900 border-slate-700',
      text: 'text-white',
    },
    error: {
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      bg: 'bg-red-900/95 border-red-700',
      text: 'text-red-100',
    },
    info: {
      icon: <Info className="w-4 h-4 text-blue-400" />,
      bg: 'bg-slate-900 border-slate-700',
      text: 'text-white',
    },
  }

  const config = configs[toast.type]

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg animate-slide-in-toast ${config.bg}`}
    >
      {config.icon}
      <span className={`text-sm ${config.text}`}>{toast.message}</span>
      <button onClick={onRemove} className="ml-1 text-slate-400 hover:text-white transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
