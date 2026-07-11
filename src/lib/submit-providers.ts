/**
 * 作品墙提交提供商注册系统
 *
 * 提供商（SubmitProvider）抽象了"把作品提交到哪里"这一行为。
 * 默认内置 SubSilicon 官方作品墙；任何实现了下方协议的第三方展示服务
 * 都可以通过 addToRegistry 注册，或由用户在设置面板中添加。
 *
 * 公共提交协议（任何第三方展示服务均可实现）：
 *
 *   POST {provider.apiUrl}
 *   Headers:
 *     {provider.authHeader}: {provider.authToken}   // 默认头名 X-Submit-Token
 *   Body (multipart/form-data):
 *     creatorEmail      string         创作者邮箱
 *     creatorName       string         创作者显示名
 *     creatorBio        string   可选  创作者简介
 *     title             string         作品标题
 *     summary           string         一句话简介
 *     tags              string         JSON 字符串数组，如 ["古风","悬疑"]
 *     coverImage        File     可选  封面图（建议 16:9，≤2MB）
 *     screenshot-N      File     可选  截图（N 从 0 起递增，≤6 张）
 *     contactInfo       string   可选  联系方式（如微信号）
 *     externalLink      string   可选  外部链接（如爱发电/面包多）
 *     previewHtml       File           预览 HTML（text/html）
 *     workId            string   可选  作品 ID（更新已有作品时传入）
 *
 *   Response:
 *     2xx                  成功
 *     4xx / 5xx            失败，body 应为 { message: string }
 */

export interface SubmitProvider {
  /** 唯一标识，建议使用 reverse-DNS 形式，如 cn.subsilicon.wall */
  id: string
  /** 显示名称 */
  name: string
  /** 提交端点 URL */
  apiUrl: string
  /** 鉴权头名称，默认 X-Submit-Token */
  authHeader?: string
  /** 鉴权令牌 */
  authToken?: string
  /** 是否启用 */
  enabled: boolean
  /** 是否为内置预设（不可删除） */
  builtin: boolean
  /** 简短描述 */
  description?: string
}

const REGISTRY_KEY = 'subsilicon.submit.providers.v1'
const ACTIVE_KEY = 'subsilicon.submit.activeProviderId.v1'

const DEFAULT_BUILTIN: SubmitProvider[] = [
  {
    id: 'cn.subsilicon.wall',
    name: 'SubSilicon 作品墙',
    apiUrl: 'https://subsilicon.cn/api/creator/preview/submit',
    authHeader: 'X-Submit-Token',
    authToken: 'subsilicon-preview-submit-2026',
    enabled: true,
    builtin: true,
    description: 'SubSilicon 官方作品展示墙',
  },
]

type Listener = () => void
const listeners = new Set<Listener>()

function emitChange(): void {
  for (const l of listeners) l()
}

function safeReadProviders(): SubmitProvider[] {
  if (typeof localStorage === 'undefined') return [...DEFAULT_BUILTIN]
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return [...DEFAULT_BUILTIN]
    const parsed = JSON.parse(raw) as SubmitProvider[]
    // 合并内置默认值（确保升级后仍出现新增的内置预设）
    const builtinIds = new Set(parsed.filter(p => p.builtin).map(p => p.id))
    const merged = [
      ...parsed,
      ...DEFAULT_BUILTIN.filter(p => !builtinIds.has(p.id)),
    ]
    return merged
  } catch {
    return [...DEFAULT_BUILTIN]
  }
}

function safeWriteProviders(list: SubmitProvider[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list))
  } catch {
    // 忽略写入失败（隐私模式 / 配额超限）
  }
}

function safeReadActiveId(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_BUILTIN[0].id
  return localStorage.getItem(ACTIVE_KEY) || DEFAULT_BUILTIN[0].id
}

function safeWriteActiveId(id: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    // 忽略
  }
}

export function listProviders(): SubmitProvider[] {
  return safeReadProviders()
}

export function getEnabledProviders(): SubmitProvider[] {
  return listProviders().filter(p => p.enabled)
}

export function getActiveProvider(): SubmitProvider {
  const list = listProviders()
  const activeId = safeReadActiveId()
  return list.find(p => p.id === activeId && p.enabled) ||
    list.find(p => p.enabled) ||
    list[0] ||
    DEFAULT_BUILTIN[0]
}

export function setActiveProvider(id: string): void {
  safeWriteActiveId(id)
  emitChange()
}

export function addProvider(provider: Omit<SubmitProvider, 'builtin' | 'id'> & { id?: string }): SubmitProvider {
  const list = listProviders()
  const id = provider.id || `custom.${Date.now()}`
  if (list.some(p => p.id === id)) {
    throw new Error(`已存在 ID 为 ${id} 的提供商`)
  }
  const next: SubmitProvider = { ...provider, id, builtin: false }
  safeWriteProviders([...list, next])
  emitChange()
  return next
}

export function updateProvider(id: string, patch: Partial<Omit<SubmitProvider, 'id' | 'builtin'>>): void {
  const list = listProviders()
  const idx = list.findIndex(p => p.id === id)
  if (idx === -1) return
  list[idx] = { ...list[idx], ...patch }
  safeWriteProviders(list)
  emitChange()
}

export function removeProvider(id: string): void {
  const list = listProviders()
  const target = list.find(p => p.id === id)
  if (!target || target.builtin) return
  safeWriteProviders(list.filter(p => p.id !== id))
  if (safeReadActiveId() === id) {
    safeWriteActiveId(DEFAULT_BUILTIN[0].id)
  }
  emitChange()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
