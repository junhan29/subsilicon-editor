const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  if (!container) return []
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  return Array.from(elements).filter((el) => {
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    return true
  })
}

export function focusFirstInteractive(container: HTMLElement): void {
  const elements = getFocusableElements(container)
  if (elements.length > 0) {
    elements[0].focus()
  }
}

export function trapFocus(container: HTMLElement): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    const focusable = getFocusableElements(container)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement as HTMLElement | null

    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)
  return () => container.removeEventListener('keydown', handleKeyDown)
}

export function restoreFocus(element: HTMLElement): () => void {
  const previousActive = document.activeElement as HTMLElement | null
  return () => {
    if (previousActive && typeof previousActive.focus === 'function') {
      previousActive.focus()
    }
  }
}
