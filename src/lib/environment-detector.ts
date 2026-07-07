export interface EnvironmentInfo {
  isDesktop: boolean
  isElectron: boolean
  isWeb: boolean
  platform: 'windows' | 'macos' | 'linux' | 'web'
  electronVersion?: string
  appVersion?: string
}

const cachedEnvironment: EnvironmentInfo = {
  isDesktop: false,
  isElectron: false,
  isWeb: true,
  platform: 'web',
}

function detectEnvironment(): EnvironmentInfo {
  if (typeof window !== 'undefined') {
    const userAgent = window.navigator.userAgent.toLowerCase()
    
    if (userAgent.includes(' electron/')) {
      cachedEnvironment.isElectron = true
      cachedEnvironment.isDesktop = true
      cachedEnvironment.isWeb = false
      
      const electronMatch = userAgent.match(/electron\/([\d.]+)/)
      cachedEnvironment.electronVersion = electronMatch ? electronMatch[1] : undefined
      
      if (userAgent.includes('windows')) {
        cachedEnvironment.platform = 'windows'
      } else if (userAgent.includes('mac os') || userAgent.includes('macos')) {
        cachedEnvironment.platform = 'macos'
      } else if (userAgent.includes('linux')) {
        cachedEnvironment.platform = 'linux'
      }
    }
  }
  
  return cachedEnvironment
}

export const environment = detectEnvironment()

export function isDesktop(): boolean {
  return environment.isDesktop
}

export function isElectron(): boolean {
  return environment.isElectron
}

export function isWeb(): boolean {
  return environment.isWeb
}

export function getPlatform(): EnvironmentInfo['platform'] {
  return environment.platform
}

export function getElectronVersion(): string | undefined {
  return environment.electronVersion
}

export function getAppVersion(): string | undefined {
  if (isElectron()) {
    return (window as any).__electronAPI?.getVersion?.()
  }
  try {
    const meta = document.querySelector('meta[name="app-version"]')
    return meta?.getAttribute('content') ?? undefined
  } catch {
    return undefined
  }
}

export interface FeatureSupport {
  fileSystem: boolean
  autoUpdate: boolean
  localAI: boolean
  nativeDialogs: boolean
  performanceMonitor: boolean
}

export function getFeatureSupport(): FeatureSupport {
  return {
    fileSystem: isElectron(),
    autoUpdate: isElectron(),
    localAI: isElectron() || (window as any).__ollamaAPI !== undefined,
    nativeDialogs: isElectron(),
    performanceMonitor: isElectron(),
  }
}

export function showFeatureNotSupported(feature: string): void {
  const support = getFeatureSupport()
  const featureNames: Record<string, string> = {
    fileSystem: '文件系统访问',
    autoUpdate: '自动更新',
    localAI: '本地AI模型',
    nativeDialogs: '原生对话框',
    performanceMonitor: '性能监控',
  }
  
  const message = `${featureNames[feature] || feature}功能在当前环境不可用。${
    isWeb() 
      ? '建议使用桌面版以获得完整功能体验。' 
      : '请检查应用版本。'
  }`
  
  console.warn(`Feature not supported: ${feature}`)
  
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('subsilicon:feature-not-supported', {
      detail: { feature, message },
    })
    window.dispatchEvent(event)
  }
}
