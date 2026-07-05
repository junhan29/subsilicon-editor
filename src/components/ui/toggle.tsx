'use client'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  color?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function Toggle({ checked, onChange, color = 'bg-primary', size = 'md', disabled = false }: ToggleProps) {
  const dimensions = size === 'sm' ? 'w-9 h-4.5' : 'w-10 h-5'
  const translate = size === 'sm' ? (checked ? 'translate-x-4' : 'translate-x-0.5') : (checked ? 'translate-x-5' : 'translate-x-0.5')
  const knobSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative ${dimensions} rounded-full transition-colors ${checked ? color : 'bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 ${knobSize} bg-white rounded-full shadow transition-transform ${translate}`} />
    </button>
  )
}
