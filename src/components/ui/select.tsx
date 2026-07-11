'use client'

import * as React from 'react'
import { cn } from '@editor/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('Select components must be used within <Select>')
  return ctx
}

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Select({ value, defaultValue, onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '')
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const currentValue = value !== undefined ? value : internalValue

  const handleValueChange = React.useCallback((newValue: string) => {
    if (value === undefined) setInternalValue(newValue)
    onValueChange?.(newValue)
    setOpen(false)
  }, [value, onValueChange])

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        contentRef.current && !contentRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, open, setOpen, triggerRef }}>
      <div className="relative w-full">{children}</div>
      {open && (
        <div ref={contentRef} className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }} />
      )}
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useSelectContext()

    return (
      <button
        ref={(node) => {
          ;(triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-ochre-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-ochre-400 focus:outline-none focus:ring-2 focus:ring-ochre-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
SelectTrigger.displayName = 'SelectTrigger'

function SelectValue({ placeholder, className }: { placeholder?: string; className?: string }) {
  const { value } = useSelectContext()
  return <span className={cn('text-ochre-700', className)}>{value || placeholder}</span>
}

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { position?: 'popper' }
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useSelectContext()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 })

  React.useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [open, triggerRef])

  React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement)

  if (!open) return null

  return (
    <div
      ref={contentRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 9999,
      }}
      className={cn(
        'max-h-80 overflow-auto rounded-md border border-ochre-200 bg-white p-1 shadow-soft-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
SelectContent.displayName = 'SelectContent'

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  children: React.ReactNode
}

function SelectItem({ className, value, children, ...props }: SelectItemProps) {
  const { value: selectedValue, onValueChange } = useSelectContext()
  const isSelected = selectedValue === value

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-2 text-sm text-ochre-800 hover:bg-ochre-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        isSelected && 'bg-ochre-100 font-medium',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const SelectIcon = ChevronDown

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectIcon }
