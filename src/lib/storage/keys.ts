import type { StorageType } from './types'

export interface StorageKeyConfig {
  key: string
  version: number
  type: StorageType
  description: string
}

export const STORAGE_KEYS = {
  AI_CONFIG: {
    key: 'subsilicon_ai_config',
    version: 2,
    type: 'local' as StorageType,
    description: 'AI 配置信息',
  },
  THEME: {
    key: 'subsilicon_theme',
    version: 1,
    type: 'local' as StorageType,
    description: '主题设置',
  },
  ACCOUNT: {
    key: 'subsilicon_account',
    version: 2,
    type: 'local' as StorageType,
    description: '本地账户信息',
  },
  TEMPLATES: {
    key: 'subsilicon_templates',
    version: 1,
    type: 'local' as StorageType,
    description: '用户模板',
  },
  ANNOTATIONS: {
    key: 'subsilicon_annotations',
    version: 1,
    type: 'local' as StorageType,
    description: '批注数据',
  },
  SHORTCUTS: {
    key: 'subsilicon_shortcuts',
    version: 1,
    type: 'local' as StorageType,
    description: '快捷键配置',
  },
  WRITING_SESSION: {
    key: 'subsilicon_writing_session',
    version: 1,
    type: 'session' as StorageType,
    description: '写作会话统计',
  },
  ANALYTICS_SESSION: {
    key: 'subsilicon_current_session',
    version: 1,
    type: 'session' as StorageType,
    description: '读者分析当前会话',
  },
  PLUGINS: {
    key: 'subsilicon_plugins',
    version: 1,
    type: 'local' as StorageType,
    description: '插件配置',
  },
  COMPLIANCE: {
    key: 'subsilicon_compliance',
    version: 1,
    type: 'local' as StorageType,
    description: '合规设置',
  },
  SYNC: {
    key: 'subsilicon_sync',
    version: 1,
    type: 'local' as StorageType,
    description: '同步配置',
  },
  QUALITY: {
    key: 'subsilicon_quality',
    version: 1,
    type: 'local' as StorageType,
    description: '质量检测设置',
  },
  MONETIZATION: {
    key: 'subsilicon_monetization',
    version: 1,
    type: 'local' as StorageType,
    description: '变现设置',
  },
  ONBOARDING: {
    key: 'subsilicon_onboarding',
    version: 1,
    type: 'local' as StorageType,
    description: '新手引导状态',
  },
  PERFORMANCE: {
    key: 'subsilicon_performance',
    version: 1,
    type: 'local' as StorageType,
    description: '性能模式设置',
  },
} as const

export type StorageKeyName = keyof typeof STORAGE_KEYS

export function getStorageKey(name: StorageKeyName): string {
  const config = STORAGE_KEYS[name]
  return `${config.key}_v${config.version}`
}

export function getAllStorageKeys(): Record<StorageKeyName, string> {
  const result = {} as Record<StorageKeyName, string>
  for (const name of Object.keys(STORAGE_KEYS) as StorageKeyName[]) {
    result[name] = getStorageKey(name)
  }
  return result
}

export function getLocalStorageKeys(): StorageKeyName[] {
  return (Object.keys(STORAGE_KEYS) as StorageKeyName[]).filter(
    (name) => STORAGE_KEYS[name].type === 'local'
  )
}

export function getSessionStorageKeys(): StorageKeyName[] {
  return (Object.keys(STORAGE_KEYS) as StorageKeyName[]).filter(
    (name) => STORAGE_KEYS[name].type === 'session'
  )
}

export function validateStorageKey(key: string): boolean {
  return Object.values(STORAGE_KEYS).some(
    (config) => key.startsWith(config.key)
  )
}
