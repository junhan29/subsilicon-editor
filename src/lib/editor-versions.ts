// SubSilicon Editor 仅支持桌面端（Electron）
// 所有功能均可直接使用，无需版本检测

export function isDesktop(): boolean {
  return true
}

export function getCurrentEdition(): 'desktop' {
  return 'desktop'
}

export function hasFeature(_feature: string): boolean {
  return true
}

export function requireDesktop(_featureName: string): boolean {
  return true
}

export function getEditionDisplayName(): string {
  return '桌面版'
}

export function getMaxWorks(): number | null {
  return null
}
