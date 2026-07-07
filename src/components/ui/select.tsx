'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const SelectContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

export function Select({ value, onValueChange, children }: {
  value?: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <SelectContext.Provider value={{ value: value || '', onValueChange }}>
      {children}
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const context = React.useContext(SelectContext)

  if (!context) {
    throw new Error('SelectTrigger must be used within a Select component')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-background border border-border rounded-md text-sm hover:bg-accent transition-colors"
      >
        {children}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <SelectContent onClose={() => setOpen(false)}>
          {children}
        </SelectContent>
      )}
    </div>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext)

  if (!context) {
    throw new Error('SelectValue must be used within a Select component')
  }

  return (
    <span className="text-left flex-1">
      {context.value || placeholder || ''}
    </span>
  )
}

export function SelectContent({ onClose, children }: {
  onClose: () => void
  children: React.ReactNode
}) {
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!target.closest('[data-select-content]')) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      data-select-content
      className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg overflow-hidden"
    >
      {children}
    </div>
  )
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const context = React.useContext(SelectContext)

  if (!context) {
    throw new Error('SelectItem must be used within a Select component')
  }

  const isSelected = context.value === value

  return (
    <button
      onClick={() => {
        context.onValueChange(value)
      }}
      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}
