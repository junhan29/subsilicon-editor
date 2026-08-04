/**
 * AI 请求与响应的共享工具函数。
 * 目标：遵循 Experience 421146 的教训——
 *   1) 连通性测试与业务请求必须完全同源（同一 URL、鉴权、请求体策略）
 *   2) 响应解析同时兼容 chat_completion 与 text_completion 两种返回格式
 *   3) 各 provider / 各 UI 组件不得手拼请求或手拆响应，统一复用此处函数
 */
import type { AiProviderConfig, AiRequestOptions } from './types'

export interface BuiltRemoteRequest {
  url: string
  method: 'POST'
  headers: Record<string, string>
  body: string
}

export interface ParsedRemoteResponse {
  /** 纯文本结果，去除首尾空白 */
  content: string
  /** 原始 choices[0] 对象，便于调试 */
  raw: unknown
}

/** 规范化 Authorization: Bearer <key> 形式（兼容多端 key 格式：无前缀 Bearer、带 sk-、全小写 bearer） */
export function normalizeBearerToken(apiKey: string): string {
  const key = (apiKey ?? '').trim()
  if (!key) return ''
  if (/^Bearer\s+/i.test(key)) {
    return 'Bearer ' + key.slice(7).trim()
  }
  return 'Bearer ' + key
}

/** 规范化 baseUrl：去除尾斜杠，兼容 "https://api.openai.com" 与 "https://api.openai.com/v1" */
export function normalizeBaseUrl(raw: string, provider: string): string {
  let url = (raw ?? '').trim()
  if (!url) {
    url = getDefaultApiUrlForProvider(provider)
  }
  // 去除末尾多余 /
  while (url.endsWith('/')) url = url.slice(0, -1)
  return url
}

export function getDefaultApiUrlForProvider(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'deepseek':
      return 'https://api.deepseek.com/v1'
    case 'anthropic':
      return 'https://api.anthropic.com/v1'
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta/openai'
    case 'baidu':
      return 'https://qianfan.baidubce.com/v2'
    case 'alibaba':
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    case 'doubao':
      return 'https://ark.cn-beijing.volces.com/api/v3'
    case 'zhipu':
      return 'https://open.bigmodel.cn/api/paas/v4'
    case 'moonshot':
      return 'https://api.moonshot.cn/v1'
    default:
      return 'https://api.openai.com/v1'
  }
}

/**
 * 构建远程 OpenAI 兼容 API 的 chat/completions 请求。
 * 业务调用与连通性测试必须共用此函数，确保鉴权、URL 与请求体格式完全一致。
 */
export function buildChatCompletionRequest(
  cfg: AiProviderConfig,
  options: AiRequestOptions,
  extra: { stream?: boolean } = {}
): BuiltRemoteRequest {
  const baseUrl = normalizeBaseUrl(cfg.apiUrl || '', cfg.provider)
  const bodyObj: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: 'system', content: options.systemPrompt || '' },
      { role: 'user', content: options.userPrompt || '' },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
  }
  if (extra.stream) bodyObj.stream = true
  return {
    url: `${baseUrl}/chat/completions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': normalizeBearerToken(cfg.apiKey || ''),
    },
    body: JSON.stringify(bodyObj),
  }
}

/**
 * 解析 chat_completion / text_completion 两种响应格式。
 * 兼容：
 *   - data.choices[0].message.content (chat_completion, OpenAI 兼容主流)
 *   - data.choices[0].delta.content (流式 chat_completion 单个 chunk)
 *   - data.choices[0].text (text_completion，旧版接口)
 */
export function parseRemoteCompletionResponse(data: unknown): ParsedRemoteResponse {
  if (data == null) return { content: '', raw: data }
  const choice0 =
    (data as { choices?: unknown[] }).choices && Array.isArray((data as { choices?: unknown[] }).choices)
      ? (data as { choices: unknown[] }).choices[0]
      : undefined

  if (choice0 && typeof choice0 === 'object') {
    const c = choice0 as { message?: { content?: unknown }; delta?: { content?: unknown }; text?: unknown }
    const msgContent =
      c.message && typeof c.message.content === 'string'
        ? c.message.content
        : c.message && typeof c.message.content === 'number'
        ? String(c.message.content)
        : ''
    if (msgContent) return { content: msgContent.trim(), raw: data }

    const deltaContent =
      c.delta && typeof c.delta.content === 'string'
        ? c.delta.content
        : c.delta && typeof c.delta.content === 'number'
        ? String(c.delta.content)
        : ''
    if (deltaContent) return { content: deltaContent, raw: data }

    if (typeof c.text === 'string' && c.text) {
      return { content: c.text.trim(), raw: data }
    }
    if (typeof c.text === 'number') {
      return { content: String(c.text), raw: data }
    }
  }

  // 兜底兼容：如 data.error.message 则抛错
  const err = (data as { error?: { message?: string } })?.error?.message
  if (typeof err === 'string' && err) {
    throw new Error(`Remote API error: ${err}`)
  }
  return { content: '', raw: data }
}

/** 用于连通性测试的最小 prompt（1 token，避免浪费额度） */
export const PING_PROMPT: AiRequestOptions = {
  systemPrompt: 'Reply with one word: OK',
  userPrompt: 'Ping',
  temperature: 0,
  maxTokens: 2,
}

/**
 * 执行"严格同源"连通性测试：
 *   - URL 拼接 / 鉴权 / 请求体 完全复用 buildChatCompletionRequest
 *   - 不替换鉴权方式、不伪造 mock 返回
 *   - 解析也走 parseRemoteCompletionResponse，确保业务路径一致
 */
export async function runStrictConnectivityTest(
  cfg: AiProviderConfig,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; latencyMs: number; content?: string; error?: string }> {
  const started = performance.now()
  try {
    const req = buildChatCompletionRequest(cfg, PING_PROMPT)
    if (!cfg.model) {
      return { ok: false, status: 0, latencyMs: performance.now() - started, error: '未配置模型' }
    }
    const resp = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal,
    })
    const text = await resp.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // 非 JSON，看状态码
    }
    let content: string | undefined
    if (resp.ok) {
      try {
        content = parseRemoteCompletionResponse(data).content
      } catch {
        content = undefined
      }
    }
    const latency = performance.now() - started
    if (!resp.ok) {
      const errText = data && typeof data === 'object' && (data as { error?: { message?: string } }).error?.message
        ? String((data as { error: { message: string } }).error.message)
        : text.slice(0, 200)
      return { ok: false, status: resp.status, latencyMs: latency, content, error: errText || `HTTP ${resp.status}` }
    }
    return { ok: true, status: resp.status, latencyMs: latency, content }
  } catch (e) {
    const latency = performance.now() - started
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, status: 0, latencyMs: latency, error: '请求超时或被取消' }
    }
    return { ok: false, status: 0, latencyMs: latency, error: e instanceof Error ? e.message : String(e) }
  }
}
