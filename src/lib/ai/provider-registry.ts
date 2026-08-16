import type { AiConfig, AiProvider, AiProviderConfig, AiRequestOptions, AiStreamResult } from './types'
import { OpenAiCompatibleProvider } from './providers/openai-compatible'
import { ollamaProvider } from './providers/ollama-provider'
import { PING_PROMPT, runStrictConnectivityTest } from './request-builder'
import { initLocalModelConfig } from '../local-model-manager'
import { getTaskRoutingConfig, getTaskSkillPrompt, resolveTextProviderForTask, type AiTaskType, type TaskTextSlot } from './task-routing'

initLocalModelConfig()

let cachedConfig: AiConfig | null = null
let cachedProviders: AiProvider[] = []
let remoteProviders: OpenAiCompatibleProvider[] = []

/** FlatAiConfig 格式（来自 ai-settings-dialog / settings-page） */
type FlatishConfig = Record<string, unknown> & { enabled?: boolean }

function isFlatConfig(config: AiConfig | null): config is AiConfig & FlatishConfig {
  return !!(config && ((config as unknown) as FlatishConfig).apiKey)
}

function loadConfig(): AiConfig | null {
  try {
    const saved = localStorage.getItem('subsilicon_ai_config')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function flatToProviderConfig(cfg: AiConfig & FlatishConfig): AiProviderConfig {
  const providerId = (cfg.provider as string) || 'openai'
  return {
    id: providerId,
    name: providerId,
    provider: (cfg.provider as AiProviderConfig['provider']) || 'openai',
    enabled: true,
    apiKey: cfg.apiKey as string,
    apiUrl: cfg.apiUrl as string,
    model: cfg.model as string,
  }
}

function buildProviders(config: AiConfig | null): AiProvider[] {
  const providers: AiProvider[] = []

  if (config?.enabled) {
    if (Array.isArray(config.providers) && config.providers.length > 0) {
      for (const p of config.providers) {
        if (p.enabled && p.apiKey) {
          providers.push(new OpenAiCompatibleProvider(p.id, p.name, p))
        }
      }
    } else if (isFlatConfig(config)) {
      const pc = flatToProviderConfig(config)
      providers.push(new OpenAiCompatibleProvider(pc.id, pc.name, pc))
    }
  }

  providers.push(ollamaProvider)
  return providers
}

function refreshProviders() {
  const config = loadConfig()
  cachedConfig = config
  cachedProviders = buildProviders(config)
  remoteProviders = cachedProviders.filter(
    (p): p is OpenAiCompatibleProvider => p.type === 'remote'
  )
}

export class AiConfigNeededError extends Error {
  needsConfig = true
  constructor() {
    super('请先配置创作助理服务商或启动本地 Ollama')
    this.name = 'AiConfigNeededError'
  }
}

export function getAiConfig(): AiConfig | null {
  if (!cachedConfig) {
    refreshProviders()
  }
  return cachedConfig
}

export function getActiveProvider(config?: AiConfig | null): AiProviderConfig | null {
  const cfg = config ?? getAiConfig()
  if (!cfg?.enabled) return null

  // 兼容 FlatAiConfig 格式
  if (isFlatConfig(cfg)) {
    return flatToProviderConfig(cfg)
  }

  // AiConfig 格式
  const provider = cfg.providers?.find((p) => p.enabled)
  return provider || null
}

export function isAiAvailable(): boolean {
  const config = getAiConfig()
  if (!config?.enabled) return false

  // 兼容 FlatAiConfig 格式
  if (isFlatConfig(config)) return true

  // AiConfig 格式
  const hasRemote = config.providers?.some((p) => p.enabled && p.apiKey)
  if (hasRemote) return true

  return false
}

export async function checkLocalAiAvailability(): Promise<boolean> {
  return ollamaProvider.isAvailable()
}

export async function callAi(options: AiRequestOptions, _config?: AiConfig | null): Promise<string> {
  if (!cachedConfig) {
    refreshProviders()
  }

  let lastError: unknown = null

  for (const provider of cachedProviders) {
    try {
      const available = await provider.isAvailable()
      if (!available) continue

      return await provider.generate(options)
    } catch (error) {
      lastError = error
      console.warn(`AI provider ${provider.name} failed, trying next:`, error)
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new AiConfigNeededError()
}

export function getAvailableProviders(): AiProvider[] {
  if (!cachedConfig) {
    refreshProviders()
  }
  return [...cachedProviders]
}

export function refreshAiConfig() {
  refreshProviders()
}

export function resetAiRegistry() {
  cachedConfig = null
  cachedProviders = []
  remoteProviders = []
}

export async function callAiStream(options: AiRequestOptions, _config?: AiConfig | null): Promise<AiStreamResult> {
  if (!cachedConfig) {
    refreshProviders()
  }

  let lastError: unknown = null

  for (const provider of cachedProviders) {
    try {
      const available = await provider.isAvailable()
      if (!available) continue

      if (provider.generateStream) {
        const rawStream = provider.generateStream(options)
        // 不预先消耗流 — 用 bufferTee 实现同时收集全文和流式输出
        return bufferTee(rawStream)
      }

      const result = await provider.generate(options)
      const stream = fallbackStream(result)
      return { stream, fullText: Promise.resolve(result) }
    } catch (error) {
      lastError = error
      console.warn(`AI provider ${provider.name} failed, trying next:`, error)
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new AiConfigNeededError()
}

/** 创建一个 tee：同时供流式消费和收集全文 */
function bufferTee(
  raw: AsyncGenerator<string, void, unknown>
): AiStreamResult {
  let fullText = ''
  let resolveFullText!: (text: string) => void
  const fullTextPromise = new Promise<string>((resolve) => {
    resolveFullText = resolve
  })

  const stream = (async function* () {
    try {
      for await (const chunk of raw) {
        fullText += chunk
        yield chunk
      }
    } finally {
      resolveFullText(fullText)
    }
  })()

  return { stream, fullText: fullTextPromise }
}

async function collectStream(stream: AsyncGenerator<string, void, unknown>): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    result += chunk
  }
  return result
}

async function* fallbackStream(text: string): AsyncGenerator<string, void, unknown> {
  const chunkSize = 3
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize)
    await new Promise((r) => setTimeout(r, 10))
  }
}

// ---------- 任务路由调用（editor / text） ----------

function buildProviderFor(p: AiProviderConfig): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider(p.id, p.name, p)
}

/** 合并任务槽的覆盖参数与技能 prompt 到请求选项 */
function mergeTaskOptions(task: AiTaskType, options: AiRequestOptions): AiRequestOptions {
  const routing = getTaskRoutingConfig()
  const slot = routing[task] as TaskTextSlot | undefined
  const skill = getTaskSkillPrompt(task)
  const merged: AiRequestOptions = {
    ...options,
    systemPrompt: skill ? `${options.systemPrompt || ''}\n\n${skill}`.trim() : options.systemPrompt,
    temperature: slot?.temperature ?? options.temperature,
    maxTokens: slot?.maxTokens ?? options.maxTokens,
  }
  return merged
}

/**
 * 按任务路由调用文本 AI（editor / text 槽）。
 * 优先使用该任务槽指定的 provider；槽未配置或调用失败时回退到默认回退链。
 */
export async function callAiForTask(
  task: 'editor' | 'text',
  options: AiRequestOptions
): Promise<string> {
  const merged = mergeTaskOptions(task, options)
  const provider = resolveTextProviderForTask(task, () => getActiveProvider())
  if (provider) {
    try {
      return await buildProviderFor(provider).generate(merged)
    } catch (error) {
      console.warn(`task-routing: ${task} 槽 provider ${provider.name} 失败，回退默认链路:`, error)
    }
  }
  return callAi(merged)
}

/**
 * 按任务路由调用文本 AI（流式，editor / text 槽）。
 * 语义同 callAiForTask，返回流式结果。
 */
export async function callAiStreamForTask(
  task: 'editor' | 'text',
  options: AiRequestOptions
): Promise<AiStreamResult> {
  const merged = mergeTaskOptions(task, options)
  const provider = resolveTextProviderForTask(task, () => getActiveProvider())
  if (provider) {
    try {
      const p = buildProviderFor(provider)
      if (p.generateStream) {
        return bufferTee(p.generateStream(merged))
      }
      const result = await p.generate(merged)
      return { stream: fallbackStream(result), fullText: Promise.resolve(result) }
    } catch (error) {
      console.warn(`task-routing: ${task} 槽 provider ${provider.name} 失败，回退默认链路:`, error)
    }
  }
  return callAiStream(merged)
}

export interface ConnectivityCheckResult {
  ok: boolean
  status: number
  latencyMs: number
  providerId: string
  providerName: string
  type: 'remote' | 'local'
  error?: string
  content?: string
}

export interface AiIndependentRunReport {
  /** 是否存在任意一种可工作的 AI 路径 */
  overallOk: boolean
  /** 配置层面（enabled + apiKey/model 均已填）是否可用 */
  configReady: boolean
  /** 远程连通性结果 */
  remoteResults: ConnectivityCheckResult[]
  /** 本地连通性结果（Ollama） */
  localResults: ConnectivityCheckResult[]
  /** 业务级冒烟（最小 prompt 走完全链路）结果 */
  smokeResults: ConnectivityCheckResult[]
  /** 提示语：建议如何修复 */
  suggestions: string[]
  checkedAt: string
}

/**
 * AI 独立运行自检（"接入 API 后是否可以独立运行" 的标准验证）。
 * 三步法：
 *   1) 配置完整度检查
 *   2) 对每个远程/本地 provider 执行"严格同源"连通性测试
 *   3) 用最小 prompt 走一遍完整业务链路（callAi → 解析），作为业务级冒烟
 * 测试用 prompt 为最小 token（"Reply with one word: OK" + "Ping"），对账号成本几乎无影响。
 */
export async function runAiIndependentSelfCheck(
  configOverride?: AiConfig | null
): Promise<AiIndependentRunReport> {
  const cfg = configOverride ?? getAiConfig() ?? null
  const suggestions: string[] = []
  let configReady = false
  const remoteResults: ConnectivityCheckResult[] = []
  const localResults: ConnectivityCheckResult[] = []

  // --- 第 1 步：配置完整度 ---
  if (!cfg) {
    suggestions.push('尚未保存任何创作助理配置，请到创作助理设置填写 API Key / 启动本地 Ollama')
  } else if (!cfg.enabled) {
    suggestions.push('创作助理开关为"关闭"状态，请在创作助理设置中启用')
  } else {
    if (isFlatConfig(cfg)) {
      if (!cfg.apiKey) suggestions.push('Flat 配置缺失 apiKey 字段')
      if (!cfg.model) suggestions.push('请选择模型（Flat 配置）')
      configReady = !!(cfg.apiKey && cfg.model)
    } else if (Array.isArray(cfg.providers)) {
      const enabled = cfg.providers.filter((p) => p.enabled)
      if (enabled.length === 0) suggestions.push('未启用任何一个远程创作助理服务商')
      for (const p of enabled) {
        if (!p.apiKey) suggestions.push(`服务商 ${p.name} 未填 API Key`)
        if (!p.model) suggestions.push(`服务商 ${p.name} 未选择模型`)
      }
      configReady = enabled.every((p) => !!p.apiKey && !!p.model) && enabled.length > 0
    }
  }

  // --- 第 2 步：对每个 provider 执行连通性测试（严格同源） ---
  const snapshotProviders = cfg !== cachedConfig || cachedProviders.length === 0
    ? buildProviders(cfg ?? loadConfig())
    : cachedProviders

  for (const provider of snapshotProviders) {
    if (provider.type === 'remote') {
      try {
        const p = provider as OpenAiCompatibleProvider
        const res = await p.testConnectivity()
        remoteResults.push({
          providerId: p.id,
          providerName: p.name,
          type: 'remote',
          ok: res.ok,
          status: res.status,
          latencyMs: res.latencyMs,
          error: res.error,
          content: res.content,
        })
      } catch (e) {
        remoteResults.push({
          providerId: provider.id,
          providerName: provider.name,
          type: 'remote',
          ok: false,
          status: 0,
          latencyMs: 0,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    } else {
      try {
        const available = await provider.isAvailable()
        if (available) {
          // Ollama 真正可调用 — 用最小 prompt 冒烟
          const started = performance.now()
          try {
            const content = await provider.generate(PING_PROMPT)
            localResults.push({
              providerId: provider.id,
              providerName: provider.name,
              type: 'local',
              ok: true,
              status: 200,
              latencyMs: performance.now() - started,
              content,
            })
          } catch (err) {
            localResults.push({
              providerId: provider.id,
              providerName: provider.name,
              type: 'local',
              ok: false,
              status: 0,
              latencyMs: performance.now() - started,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        } else {
          localResults.push({
            providerId: provider.id,
            providerName: provider.name,
            type: 'local',
            ok: false,
            status: 0,
            latencyMs: 0,
            error: 'Ollama 未启动或未拉取模型，请执行 ollama serve && ollama pull 模型名',
          })
        }
      } catch (e) {
        localResults.push({
          providerId: provider.id,
          providerName: provider.name,
          type: 'local',
          ok: false,
          status: 0,
          latencyMs: 0,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  // --- 第 3 步：完整业务链路冒烟（callAi 走 provider 回退链） ---
  const smokeResults: ConnectivityCheckResult[] = []
  const smokeStarted = performance.now()
  try {
    const result = await callAi(PING_PROMPT)
    smokeResults.push({
      providerId: 'business-chain',
      providerName: '完整业务链路',
      type: 'remote',
      ok: !!result.trim(),
      status: 200,
      latencyMs: performance.now() - smokeStarted,
      content: result.trim(),
    })
  } catch (e) {
    smokeResults.push({
      providerId: 'business-chain',
      providerName: '完整业务链路',
      type: 'remote',
      ok: false,
      status: 0,
      latencyMs: performance.now() - smokeStarted,
      error: e instanceof Error ? e.message : String(e),
    })
  }

  // --- 汇总 ---
  const anyProviderOk =
    remoteResults.some((r) => r.ok) || localResults.some((r) => r.ok)
  const smokeOk = smokeResults.some((r) => r.ok)

  if (!anyProviderOk && remoteResults.length === 0 && localResults.filter((r) => r.ok).length === 0) {
    // 没一个 provider 可用
    const localErrors = localResults.filter((r) => !r.ok).map((r) => r.error).filter(Boolean) as string[]
    if (localErrors.length) suggestions.push(...localErrors.slice(0, 2))
    const remoteErrors = remoteResults.filter((r) => !r.ok).map((r) => `${r.providerName}: ${r.error || `HTTP ${r.status}`}`).slice(0, 3)
    if (remoteErrors.length) suggestions.push(...remoteErrors)
  }
  if (!smokeOk && anyProviderOk) {
    suggestions.push('至少有一个 provider 连通成功，但完整业务链路（callAi）失败，请检查 model 名或 quota')
  }
  if (smokeOk && smokeResults[0]?.content && !/ok/i.test(smokeResults[0].content)) {
    suggestions.push(`最小 prompt 返回内容"${smokeResults[0].content.slice(0, 50)}"，与预期"OK"不一致，属正常偏差（部分模型输出有前缀）`)
  }

  return {
    overallOk: smokeOk,
    configReady,
    remoteResults,
    localResults,
    smokeResults,
    suggestions,
    checkedAt: new Date().toISOString(),
  }
}

export type AiIndependentSelfCheckReport = AiIndependentRunReport

