'use client'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  color?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function Toggle({ checked, onChange, color = 'bg-primary', size = 'md', disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200 ${
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
      } ${checked ? color : 'bg-slate-500'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute inset-y-0 my-auto rounded-full bg-white shadow-sm transition-transform duration-200 ${
          size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
        } ${checked ? (size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-[2px]'}`}
      />
    </button>
  )
}
