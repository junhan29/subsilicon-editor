export const EDITOR_EDITIONS = {
  WEB: 'web' as const,
  DESKTOP: 'desktop' as const,
} as const

export type EditorEdition = (typeof EDITOR_EDITIONS)[keyof typeof EDITOR_EDITIONS]

export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).__electronAPI
}

export function getCurrentEdition(): EditorEdition {
  if (typeof window === 'undefined') return 'web'
  if (!isDesktop()) return 'web'
  return 'desktop'
}

export const FEATURE_MATRIX: Record<EditorEdition, Set<string>> = {
  web: new Set([
    'edit',
    'export-json',
  ]),
  desktop: new Set([
    'edit',
    'export-json',
    'export-html',
    'export-zip',
    'export-script',
    'export-epub',
    'save-local',
    'open-local-file',
    'unlimited-works',
    'no-watermark',
    'ai-text-polish',
    'ai-text-generate',
    'ai-branch-suggest',
    'ai-character-generate',
    'ai-scene-describe',
    'ai-image-generate',
    'ai-image-style-transfer',
    'ai-cover-design',
    'ai-translate',
    'ai-summary',
    'ai-story-outline',
    'ai-dialogue-expand',
    'advanced-templates',
    'custom-css',
    'custom-js',
    'version-check',
    'update-notification',
    'directory-upload',
  ]),
}

export function hasFeature(feature: string): boolean {
  return FEATURE_MATRIX[getCurrentEdition()].has(feature)
}

export function requireDesktop(featureName: string): boolean {
  const edition = getCurrentEdition()
  if (edition === 'desktop') return true
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ss:require-desktop', {
      detail: { feature: featureName }
    }))
  }
  return false
}

export function getEditionDisplayName(edition?: EditorEdition): string {
  const e = edition ?? getCurrentEdition()
  switch (e) {
    case 'web': return 'Web 版'
    case 'desktop': return '桌面版'
  }
}

export function getMaxWorks(): number | null {
  return null
}
