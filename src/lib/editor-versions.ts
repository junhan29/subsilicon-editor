export type EditorEdition = 'web' | 'desktop'

export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).__electronAPI
}

export function getCurrentEdition(): EditorEdition {
  return isDesktop() ? 'desktop' : 'web'
}

export function hasFeature(_feature: string): boolean {
  return isDesktop()
}
